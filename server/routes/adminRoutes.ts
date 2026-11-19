import { Router } from 'express';
import { db, refreshOverdueStatuses } from '../db.ts';
import { type AuthenticatedRequest, getClientIp, logAdminActivity, requireAdmin } from '../security.ts';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get('/dashboard', (_req, res) => {
  refreshOverdueStatuses();

  const bookAgg = db.prepare(`
    SELECT
      COUNT(*) as totalTitles,
      COALESCE(SUM(total_copies), 0) as totalCopies,
      COALESCE(SUM(available_copies), 0) as availableCopies
    FROM books
  `).get() as { totalTitles: number; totalCopies: number; availableCopies: number };

  const borrowedCopies = Math.max(0, bookAgg.totalCopies - bookAgg.availableCopies);
  const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get() as { c: number }).c;
  const activeLoans = (db.prepare("SELECT COUNT(*) as c FROM loans WHERE status IN ('borrowed', 'overdue')").get() as { c: number }).c;
  const overdueBooks = (db.prepare("SELECT COUNT(*) as c FROM loans WHERE status = 'overdue'").get() as { c: number }).c;
  const activeReservations = (db.prepare("SELECT COUNT(*) as c FROM reservations WHERE status = 'active'").get() as { c: number }).c;

  const departmentStats = db.prepare(`
    SELECT
      b.department,
      COUNT(b.id) as title_count,
      SUM(b.total_copies) as total_copies,
      SUM(b.available_copies) as available_copies,
      COUNT(l.id) as total_loans
    FROM books b
    LEFT JOIN loans l ON l.book_id = b.id
    GROUP BY b.department
    ORDER BY total_copies DESC
  `).all();

  const recentTransactions = db.prepare(`
    SELECT
      l.id, l.issue_date, l.due_date, l.return_date, l.status,
      b.title as book_title, b.isbn,
      u.full_name as student_name, u.student_id, u.department
    FROM loans l
    JOIN books b ON b.id = l.book_id
    JOIN users u ON u.id = l.user_id
    ORDER BY l.id DESC
    LIMIT 10
  `).all();

  res.json({
    kpis: {
      totalTitles: bookAgg.totalTitles,
      totalCopies: bookAgg.totalCopies,
      availableCopies: bookAgg.availableCopies,
      borrowedCopies,
      totalStudents,
      activeLoans,
      overdueBooks,
      activeReservations,
    },
    departmentStats,
    recentTransactions,
  });
});

adminRouter.post('/books', (req: AuthenticatedRequest, res) => {
  const {
    title, author, isbn, category_id, department, subject,
    publisher, publish_year, total_copies, shelf_location, description,
  } = req.body as Record<string, string | number>;

  if (!String(title || '').trim() || !String(author || '').trim() || !String(isbn || '').trim()) {
    res.status(400).json({ error: 'Title, author, and ISBN are required.' });
    return;
  }

  const total = Math.max(1, Number(total_copies || 1));
  const year = Number(publish_year || new Date().getFullYear());
  const catId = Number(category_id || 1);
  const cleanIsbn = String(isbn).trim();

  const existing = db.prepare('SELECT id FROM books WHERE isbn = ?').get(cleanIsbn);
  if (existing) {
    res.status(409).json({ error: `A book with ISBN ${cleanIsbn} already exists in the catalog.` });
    return;
  }

  const insert = db.prepare(`
    INSERT INTO books (
      title, author, isbn, category_id, department, subject, publisher, publish_year,
      total_copies, available_copies, shelf_location, description, qr_code_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(title).trim(),
    String(author).trim(),
    cleanIsbn,
    catId,
    String(department || 'Computer Science').trim(),
    String(subject || 'General').trim(),
    String(publisher || 'Academic Press').trim(),
    year,
    total,
    total,
    String(shelf_location || 'A-100 · Wing North').trim(),
    String(description || 'Academic textbook cataloged by SmartLib Administration.').trim(),
    `SMARTLIB:ISBN:${cleanIsbn}`
  );

  const bookId = Number(insert.lastInsertRowid);
  db.prepare('UPDATE books SET qr_code_data = ? WHERE id = ?').run(`SMARTLIB:BOOK:${bookId}:${cleanIsbn}`, bookId);

  logAdminActivity(req.user!, 'BOOK_ADDED', 'book', bookId, `Added "${String(title).trim()}" (ISBN ${cleanIsbn}, ${total} copies).`, getClientIp(req));
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  res.status(201).json({ book });
});

adminRouter.put('/books/:id', (req: AuthenticatedRequest, res) => {
  const bookId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as
    | { id: number; total_copies: number; available_copies: number; title: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Book not found.' });
    return;
  }

  const {
    title, author, isbn, category_id, department, subject,
    publisher, publish_year, total_copies, available_copies, shelf_location, description,
  } = req.body as Record<string, string | number>;

  const newTotal = Math.max(0, Number(total_copies ?? existing.total_copies));
  const newAvail = Math.min(newTotal, Math.max(0, Number(available_copies ?? existing.available_copies)));

  db.prepare(`
    UPDATE books SET
      title = ?, author = ?, isbn = ?, category_id = ?, department = ?, subject = ?,
      publisher = ?, publish_year = ?, total_copies = ?, available_copies = ?,
      shelf_location = ?, description = ?
    WHERE id = ?
  `).run(
    String(title).trim(),
    String(author).trim(),
    String(isbn).trim(),
    Number(category_id || 1),
    String(department).trim(),
    String(subject).trim(),
    String(publisher || 'Academic Press').trim(),
    Number(publish_year || 2024),
    newTotal,
    newAvail,
    String(shelf_location).trim(),
    String(description).trim(),
    bookId
  );

  logAdminActivity(req.user!, 'BOOK_UPDATED', 'book', bookId, `Updated catalog entry "${String(title).trim()}" (${newAvail}/${newTotal} available).`, getClientIp(req));
  const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  res.json({ book: updated });
});

adminRouter.delete('/books/:id', (req: AuthenticatedRequest, res) => {
  const bookId = Number(req.params.id);
  const activeLoans = (
    db.prepare("SELECT COUNT(*) as c FROM loans WHERE book_id = ? AND status IN ('borrowed', 'overdue')").get(bookId) as { c: number }
  ).c;

  if (activeLoans > 0) {
    res.status(409).json({ error: `Cannot delete book: ${activeLoans} active loan(s) must be returned first.` });
    return;
  }

  const book = db.prepare('SELECT title FROM books WHERE id = ?').get(bookId) as { title: string } | undefined;
  if (!book) {
    res.status(404).json({ error: 'Book not found.' });
    return;
  }

  db.prepare('DELETE FROM books WHERE id = ?').run(bookId);
  logAdminActivity(req.user!, 'BOOK_DELETED', 'book', bookId, `Deleted book "${book.title}" from catalog.`, getClientIp(req));
  res.json({ ok: true });
});

adminRouter.get('/students', (_req, res) => {
  refreshOverdueStatuses();
  const students = db.prepare(`
    SELECT
      u.id, u.full_name, u.email, u.student_id, u.department, u.year_of_study,
      u.status, u.created_at, u.last_login_at,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status IN ('borrowed', 'overdue')) as active_loans,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status = 'overdue') as overdue_loans
    FROM users u
    WHERE u.role = 'student'
    ORDER BY u.created_at DESC
  `).all();
  res.json({ students });
});

adminRouter.patch('/students/:id/status', (req: AuthenticatedRequest, res) => {
  const studentId = Number(req.params.id);
  const { status } = req.body as { status?: 'active' | 'suspended' };
  if (status !== 'active' && status !== 'suspended') {
    res.status(400).json({ error: 'Status must be active or suspended.' });
    return;
  }

  const target = db.prepare("SELECT id, email, full_name FROM users WHERE id = ? AND role = 'student'").get(studentId) as
    | { id: number; email: string; full_name: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'Student account not found.' });
    return;
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, studentId);
  logAdminActivity(req.user!, 'STUDENT_STATUS_CHANGED', 'user', studentId, `Set account ${target.email} status to ${status}.`, getClientIp(req));
  res.json({ ok: true, status });
});

adminRouter.post('/loans/issue', (req: AuthenticatedRequest, res) => {
  const { bookId, userId, days } = req.body as { bookId?: number; userId?: number; days?: number };
  const bId = Number(bookId);
  const uId = Number(userId);
  const duration = Math.max(1, Number(days || 14));

  try {
    const loanId = db.transaction(() => {
      const book = db.prepare('SELECT id, title, available_copies FROM books WHERE id = ?').get(bId) as
        | { id: number; title: string; available_copies: number }
        | undefined;
      const student = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(uId) as
        | { id: number; full_name: string; email: string }
        | undefined;

      if (!book || !student) throw { status: 404, message: 'Book or student not found.' };
      if (book.available_copies <= 0) throw { status: 409, message: 'No available copies left on shelf.' };

      const issueDate = new Date().toISOString();
      const dueDate = new Date(Date.now() + duration * 86400000).toISOString();
      const ins = db.prepare(`
        INSERT INTO loans (book_id, user_id, issued_by, issue_date, due_date, status, notes)
        VALUES (?, ?, ?, ?, ?, 'borrowed', 'Issued by library administrator')
      `).run(bId, uId, req.user!.id, issueDate, dueDate);

      db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(bId);
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, 'Book Issued by Librarian', ?, 'info')
      `).run(uId, `"${book.title}" was issued to you by ${req.user!.full_name}. Due on ${new Date(dueDate).toLocaleDateString()}.`);

      logAdminActivity(req.user!, 'ADMIN_BOOK_ISSUED', 'loan', Number(ins.lastInsertRowid), `Issued "${book.title}" to ${student.email}.`, getClientIp(req));
      return Number(ins.lastInsertRowid);
    })();

    res.status(201).json({ loanId });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status || 500).json({ error: e.message || 'Issue failed.' });
  }
});

adminRouter.post('/loans/:id/force-return', (req: AuthenticatedRequest, res) => {
  const loanId = Number(req.params.id);
  try {
    db.transaction(() => {
      const loan = db.prepare(`
        SELECT l.*, b.title FROM loans l JOIN books b ON b.id = l.book_id WHERE l.id = ?
      `).get(loanId) as { id: number; book_id: number; status: string; title: string } | undefined;

      if (!loan) throw { status: 404, message: 'Loan record not found.' };
      if (loan.status === 'returned') throw { status: 400, message: 'Loan already returned.' };

      db.prepare("UPDATE loans SET status = 'returned', return_date = datetime('now') WHERE id = ?").run(loanId);
      db.prepare('UPDATE books SET available_copies = MIN(total_copies, available_copies + 1) WHERE id = ?').run(loan.book_id);
      logAdminActivity(req.user!, 'ADMIN_FORCE_RETURN', 'loan', loanId, `Marked loan #${loanId} ("${loan.title}") returned.`, getClientIp(req));
    })();
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status || 500).json({ error: e.message || 'Return failed.' });
  }
});

adminRouter.get('/reports', (_req, res) => {
  refreshOverdueStatuses();

  const topBooks = db.prepare(`
    SELECT b.id, b.title, b.author, b.department, b.available_copies, b.total_copies, COUNT(l.id) as loan_count
    FROM books b
    LEFT JOIN loans l ON l.book_id = b.id
    GROUP BY b.id
    ORDER BY loan_count DESC, b.title ASC
    LIMIT 8
  `).all();

  const overdueList = db.prepare(`
    SELECT l.id, l.issue_date, l.due_date, b.title, b.isbn, u.full_name, u.student_id, u.email
    FROM loans l
    JOIN books b ON b.id = l.book_id
    JOIN users u ON u.id = l.user_id
    WHERE l.status = 'overdue'
    ORDER BY l.due_date ASC
  `).all();

  const digitalStats = db.prepare(`
    SELECT id, title, department, resource_type, download_count
    FROM digital_resources
    ORDER BY download_count DESC
  `).all();

  const activityLogs = db.prepare(`
    SELECT * FROM admin_activity ORDER BY id DESC LIMIT 40
  `).all();

  const loginLogs = db.prepare(`
    SELECT * FROM login_activity ORDER BY id DESC LIMIT 25
  `).all();

  res.json({ topBooks, overdueList, digitalStats, activityLogs, loginLogs });
});

adminRouter.get('/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value, updated_at FROM system_settings').all() as Array<{
    key: string; value: string; updated_at: string;
  }>;
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
});

adminRouter.put('/settings', (req: AuthenticatedRequest, res) => {
  const updates = req.body as Record<string, string>;
  const allowedKeys = ['default_ai_mode', 'loan_duration_days', 'max_active_loans', 'library_hours'];

  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  for (const key of allowedKeys) {
    if (updates[key] !== undefined) {
      upsert.run(key, String(updates[key]).trim());
    }
  }

  logAdminActivity(req.user!, 'SETTINGS_UPDATED', 'system', 'settings', `Updated system settings: ${Object.keys(updates).join(', ')}`, getClientIp(req));
  res.json({ ok: true });
});
