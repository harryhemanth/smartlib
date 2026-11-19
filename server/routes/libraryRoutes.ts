import { Router } from 'express';
import QRCode from 'qrcode';
import { db, refreshOverdueStatuses } from '../db.ts';
import { type AuthenticatedRequest, getClientIp, logAdminActivity, requireAuth } from '../security.ts';

export const libraryRouter = Router();

libraryRouter.get('/overview', (req: AuthenticatedRequest, res) => {
  refreshOverdueStatuses();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as totalTitles,
      COALESCE(SUM(total_copies), 0) as totalCopies,
      COALESCE(SUM(available_copies), 0) as availableCopies
    FROM books
  `).get() as { totalTitles: number; totalCopies: number; availableCopies: number };

  const digitalCount = (db.prepare('SELECT COUNT(*) as c FROM digital_resources').get() as { c: number }).c;
  const recentBooks = db.prepare(`
    SELECT b.*, c.name as category_name
    FROM books b
    JOIN categories c ON c.id = b.category_id
    ORDER BY b.created_at DESC, b.id DESC
    LIMIT 6
  `).all();

  if (!req.user) {
    res.json({
      stats: { ...stats, digitalCount },
      recentBooks,
      myLoans: [],
      recommendedBooks: [],
      notifications: [],
    });
    return;
  }

  const myLoans = db.prepare(`
    SELECT l.*, b.title, b.author, b.isbn, b.shelf_location
    FROM loans l
    JOIN books b ON b.id = l.book_id
    WHERE l.user_id = ? AND l.status IN ('borrowed', 'overdue')
    ORDER BY l.due_date ASC
  `).all(req.user.id);

  const recommendedBooks = db.prepare(`
    SELECT b.*, c.name as category_name
    FROM books b
    JOIN categories c ON c.id = b.category_id
    WHERE b.available_copies > 0
    ORDER BY (CASE WHEN b.department = ? THEN 0 ELSE 1 END), b.available_copies DESC, b.publish_year DESC
    LIMIT 6
  `).all(req.user.department);

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(req.user.id);

  res.json({
    stats: { ...stats, digitalCount },
    recentBooks,
    myLoans,
    recommendedBooks,
    notifications,
  });
});

libraryRouter.get('/categories', (_req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json({ categories });
});

libraryRouter.get('/books', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const department = String(req.query.department || '').trim();
  const availableOnly = req.query.available === 'true';

  let sql = `
    SELECT b.*, c.name as category_name,
      (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active') as active_reservations
    FROM books b
    JOIN categories c ON c.id = b.category_id
    WHERE 1=1
  `;
  const params: Array<string | number> = [];

  if (q) {
    sql += ` AND (
      LOWER(b.title) LIKE ? OR
      LOWER(b.author) LIKE ? OR
      LOWER(b.isbn) LIKE ? OR
      LOWER(b.department) LIKE ? OR
      LOWER(b.subject) LIKE ? OR
      LOWER(b.description) LIKE ?
    )`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  if (department && department !== 'All') {
    sql += ' AND b.department = ?';
    params.push(department);
  }

  if (availableOnly) {
    sql += ' AND b.available_copies > 0';
  }

  sql += ' ORDER BY b.title ASC';
  const books = db.prepare(sql).all(...params);
  res.json({ books });
});

libraryRouter.get('/books/qr/:code', (req, res) => {
  const rawCode = decodeURIComponent(req.params.code).trim();
  let book = null;

  const idMatch = rawCode.match(/^SMARTLIB:BOOK:(\d+)/i);
  if (idMatch) {
    book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(idMatch[1]));
  } else {
    const clean = rawCode.replace(/^SMARTLIB:ISBN:/i, '').trim();
    book = db.prepare('SELECT * FROM books WHERE qr_code_data = ? OR isbn = ?').get(rawCode, clean);
  }

  if (!book) {
    res.status(404).json({ error: `No catalog book found matching QR/ISBN "${rawCode}".` });
    return;
  }
  res.json({ book });
});

libraryRouter.get('/books/:id', async (req: AuthenticatedRequest, res) => {
  refreshOverdueStatuses();
  const bookId = Number(req.params.id);
  const book = db.prepare(`
    SELECT b.*, c.name as category_name,
      (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active') as active_reservations
    FROM books b
    JOIN categories c ON c.id = b.category_id
    WHERE b.id = ?
  `).get(bookId) as (Record<string, unknown> & { id: number; department: string; qr_code_data: string }) | undefined;

  if (!book) {
    res.status(404).json({ error: 'Book not found.' });
    return;
  }

  const qrSvg = await QRCode.toDataURL(book.qr_code_data, {
    width: 180,
    margin: 1,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });

  const relatedBooks = db.prepare(`
    SELECT id, title, author, department, subject, available_copies, total_copies, shelf_location
    FROM books
    WHERE department = ? AND id != ?
    LIMIT 4
  `).all(book.department, bookId);

  let userLoan = null;
  let userReservation = null;
  if (req.user) {
    userLoan = db.prepare(`
      SELECT * FROM loans WHERE book_id = ? AND user_id = ? AND status IN ('borrowed', 'overdue')
    `).get(bookId, req.user.id) || null;
    userReservation = db.prepare(`
      SELECT * FROM reservations WHERE book_id = ? AND user_id = ? AND status = 'active'
    `).get(bookId, req.user.id) || null;
  }

  res.json({ book, qrDataUrl: qrSvg, relatedBooks, userLoan, userReservation });
});

libraryRouter.post('/books/:id/borrow', requireAuth, (req: AuthenticatedRequest, res) => {
  const bookId = Number(req.params.id);
  const user = req.user!;

  const maxSetting = (db.prepare("SELECT value FROM system_settings WHERE key = 'max_active_loans'").get() as { value: string } | undefined)?.value;
  const daysSetting = (db.prepare("SELECT value FROM system_settings WHERE key = 'loan_duration_days'").get() as { value: string } | undefined)?.value;
  const maxLoans = Number(maxSetting || 5);
  const loanDays = Number(daysSetting || 14);

  try {
    const result = db.transaction(() => {
      const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as
        | { id: number; title: string; available_copies: number }
        | undefined;
      if (!book) {
        throw { status: 404, message: 'Book not found.' };
      }
      if (book.available_copies <= 0) {
        throw { status: 409, message: 'No copies are currently available on shelf. You can place a reservation hold instead.' };
      }

      const activeCount = (
        db.prepare("SELECT COUNT(*) as c FROM loans WHERE user_id = ? AND status IN ('borrowed', 'overdue')").get(user.id) as { c: number }
      ).c;
      if (activeCount >= maxLoans) {
        throw { status: 400, message: `You have reached the maximum concurrent loan limit (${maxLoans} books).` };
      }

      const duplicate = db.prepare("SELECT id FROM loans WHERE book_id = ? AND user_id = ? AND status IN ('borrowed', 'overdue')").get(bookId, user.id);
      if (duplicate) {
        throw { status: 409, message: 'You already have an active loan for this book.' };
      }

      const issueDate = new Date().toISOString();
      const dueDate = new Date(Date.now() + loanDays * 86400000).toISOString();

      const loanRes = db.prepare(`
        INSERT INTO loans (book_id, user_id, issued_by, issue_date, due_date, status, notes)
        VALUES (?, ?, ?, ?, ?, 'borrowed', 'Self-service verified digital circulation')
      `).run(bookId, user.id, user.id, issueDate, dueDate);

      db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(bookId);
      db.prepare("UPDATE reservations SET status = 'fulfilled' WHERE book_id = ? AND user_id = ? AND status = 'active'").run(bookId, user.id);

      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, 'Book Borrowed Successfully', ?, 'info')
      `).run(
        user.id,
        `"${book.title}" has been issued to your account. Due date: ${new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
      );

      logAdminActivity(user, 'SELF_BORROW', 'loan', Number(loanRes.lastInsertRowid), `User ${user.email} borrowed "${book.title}".`, getClientIp(req));
      return { loanId: Number(loanRes.lastInsertRowid), dueDate };
    })();

    res.status(201).json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status || 500).json({ error: e.message || 'Unable to borrow book.' });
  }
});

libraryRouter.post('/loans/:loanId/return', requireAuth, (req: AuthenticatedRequest, res) => {
  const loanId = Number(req.params.loanId);
  const user = req.user!;

  try {
    db.transaction(() => {
      const loan = db.prepare(`
        SELECT l.*, b.title FROM loans l JOIN books b ON b.id = l.book_id
        WHERE l.id = ? AND l.user_id = ?
      `).get(loanId, user.id) as { id: number; book_id: number; status: string; title: string } | undefined;

      if (!loan) {
        throw { status: 404, message: 'Loan record not found for your account.' };
      }
      if (loan.status === 'returned') {
        throw { status: 400, message: 'This book has already been returned.' };
      }

      db.prepare("UPDATE loans SET status = 'returned', return_date = datetime('now') WHERE id = ?").run(loanId);
      db.prepare('UPDATE books SET available_copies = MIN(total_copies, available_copies + 1) WHERE id = ?').run(loan.book_id);

      const nextRes = db.prepare(`
        SELECT user_id FROM reservations WHERE book_id = ? AND status = 'active' ORDER BY reserved_at ASC LIMIT 1
      `).get(loan.book_id) as { user_id: number } | undefined;

      if (nextRes) {
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, 'Reserved Book Now Available', ?, 'reservation')
        `).run(nextRes.user_id, `A copy of "${loan.title}" has been returned and is ready for you to borrow.`);
      }

      logAdminActivity(user, 'BOOK_RETURNED', 'loan', loanId, `User ${user.email} returned "${loan.title}".`, getClientIp(req));
    })();

    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status || 500).json({ error: e.message || 'Return operation failed.' });
  }
});

libraryRouter.post('/loans/:loanId/renew', requireAuth, (req: AuthenticatedRequest, res) => {
  const loanId = Number(req.params.loanId);
  const user = req.user!;

  const loan = db.prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?').get(loanId, user.id) as
    | { id: number; book_id: number; due_date: string; status: string; renewal_count: number }
    | undefined;

  if (!loan) {
    res.status(404).json({ error: 'Loan not found.' });
    return;
  }
  if (loan.status === 'returned') {
    res.status(400).json({ error: 'Cannot renew a returned loan.' });
    return;
  }
  if (loan.renewal_count >= 2) {
    res.status(400).json({ error: 'Maximum renewal limit (2 extensions) reached for this loan.' });
    return;
  }

  const activeHold = db.prepare("SELECT id FROM reservations WHERE book_id = ? AND status = 'active' AND user_id != ?").get(loan.book_id, user.id);
  if (activeHold) {
    res.status(409).json({ error: 'Cannot renew: another student currently holds an active reservation on this title.' });
    return;
  }

  const newDue = new Date(Math.max(Date.now(), new Date(loan.due_date).getTime()) + 7 * 86400000).toISOString();
  db.prepare(`
    UPDATE loans SET due_date = ?, status = 'borrowed', renewal_count = renewal_count + 1 WHERE id = ?
  `).run(newDue, loanId);

  res.json({ ok: true, dueDate: newDue });
});

libraryRouter.post('/books/:id/reserve', requireAuth, (req: AuthenticatedRequest, res) => {
  const bookId = Number(req.params.id);
  const user = req.user!;

  const book = db.prepare('SELECT id, title FROM books WHERE id = ?').get(bookId) as { id: number; title: string } | undefined;
  if (!book) {
    res.status(404).json({ error: 'Book not found.' });
    return;
  }

  const existing = db.prepare("SELECT id FROM reservations WHERE book_id = ? AND user_id = ? AND status = 'active'").get(bookId, user.id);
  if (existing) {
    res.status(409).json({ error: 'You already have an active reservation for this title.' });
    return;
  }

  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const resIns = db.prepare(`
    INSERT INTO reservations (book_id, user_id, expires_at, status) VALUES (?, ?, ?, 'active')
  `).run(bookId, user.id, expiresAt);

  res.status(201).json({ reservationId: Number(resIns.lastInsertRowid), expiresAt });
});

libraryRouter.delete('/reservations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const resId = Number(req.params.id);
  const updated = db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ? AND user_id = ?").run(resId, req.user!.id);
  if (updated.changes === 0) {
    res.status(404).json({ error: 'Reservation not found.' });
    return;
  }
  res.json({ ok: true });
});

libraryRouter.get('/my-loans', requireAuth, (req: AuthenticatedRequest, res) => {
  refreshOverdueStatuses();
  const userId = req.user!.id;

  const loans = db.prepare(`
    SELECT l.*, b.title, b.author, b.isbn, b.department, b.shelf_location
    FROM loans l
    JOIN books b ON b.id = l.book_id
    WHERE l.user_id = ?
    ORDER BY l.issue_date DESC
  `).all(userId);

  const reservations = db.prepare(`
    SELECT r.*, b.title, b.author, b.isbn, b.available_copies, b.shelf_location
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    WHERE r.user_id = ? AND r.status = 'active'
    ORDER BY r.reserved_at DESC
  `).all(userId);

  res.json({ loans, reservations });
});

libraryRouter.get('/recommendations', requireAuth, (req: AuthenticatedRequest, res) => {
  const interest = String(req.query.interest || '').trim().toLowerCase();
  const dept = req.user!.department;

  const allBooks = db.prepare(`
    SELECT b.*, c.name as category_name
    FROM books b
    JOIN categories c ON c.id = b.category_id
  `).all() as Array<Record<string, unknown> & {
    id: number;
    title: string;
    department: string;
    subject: string;
    description: string;
    available_copies: number;
    publish_year: number;
  }>;

  const borrowedIds = new Set(
    (db.prepare('SELECT book_id FROM loans WHERE user_id = ?').all(req.user!.id) as Array<{ book_id: number }>).map((x) => x.book_id)
  );

  const ranked = allBooks
    .map((book) => {
      let score = 0;
      let reason = 'Catalog Highlight';
      if (book.department.toLowerCase() === dept.toLowerCase()) {
        score += 4;
        reason = `Aligned with ${dept}`;
      }
      if (interest && interest !== 'all') {
        const hay = `${book.title} ${book.subject} ${book.department} ${book.description}`.toLowerCase();
        if (hay.includes(interest)) {
          score += 6;
          reason = `Matches "${interest}" interest`;
        }
      }
      if (book.available_copies > 0) score += 2;
      if (!borrowedIds.has(book.id)) score += 1;
      return { ...book, relevanceScore: score, recommendationReason: reason };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 9);

  res.json({ recommendations: ranked });
});

libraryRouter.get('/digital-resources', requireAuth, (req: AuthenticatedRequest, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const dept = String(req.query.department || '').trim();
  const user = req.user!;

  let sql = 'SELECT * FROM digital_resources WHERE 1=1';
  const params: string[] = [];

  if (user.role !== 'admin') {
    sql += " AND access_role IN ('all', 'student')";
  }
  if (q) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(description) LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (dept && dept !== 'All') {
    sql += ' AND department = ?';
    params.push(dept);
  }

  sql += ' ORDER BY download_count DESC';
  const resources = db.prepare(sql).all(...params);
  res.json({ resources });
});

libraryRouter.get('/digital-resources/:id/download', requireAuth, (req: AuthenticatedRequest, res) => {
  const resId = Number(req.params.id);
  const resource = db.prepare('SELECT * FROM digital_resources WHERE id = ?').get(resId) as
    | {
        id: number;
        title: string;
        author: string;
        department: string;
        subject: string;
        resource_type: string;
        file_name: string;
        access_role: string;
        description: string;
        content_summary: string;
      }
    | undefined;

  if (!resource) {
    res.status(404).json({ error: 'Digital resource not found.' });
    return;
  }

  if (resource.access_role === 'admin' && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Access denied: this archive document is restricted to administrators.' });
    return;
  }

  db.prepare('UPDATE digital_resources SET download_count = download_count + 1 WHERE id = ?').run(resId);

  const documentText = [
    `SMARTLIB AI — AUTHORIZED DIGITAL ARCHIVE`,
    `============================================================`,
    `Title:       ${resource.title}`,
    `Author:      ${resource.author}`,
    `Department:  ${resource.department}`,
    `Subject:     ${resource.subject}`,
    `Type:        ${resource.resource_type.toUpperCase()}`,
    `Issued To:   ${req.user!.full_name} (${req.user!.email})`,
    `Timestamp:   ${new Date().toISOString()}`,
    `============================================================`,
    ``,
    `OVERVIEW`,
    `${resource.description}`,
    ``,
    `CURATED ACADEMIC SYLLABUS & STUDY CONTENT`,
    `${resource.content_summary}`,
    ``,
    `VERIFIED CITATION`,
    `${resource.author}. "${resource.title}." SmartLib AI Institutional Digital Archive, ${resource.department}.`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${resource.file_name}"`);
  res.send(documentText);
});

libraryRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(req.user!.id);
  res.json({ notifications });
});

libraryRouter.post('/notifications/read', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true });
});
