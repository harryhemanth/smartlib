import { db, refreshOverdueStatuses } from '../db.ts';
import type { AuthUser } from '../security.ts';
import {
  type AgentId,
  type IntentClassification,
  scoreTextRelevance,
  tokenizeAndClean,
} from './nlpOffline.ts';

export interface AgentBookResult {
  id: number;
  title: string;
  author: string;
  isbn: string;
  department: string;
  subject: string;
  available_copies: number;
  total_copies: number;
  shelf_location: string;
  active_reservations?: number;
}

export interface AgentDigitalResult {
  id: number;
  title: string;
  author: string;
  department: string;
  subject: string;
  resource_type: string;
  file_name: string;
  file_size_kb: number;
  download_count: number;
}

export interface AgentLoanResult {
  id: number;
  book_id: number;
  title: string;
  author: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  days_remaining: number;
}

export interface AgentExecutionResult {
  agent: AgentId;
  agentLabel: string;
  offlineReply: string;
  structuredContext: string;
  books?: AgentBookResult[];
  digitalResources?: AgentDigitalResult[];
  loans?: AgentLoanResult[];
  suggestedActions?: Array<{ label: string; view: string; entityId?: number }>;
}

function getAllBooksWithReservations() {
  return db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active') as active_reservations
    FROM books b
    ORDER BY b.id DESC
  `).all() as Array<AgentBookResult & { description: string; publish_year: number }>;
}

export function runSpecializedAgent(
  intent: IntentClassification,
  rawQuery: string,
  user: AuthUser
): AgentExecutionResult {
  refreshOverdueStatuses();

  switch (intent.agent) {
    case 'AGENT_2_SEARCH':
      return runSearchAgent(intent, rawQuery);
    case 'AGENT_3_AVAILABILITY':
      return runAvailabilityAgent(intent, rawQuery);
    case 'AGENT_4_RECOMMENDATION':
      return runRecommendationAgent(intent, rawQuery, user);
    case 'AGENT_5_BORROWING':
      return runBorrowingAgent(intent, user);
    case 'AGENT_6_DIGITAL_LIBRARY':
      return runDigitalLibraryAgent(intent, rawQuery, user);
    case 'AGENT_7_ADMIN':
      return runAdminAgent(intent, user);
    case 'AGENT_1_CHATBOT':
    default:
      return runChatbotAgent(intent, rawQuery, user);
  }
}

function runSearchAgent(intent: IntentClassification, rawQuery: string): AgentExecutionResult {
  const allBooks = getAllBooksWithReservations();
  const keywords = intent.keywords.length > 0 ? intent.keywords : tokenizeAndClean(rawQuery);

  let ranked = allBooks
    .map((book) => {
      let score = 0;
      if (intent.extractedIsbn && book.isbn.replace(/[-\s]/g, '').includes(intent.extractedIsbn.replace(/[-\s]/g, ''))) {
        score += 20;
      }
      if (intent.extractedDepartment && book.department.toLowerCase() === intent.extractedDepartment.toLowerCase()) {
        score += 3.5;
      }
      score += scoreTextRelevance(keywords, `${book.title} ${book.title}`) * 1.4;
      score += scoreTextRelevance(keywords, `${book.author} ${book.subject} ${book.department} ${book.description}`);
      return { book, score };
    })
    .filter((entry) => entry.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.book);

  if (ranked.length === 0 && intent.extractedDepartment) {
    ranked = allBooks
      .filter((b) => b.department.toLowerCase() === intent.extractedDepartment!.toLowerCase())
      .slice(0, 5);
  }

  if (ranked.length === 0) {
    return {
      agent: 'AGENT_2_SEARCH',
      agentLabel: intent.agentLabel,
      offlineReply: `I searched the SmartLib catalog for "${rawQuery}" across titles, authors, ISBNs, departments, and subjects, but found no exact match. Try searching by broader subject terms like Python, Java, Artificial Intelligence, Cybersecurity, Databases, or Mathematics.`,
      structuredContext: `Catalog search for "${rawQuery}" returned 0 matches. Total books in catalog: ${allBooks.length}.`,
      books: [],
      suggestedActions: [{ label: 'Open Book Search', view: 'book-search' }],
    };
  }

  const lines = ranked.map(
    (b, idx) =>
      `${idx + 1}. **${b.title}** by ${b.author} (${b.department} · ISBN ${b.isbn}) — ${b.available_copies}/${b.total_copies} copies available at Shelf ${b.shelf_location}.`
  );

  return {
    agent: 'AGENT_2_SEARCH',
    agentLabel: intent.agentLabel,
    offlineReply: `Found ${ranked.length} matching book${ranked.length > 1 ? 's' : ''} in the library catalog:\n\n${lines.join('\n')}`,
    structuredContext: JSON.stringify(ranked.map((b) => ({
      id: b.id, title: b.title, author: b.author, isbn: b.isbn,
      department: b.department, subject: b.subject,
      available_copies: b.available_copies, total_copies: b.total_copies,
      shelf_location: b.shelf_location,
    }))),
    books: ranked,
    suggestedActions: ranked.slice(0, 2).map((b) => ({
      label: `Inspect "${b.title.slice(0, 28)}..."`,
      view: 'book-details',
      entityId: b.id,
    })),
  };
}

function runAvailabilityAgent(intent: IntentClassification, rawQuery: string): AgentExecutionResult {
  const allBooks = getAllBooksWithReservations();
  const keywords = tokenizeAndClean(rawQuery).filter((k) => !['avail', 'availability', 'copi', 'copy', 'locat', 'shelf', 'reserv', 'status'].includes(k));

  const matches = allBooks
    .map((book) => {
      let score = 0;
      if (intent.extractedIsbn && book.isbn.includes(intent.extractedIsbn)) score += 20;
      score += scoreTextRelevance(keywords, `${book.title} ${book.subject} ${book.author}`);
      return { book, score };
    })
    .filter((m) => m.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((m) => m.book);

  if (matches.length === 0) {
    const outOfStock = allBooks.filter((b) => b.available_copies === 0);
    const totalAvailable = allBooks.reduce((sum, b) => sum + b.available_copies, 0);
    const totalCopies = allBooks.reduce((sum, b) => sum + b.total_copies, 0);

    return {
      agent: 'AGENT_3_AVAILABILITY',
      agentLabel: intent.agentLabel,
      offlineReply: `Library Inventory Status: ${totalAvailable} of ${totalCopies} total copies are currently available on shelves across ${allBooks.length} titles (${outOfStock.length} title currently checked out with 0 available copies). Specify a book title or ISBN to inspect exact shelf coordinates and reservation queues.`,
      structuredContext: `Total copies: ${totalCopies}, Available: ${totalAvailable}, Checked out titles (0 copies): ${outOfStock.map((b) => b.title).join(', ')}`,
      books: outOfStock.slice(0, 4),
      suggestedActions: [{ label: 'Browse Live Availability', view: 'book-search' }],
    };
  }

  const lines = matches.map((b) => {
    const borrowed = b.total_copies - b.available_copies;
    const statusText = b.available_copies > 0
      ? `AVAILABLE (${b.available_copies} of ${b.total_copies} copies on shelf; ${borrowed} borrowed)`
      : `UNAVAILABLE (0 of ${b.total_copies} available; all copies checked out · ${b.active_reservations || 0} active reservation${(b.active_reservations || 0) === 1 ? '' : 's'})`;
    return `• **${b.title}** — ${statusText}\n  Location: ${b.shelf_location} · ISBN: ${b.isbn}`;
  });

  return {
    agent: 'AGENT_3_AVAILABILITY',
    agentLabel: intent.agentLabel,
    offlineReply: `Live Shelf & Availability Verification:\n\n${lines.join('\n\n')}`,
    structuredContext: JSON.stringify(matches),
    books: matches,
    suggestedActions: matches.slice(0, 2).map((b) => ({
      label: b.available_copies > 0 ? `Borrow / View "${b.title.slice(0, 22)}..."` : `Reserve "${b.title.slice(0, 22)}..."`,
      view: 'book-details',
      entityId: b.id,
    })),
  };
}

function runRecommendationAgent(intent: IntentClassification, rawQuery: string, user: AuthUser): AgentExecutionResult {
  const allBooks = getAllBooksWithReservations();
  const keywords = tokenizeAndClean(rawQuery).filter((k) => !['recommend', 'suggest', 'best', 'popular', 'top', 'interest'].includes(k));
  const targetDept = intent.extractedDepartment || user.department;

  const borrowedBookIds = new Set(
    (db.prepare('SELECT book_id FROM loans WHERE user_id = ?').all(user.id) as Array<{ book_id: number }>).map((r) => r.book_id)
  );

  const scored = allBooks
    .map((book) => {
      let score = 0;
      if (book.department.toLowerCase() === targetDept.toLowerCase()) score += 4;
      if (keywords.length > 0) {
        score += scoreTextRelevance(keywords, `${book.title} ${book.subject} ${book.department} ${book.description}`) * 1.6;
      }
      if (book.available_copies > 0) score += 1.5;
      if (!borrowedBookIds.has(book.id)) score += 1.0;
      return { book, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.book);

  const lines = scored.map(
    (b, idx) =>
      `${idx + 1}. **${b.title}** by ${b.author}\n   Subject: ${b.subject} · ${b.available_copies}/${b.total_copies} available · Shelf ${b.shelf_location}`
  );

  return {
    agent: 'AGENT_4_RECOMMENDATION',
    agentLabel: intent.agentLabel,
    offlineReply: `Recommended Reading for ${targetDept}${keywords.length ? ' (tailored to your query)' : ''}:\n\n${lines.join('\n\n')}`,
    structuredContext: `User department: ${user.department}. Recommended books: ${JSON.stringify(scored)}`,
    books: scored,
    suggestedActions: [{ label: 'Explore Recommendations Page', view: 'recommendations' }],
  };
}

function runBorrowingAgent(intent: IntentClassification, user: AuthUser): AgentExecutionResult {
  const rows = db.prepare(`
    SELECT l.id, l.book_id, b.title, b.author, l.issue_date, l.due_date, l.return_date, l.status
    FROM loans l
    JOIN books b ON b.id = l.book_id
    WHERE l.user_id = ?
    ORDER BY l.issue_date DESC
  `).all(user.id) as Array<Omit<AgentLoanResult, 'days_remaining'>>;

  const loans: AgentLoanResult[] = rows.map((r) => {
    const diffMs = new Date(r.due_date).getTime() - Date.now();
    const daysRemaining = Math.ceil(diffMs / 86400000);
    return { ...r, days_remaining: daysRemaining };
  });

  const active = loans.filter((l) => l.status !== 'returned');
  const returned = loans.filter((l) => l.status === 'returned');

  if (loans.length === 0) {
    return {
      agent: 'AGENT_5_BORROWING',
      agentLabel: intent.agentLabel,
      offlineReply: `You currently have no active loans or past borrowing history under ${user.full_name} (${user.student_id || user.email}). You may borrow up to 5 books simultaneously from the catalog.`,
      structuredContext: 'User has 0 active loans and 0 returned loans.',
      loans: [],
      suggestedActions: [{ label: 'Search Books to Borrow', view: 'book-search' }],
    };
  }

  const activeLines = active.map((l) => {
    const dueStr = new Date(l.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const issueStr = new Date(l.issue_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timing = l.days_remaining < 0
      ? `OVERDUE by ${Math.abs(l.days_remaining)} day(s)`
      : `Due in ${l.days_remaining} day(s)`;
    return `• **${l.title}** — Issued ${issueStr} · Due ${dueStr} (${timing})`;
  });

  const summary = active.length > 0
    ? `Active Borrowed Books (${active.length}):\n${activeLines.join('\n')}\n\nCompleted Returns: ${returned.length}`
    : `You have 0 currently borrowed books and ${returned.length} completed return(s) in your history.`;

  return {
    agent: 'AGENT_5_BORROWING',
    agentLabel: intent.agentLabel,
    offlineReply: summary,
    structuredContext: JSON.stringify({ active, returnedCount: returned.length }),
    loans,
    suggestedActions: [{ label: 'Manage My Borrowed Books', view: 'borrowed-books' }],
  };
}

function runDigitalLibraryAgent(intent: IntentClassification, rawQuery: string, user: AuthUser): AgentExecutionResult {
  const resources = db.prepare(`
    SELECT id, title, author, department, subject, resource_type, file_name, file_size_kb, access_role, download_count, description
    FROM digital_resources
    ORDER BY download_count DESC
  `).all() as Array<AgentDigitalResult & { access_role: string; description: string }>;

  const authorized = resources.filter(
    (r) => r.access_role === 'all' || r.access_role === user.role || user.role === 'admin'
  );

  const keywords = tokenizeAndClean(rawQuery).filter((k) => !['pdf', 'note', 'notes', 'digit', 'download', 'resourc', 'materi'].includes(k));
  const matched = keywords.length > 0
    ? authorized
        .map((r) => ({ r, score: scoreTextRelevance(keywords, `${r.title} ${r.department} ${r.subject} ${r.description}`) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.r)
    : authorized;

  const finalResults = matched.length > 0 ? matched.slice(0, 5) : authorized.slice(0, 4);
  const lines = finalResults.map(
    (r, idx) =>
      `${idx + 1}. **${r.title}** (${r.resource_type.toUpperCase()} · ${r.file_size_kb} KB · ${r.department}) — ${r.download_count} downloads`
  );

  return {
    agent: 'AGENT_6_DIGITAL_LIBRARY',
    agentLabel: intent.agentLabel,
    offlineReply: `Authorized Digital Library Materials (${finalResults.length}):\n\n${lines.join('\n')}\n\nOpen the Digital Library page to download study packets and lecture notes directly.`,
    structuredContext: JSON.stringify(finalResults),
    digitalResources: finalResults,
    suggestedActions: [{ label: 'Open Digital Library', view: 'digital-library' }],
  };
}

function runAdminAgent(intent: IntentClassification, user: AuthUser): AgentExecutionResult {
  if (user.role !== 'admin') {
    return {
      agent: 'AGENT_7_ADMIN',
      agentLabel: intent.agentLabel,
      offlineReply: 'Access Restricted: Administrator operational intelligence, inventory modifications, and student account controls require an authorized Admin account.',
      structuredContext: 'Unauthorized student attempted to invoke Admin Management Agent.',
      suggestedActions: [{ label: 'Return to Student Dashboard', view: 'student-dashboard' }],
    };
  }

  const bookStats = db.prepare('SELECT COUNT(*) as titles, COALESCE(SUM(total_copies),0) as total, COALESCE(SUM(available_copies),0) as available FROM books').get() as {
    titles: number; total: number; available: number;
  };
  const studentCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get() as { c: number }).c;
  const activeLoans = (db.prepare("SELECT COUNT(*) as c FROM loans WHERE status IN ('borrowed','overdue')").get() as { c: number }).c;
  const overdueLoans = (db.prepare("SELECT COUNT(*) as c FROM loans WHERE status = 'overdue'").get() as { c: number }).c;

  const reply = [
    `Administrator Operational Summary:`,
    `• Catalog Titles: ${bookStats.titles} (${bookStats.available}/${bookStats.total} copies currently on shelf)`,
    `• Registered Students: ${studentCount}`,
    `• Active Circulation Loans: ${activeLoans} (${overdueLoans} overdue)`,
    `Use Book Management, Student Management, or Reports & Analytics in the left navigation to execute CRUD updates or inspect audit logs.`,
  ].join('\n');

  return {
    agent: 'AGENT_7_ADMIN',
    agentLabel: intent.agentLabel,
    offlineReply: reply,
    structuredContext: JSON.stringify({ bookStats, studentCount, activeLoans, overdueLoans }),
    suggestedActions: [
      { label: 'Admin Dashboard', view: 'admin-dashboard' },
      { label: 'Reports & Analytics', view: 'reports' },
    ],
  };
}

function runChatbotAgent(intent: IntentClassification, rawQuery: string, user: AuthUser): AgentExecutionResult {
  const lower = rawQuery.toLowerCase();
  const hours = (db.prepare("SELECT value FROM system_settings WHERE key = 'library_hours'").get() as { value: string } | undefined)?.value
    || 'Mon–Sat 07:30–22:00 · Sun 10:00–18:00';
  const maxLoans = (db.prepare("SELECT value FROM system_settings WHERE key = 'max_active_loans'").get() as { value: string } | undefined)?.value || '5';
  const loanDays = (db.prepare("SELECT value FROM system_settings WHERE key = 'loan_duration_days'").get() as { value: string } | undefined)?.value || '14';

  let reply = `Hello ${user.full_name.split(' ')[0]}. I am SmartLib AI, your multi-agent college librarian. I can search the catalog by title/author/ISBN, verify live copy availability and shelf coordinates, recommend textbooks for ${user.department}, inspect your borrowing & return dates, or locate digital lecture notes.\n\nLibrary Hours: ${hours} · Standard Loan Period: ${loanDays} days (up to ${maxLoans} concurrent books).`;

  if (/\b(hours|open|close|schedule)\b/.test(lower)) {
    reply = `SmartLib Central Academic Library Hours:\n• ${hours}\n• Digital Library PDFs and the AI Assistant remain accessible 24/7.`;
  } else if (/\b(policy|fine|rules|limit|how many|renew)\b/.test(lower)) {
    reply = `Borrowing Policy Summary:\n• Maximum concurrent loans: ${maxLoans} books per student.\n• Standard loan period: ${loanDays} days with up to 2 online renewals if no active hold exists.\n• Unavailable books can be reserved directly from the Book Details view.`;
  }

  return {
    agent: 'AGENT_1_CHATBOT',
    agentLabel: intent.agentLabel,
    offlineReply: reply,
    structuredContext: `User: ${user.full_name} (${user.role}, ${user.department}). Hours: ${hours}. Max loans: ${maxLoans}. Loan days: ${loanDays}.`,
    suggestedActions: [
      { label: 'Search Catalog', view: 'book-search' },
      { label: 'Digital Library', view: 'digital-library' },
    ],
  };
}
