import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'smartlib.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      student_id TEXT UNIQUE,
      department TEXT NOT NULL DEFAULT 'Computer Science',
      year_of_study TEXT NOT NULL DEFAULT '3rd Year',
      role TEXT NOT NULL CHECK(role IN ('student', 'admin')) DEFAULT 'student',
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'suspended')) DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      shelf_prefix TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL,
      department TEXT NOT NULL,
      subject TEXT NOT NULL,
      publisher TEXT NOT NULL DEFAULT 'Academic Press',
      publish_year INTEGER NOT NULL DEFAULT 2024,
      total_copies INTEGER NOT NULL CHECK(total_copies >= 0) DEFAULT 1,
      available_copies INTEGER NOT NULL CHECK(available_copies >= 0) DEFAULT 1,
      shelf_location TEXT NOT NULL,
      description TEXT NOT NULL,
      cover_url TEXT,
      qr_code_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      issued_by INTEGER,
      issue_date TEXT NOT NULL DEFAULT (datetime('now')),
      due_date TEXT NOT NULL,
      return_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('borrowed', 'returned', 'overdue')) DEFAULT 'borrowed',
      renewal_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reserved_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'fulfilled', 'cancelled', 'expired')) DEFAULT 'active',
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS digital_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      department TEXT NOT NULL,
      subject TEXT NOT NULL,
      resource_type TEXT NOT NULL CHECK(resource_type IN ('pdf', 'lecture_notes', 'paper', 'ebook')) DEFAULT 'pdf',
      file_name TEXT NOT NULL,
      file_size_kb INTEGER NOT NULL DEFAULT 420,
      access_role TEXT NOT NULL CHECK(access_role IN ('all', 'student', 'admin')) DEFAULT 'all',
      download_count INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      content_summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      message TEXT NOT NULL,
      agent_used TEXT,
      ai_mode TEXT NOT NULL CHECK(ai_mode IN ('online', 'offline')) DEFAULT 'offline',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('info', 'due_soon', 'overdue', 'reservation')) DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS login_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      user_agent TEXT NOT NULL DEFAULT 'Browser',
      status TEXT NOT NULL CHECK(status IN ('success', 'failed')) DEFAULT 'success',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_books_department ON books(department);
    CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
    CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
    CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(user_id, session_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) {
    return;
  }

  const seedTx = db.transaction(() => {
    const adminHash = bcrypt.hashSync('Admin@SmartLib2026', 10);
    const studentHash = bcrypt.hashSync('Student@2026', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (full_name, email, student_id, department, year_of_study, role, password_hash, avatar_url, status, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now', '-1 day'))
    `);

    const adminRes = insertUser.run(
      'Dr. Eleanor Vance',
      'admin@smartlib.edu',
      'STAFF-001',
      'Library Administration',
      'Faculty',
      'admin',
      adminHash,
      '/src/assets/images/avatar_admin_librarian_1795095651881.jpg'
    );

    const student1Res = insertUser.run(
      'Maya Lin',
      'maya.lin@smartlib.edu',
      'CS-2024-1042',
      'Computer Science',
      '3rd Year',
      'student',
      studentHash,
      '/src/assets/images/avatar_student_profile_1795095652304.jpg'
    );

    const student2Res = insertUser.run(
      'Arjun Mehta',
      'arjun.mehta@smartlib.edu',
      'CYB-2024-0819',
      'Cybersecurity',
      '2nd Year',
      'student',
      studentHash,
      null
    );

    const student3Res = insertUser.run(
      'Elena Rostova',
      'elena.rostova@smartlib.edu',
      'AI-2023-0314',
      'Artificial Intelligence',
      '4th Year',
      'student',
      studentHash,
      null
    );

    const insertCat = db.prepare(`
      INSERT INTO categories (name, code, description, shelf_prefix) VALUES (?, ?, ?, ?)
    `);

    const catProgramming = insertCat.run('Software Engineering & Programming', 'PROG', 'Python, Java, C++, compilers, and software architecture.', 'A-100').lastInsertRowid;
    const catAI = insertCat.run('Artificial Intelligence & ML', 'AIML', 'Deep learning, reinforcement learning, NLP, and intelligent agents.', 'B-200').lastInsertRowid;
    const catCyber = insertCat.run('Cybersecurity & Networks', 'CYBR', 'Cryptography, ethical hacking, network security, and forensics.', 'C-300').lastInsertRowid;
    const catData = insertCat.run('Data Science & Databases', 'DATA', 'SQL systems, distributed storage, big data, and analytics.', 'D-400').lastInsertRowid;
    const catMath = insertCat.run('Mathematics & Core Science', 'MATH', 'Linear algebra, discrete math, quantum computing, and physics.', 'E-500').lastInsertRowid;

    const booksSeed = [
      {
        title: 'Python Programming: An Introduction to Computer Science',
        author: 'John Zelle',
        isbn: '978-1590282755',
        category_id: catProgramming,
        department: 'Computer Science',
        subject: 'Python Programming',
        publisher: 'Franklin, Beedle & Associates',
        publish_year: 2023,
        total_copies: 6,
        available_copies: 4,
        shelf_location: 'A-104 · Row 2 · Wing North',
        description: 'Foundational textbook covering algorithmic thinking, object-oriented design, data structures, and Python 3 software engineering principles.'
      },
      {
        title: 'Fluent Python: Clear, Concise, and Effective Programming',
        author: 'Luciano Ramalho',
        isbn: '978-1492056355',
        category_id: catProgramming,
        department: 'Computer Science',
        subject: 'Python Programming',
        publisher: 'O’Reilly Media',
        publish_year: 2022,
        total_copies: 5,
        available_copies: 3,
        shelf_location: 'A-108 · Row 2 · Wing North',
        description: 'Deep dive into Python’s data model, iterators, async concurrency, metaprogramming, and idiomatic engineering patterns.'
      },
      {
        title: 'Effective Java (3rd Edition)',
        author: 'Joshua Bloch',
        isbn: '978-0134685991',
        category_id: catProgramming,
        department: 'Computer Science',
        subject: 'Java Programming',
        publisher: 'Addison-Wesley Professional',
        publish_year: 2021,
        total_copies: 4,
        available_copies: 2,
        shelf_location: 'A-115 · Row 3 · Wing North',
        description: 'Definitive guide to Java best practices, generics, lambdas, streams, concurrency, and resilient API design.'
      },
      {
        title: 'Java Programming & Enterprise Systems',
        author: 'Herbert Schildt',
        isbn: '978-1260440232',
        category_id: catProgramming,
        department: 'Computer Science',
        subject: 'Java Programming',
        publisher: 'McGraw-Hill Education',
        publish_year: 2023,
        total_copies: 3,
        available_copies: 0,
        shelf_location: 'A-119 · Row 3 · Wing North',
        description: 'Comprehensive reference covering Java SE, multithreading, networking, and enterprise module architectures.'
      },
      {
        title: 'Artificial Intelligence: A Modern Approach (4th Edition)',
        author: 'Stuart Russell & Peter Norvig',
        isbn: '978-0134610993',
        category_id: catAI,
        department: 'Artificial Intelligence',
        subject: 'Artificial Intelligence',
        publisher: 'Pearson Academic',
        publish_year: 2023,
        total_copies: 8,
        available_copies: 5,
        shelf_location: 'B-201 · Row 1 · Wing East',
        description: 'Authoritative university reference on intelligent agents, search algorithms, probabilistic reasoning, machine learning, and natural language processing.'
      },
      {
        title: 'Deep Learning Foundations and Concepts',
        author: 'Christopher M. Bishop & Hugh Bishop',
        isbn: '978-3031454677',
        category_id: catAI,
        department: 'Artificial Intelligence',
        subject: 'Machine Learning',
        publisher: 'Springer Nature',
        publish_year: 2024,
        total_copies: 5,
        available_copies: 4,
        shelf_location: 'B-210 · Row 2 · Wing East',
        description: 'Rigorous mathematical and architectural coverage of transformers, diffusion models, graph neural networks, and optimization.'
      },
      {
        title: 'Natural Language Processing with Transformers',
        author: 'Lewis Tunstall, Leandro von Werra & Thomas Wolf',
        isbn: '978-1098136796',
        category_id: catAI,
        department: 'Artificial Intelligence',
        subject: 'Natural Language Processing',
        publisher: 'O’Reilly Media',
        publish_year: 2023,
        total_copies: 4,
        available_copies: 2,
        shelf_location: 'B-218 · Row 2 · Wing East',
        description: 'Applied NLP systems engineering for text classification, question answering, summarization, and multi-lingual transformer architectures.'
      },
      {
        title: 'Computer Security: Principles and Practice',
        author: 'William Stallings & Lawrie Brown',
        isbn: '978-0134794105',
        category_id: catCyber,
        department: 'Cybersecurity',
        subject: 'Cybersecurity',
        publisher: 'Pearson',
        publish_year: 2023,
        total_copies: 6,
        available_copies: 4,
        shelf_location: 'C-302 · Row 1 · Wing West',
        description: 'Comprehensive study of cryptography, access control, malware defense, intrusion detection, and secure operating systems.'
      },
      {
        title: 'The Web Application Hacker’s Handbook',
        author: 'Dafydd Stuttard & Marcus Pinto',
        isbn: '978-1118026472',
        category_id: catCyber,
        department: 'Cybersecurity',
        subject: 'Application Security',
        publisher: 'Wiley',
        publish_year: 2022,
        total_copies: 4,
        available_copies: 3,
        shelf_location: 'C-311 · Row 2 · Wing West',
        description: 'Practical methodology for discovering and remediating injection vulnerabilities, authentication flaws, and session hijacking.'
      },
      {
        title: 'Applied Cryptography: Protocols, Algorithms and Source Code',
        author: 'Bruce Schneier',
        isbn: '978-1119096726',
        category_id: catCyber,
        department: 'Cybersecurity',
        subject: 'Cryptography',
        publisher: 'Wiley',
        publish_year: 2021,
        total_copies: 3,
        available_copies: 2,
        shelf_location: 'C-320 · Row 3 · Wing West',
        description: 'Classic engineering treatment of symmetric ciphers, public-key protocols, zero-knowledge proofs, and cryptographic primitives.'
      },
      {
        title: 'Designing Data-Intensive Applications',
        author: 'Martin Kleppmann',
        isbn: '978-1449373320',
        category_id: catData,
        department: 'Data Science',
        subject: 'Distributed Systems & Databases',
        publisher: 'O’Reilly Media',
        publish_year: 2022,
        total_copies: 7,
        available_copies: 5,
        shelf_location: 'D-405 · Row 1 · Wing South',
        description: 'Essential architecture guide to replication, partitioning, consensus, stream processing, and reliable distributed data storage.'
      },
      {
        title: 'Database System Concepts (7th Edition)',
        author: 'Abraham Silberschatz, Henry Korth & S. Sudarshan',
        isbn: '978-0078022159',
        category_id: catData,
        department: 'Data Science',
        subject: 'Database Management',
        publisher: 'McGraw-Hill',
        publish_year: 2023,
        total_copies: 5,
        available_copies: 4,
        shelf_location: 'D-412 · Row 2 · Wing South',
        description: 'Foundational text on relational algebra, SQL query optimization, transaction ACID guarantees, B+ tree indexing, and recovery.'
      },
      {
        title: 'Introduction to Algorithms (CLRS, 4th Edition)',
        author: 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest & Clifford Stein',
        isbn: '978-0262046305',
        category_id: catProgramming,
        department: 'Computer Science',
        subject: 'Algorithms & Data Structures',
        publisher: 'MIT Press',
        publish_year: 2023,
        total_copies: 6,
        available_copies: 3,
        shelf_location: 'A-101 · Row 1 · Wing North',
        description: 'Rigorous encyclopedia of graph algorithms, dynamic programming, amortized analysis, and NP-completeness.'
      },
      {
        title: 'Linear Algebra Done Right (4th Edition)',
        author: 'Sheldon Axler',
        isbn: '978-3031410253',
        category_id: catMath,
        department: 'Mathematics',
        subject: 'Linear Algebra',
        publisher: 'Springer',
        publish_year: 2024,
        total_copies: 5,
        available_copies: 5,
        shelf_location: 'E-504 · Row 1 · Wing South',
        description: 'Conceptual vector spaces, eigenvalues, inner product spaces, and spectral theorems essential for quantum computing and ML.'
      },
      {
        title: 'Quantum Computation and Quantum Information',
        author: 'Michael A. Nielsen & Isaac L. Chuang',
        isbn: '978-1107002173',
        category_id: catMath,
        department: 'Physics & Quantum Engineering',
        subject: 'Quantum Science',
        publisher: 'Cambridge University Press',
        publish_year: 2022,
        total_copies: 4,
        available_copies: 3,
        shelf_location: 'E-518 · Row 2 · Wing South',
        description: 'Canonical graduate text on qubits, quantum circuits, Shor’s algorithm, quantum error correction, and entropy.'
      }
    ];

    const insertBook = db.prepare(`
      INSERT INTO books (
        title, author, isbn, category_id, department, subject, publisher, publish_year,
        total_copies, available_copies, shelf_location, description, qr_code_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const bookIds: number[] = [];
    for (const b of booksSeed) {
      const res = insertBook.run(
        b.title,
        b.author,
        b.isbn,
        b.category_id,
        b.department,
        b.subject,
        b.publisher,
        b.publish_year,
        b.total_copies,
        b.available_copies,
        b.shelf_location,
        b.description,
        `SMARTLIB:ISBN:${b.isbn}`
      );
      bookIds.push(Number(res.lastInsertRowid));
    }

    // Update qr_code_data to include exact book id for instant QR lookup
    const updateQr = db.prepare('UPDATE books SET qr_code_data = ? WHERE id = ?');
    for (let i = 0; i < bookIds.length; i++) {
      updateQr.run(`SMARTLIB:BOOK:${bookIds[i]}:${booksSeed[i].isbn}`, bookIds[i]);
    }

    const s1 = Number(student1Res.lastInsertRowid);
    const s2 = Number(student2Res.lastInsertRowid);
    const s3 = Number(student3Res.lastInsertRowid);
    const adm = Number(adminRes.lastInsertRowid);

    const insertLoan = db.prepare(`
      INSERT INTO loans (book_id, user_id, issued_by, issue_date, due_date, return_date, status, renewal_count, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Maya Lin active loans (1 due in 3 days, 1 due in 10 days) + 1 returned history
    insertLoan.run(
      bookIds[2], // Effective Java
      s1,
      adm,
      new Date(Date.now() - 11 * 86400000).toISOString(),
      new Date(Date.now() + 3 * 86400000).toISOString(),
      null,
      'borrowed',
      0,
      'Regular 14-day student issue'
    );
    insertLoan.run(
      bookIds[4], // AI: A Modern Approach
      s1,
      adm,
      new Date(Date.now() - 4 * 86400000).toISOString(),
      new Date(Date.now() + 10 * 86400000).toISOString(),
      null,
      'borrowed',
      0,
      'Course reference CS-402'
    );
    insertLoan.run(
      bookIds[0], // Python Programming
      s1,
      adm,
      new Date(Date.now() - 32 * 86400000).toISOString(),
      new Date(Date.now() - 18 * 86400000).toISOString(),
      new Date(Date.now() - 19 * 86400000).toISOString(),
      'returned',
      0,
      'Returned on time'
    );

    // Arjun Mehta: 1 overdue loan (Java Enterprise - 0 copies available)
    insertLoan.run(
      bookIds[3], // Java Programming & Enterprise Systems
      s2,
      adm,
      new Date(Date.now() - 20 * 86400000).toISOString(),
      new Date(Date.now() - 6 * 86400000).toISOString(),
      null,
      'overdue',
      0,
      'Overdue notice dispatched'
    );

    // Elena Rostova: 1 active loan
    insertLoan.run(
      bookIds[6], // NLP with Transformers
      s3,
      adm,
      new Date(Date.now() - 5 * 86400000).toISOString(),
      new Date(Date.now() + 9 * 86400000).toISOString(),
      null,
      'borrowed',
      1,
      'Thesis research copy'
    );

    // Reservation for Java Enterprise (which has 0 copies)
    db.prepare(`
      INSERT INTO reservations (book_id, user_id, reserved_at, expires_at, status)
      VALUES (?, ?, datetime('now', '-1 day'), datetime('now', '+6 days'), 'active')
    `).run(bookIds[3], s1);

    // Digital Library Resources
    const insertDigital = db.prepare(`
      INSERT INTO digital_resources (
        title, author, department, subject, resource_type, file_name, file_size_kb,
        access_role, download_count, description, content_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertDigital.run(
      'CS-402 Artificial Intelligence Lecture Notes (Complete Term)',
      'Prof. Alan Sterling',
      'Artificial Intelligence',
      'Artificial Intelligence',
      'lecture_notes',
      'CS402_AI_Lecture_Notes_2026.txt',
      640,
      'all',
      142,
      'Comprehensive 14-week lecture compendium covering heuristic search, constraint satisfaction, MDPs, Bayesian networks, and multi-agent systems.',
      'Module 1: Intelligent Agents & Environments. Module 2: A* Search & Admissible Heuristics. Module 3: Markov Decision Processes & Q-Learning. Module 4: Transformer Architectures & Grounded RAG.'
    );
    insertDigital.run(
      'Network Penetration & Zero-Trust Architecture Guide',
      'Dr. Marcus Vance',
      'Cybersecurity',
      'Cybersecurity',
      'pdf',
      'Zero_Trust_Security_Lab_Manual.txt',
      1180,
      'all',
      98,
      'Authorized university laboratory manual for TLS 1.3 inspection, RBAC hardening, SQL injection prevention, and secure token lifecycle.',
      'Section 1: Threat Modeling with STRIDE. Section 2: Parameterized SQL & Prepared Statements. Section 3: CSRF Defense & HttpOnly Session Architecture. Section 4: Network Segmentation Labs.'
    );
    insertDigital.run(
      'Python Data Structures & Algorithms Study Packet',
      'Department of Computer Science',
      'Computer Science',
      'Python Programming',
      'lecture_notes',
      'CS201_Python_DSA_Study_Packet.txt',
      512,
      'all',
      215,
      'Annotated code patterns and complexity proofs for trees, heaps, dynamic programming, and graph traversal in Python 3.12.',
      'Topic 1: Asymptotic Complexity & Recurrences. Topic 2: Balanced Search Trees & Priority Queues. Topic 3: Dijkstra, Bellman-Ford & Topological Sort. Topic 4: Memoization Exercises.'
    );
    insertDigital.run(
      'Distributed Consensus: Raft & Paxos Comparative Paper',
      'Elena Rostova & Prof. H. Chen',
      'Data Science',
      'Distributed Systems & Databases',
      'paper',
      'Distributed_Consensus_Raft_Paxos.txt',
      890,
      'student',
      74,
      'Peer-reviewed departmental seminar paper analyzing leader election, log replication, and split-brain mitigation in modern SQL/NoSQL clusters.',
      'Abstract: Evaluates Raft leader election timers against Multi-Paxos under simulated WAN partition faults across 5-node clusters.'
    );
    insertDigital.run(
      'Library Acquisition & Inventory Audit Policy (Staff Only)',
      'Dr. Eleanor Vance',
      'Library Administration',
      'Governance',
      'pdf',
      'SmartLib_Staff_Acquisition_Policy.txt',
      380,
      'admin',
      19,
      'Internal administrative policy manual covering ISBN cataloging, damaged copy write-offs, and annual student borrowing audits.',
      'Internal Governance Standard 2026: Outlines quarterly physical inventory reconciliation, overdue escalation workflows, and archival retention schedules.'
    );

    // Notifications
    const insertNotif = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)
    `);
    insertNotif.run(
      s1,
      'Upcoming Book Return Due in 3 Days',
      'Your loan for "Effective Java (3rd Edition)" is due in 3 days. Renew online or return at Wing North Desk.',
      'due_soon'
    );
    insertNotif.run(
      s1,
      'Active Hold Queued',
      'You are #1 in the reservation queue for "Java Programming & Enterprise Systems".',
      'reservation'
    );
    insertNotif.run(
      s2,
      'Overdue Loan Notice',
      '"Java Programming & Enterprise Systems" is 6 days overdue. Please return promptly to restore borrowing privileges.',
      'overdue'
    );
    insertNotif.run(
      adm,
      '1 Overdue Item Requires Attention',
      'Student Arjun Mehta (CYB-2024-0819) has an overdue copy of "Java Programming & Enterprise Systems".',
      'overdue'
    );

    // Admin activity logs
    const insertLog = db.prepare(`
      INSERT INTO admin_activity (actor_id, actor_email, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertLog.run(adm, 'admin@smartlib.edu', 'SYSTEM_INITIALIZED', 'system', '1', 'Initialized SmartLib AI catalog with 15 textbooks and 5 digital archive resources.', '127.0.0.1');
    insertLog.run(adm, 'admin@smartlib.edu', 'BOOK_ISSUED', 'loan', '1', 'Issued "Effective Java (3rd Edition)" to Maya Lin (CS-2024-1042).', '127.0.0.1');
    insertLog.run(adm, 'admin@smartlib.edu', 'OVERDUE_FLAGGED', 'loan', '4', 'Flagged overdue loan #4 for Arjun Mehta (CYB-2024-0819).', '127.0.0.1');

    // Default system settings
    const insertSetting = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
    insertSetting.run('default_ai_mode', 'auto');
    insertSetting.run('loan_duration_days', '14');
    insertSetting.run('max_active_loans', '5');
    insertSetting.run('library_hours', 'Mon–Sat 07:30–22:00 · Sun 10:00–18:00');
  });

  seedTx();
}

export function refreshOverdueStatuses(): void {
  db.prepare(`
    UPDATE loans
    SET status = 'overdue'
    WHERE status = 'borrowed' AND datetime(due_date) < datetime('now')
  `).run();
}
