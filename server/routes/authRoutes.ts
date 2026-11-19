import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.ts';
import {
  type AuthenticatedRequest,
  type AuthUser,
  SESSION_COOKIE_NAME,
  createSessionToken,
  getClientIp,
  getSessionToken,
  logAdminActivity,
  logLoginAttempt,
  requireAuth,
  verifySessionToken,
} from '../security.ts';

export const authRouter = Router();

function isHttpsRequest(req: import('express').Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  return req.secure || proto === 'https' || origin.startsWith('https://');
}

function getSessionCookieOptions(req: import('express').Request, rememberMe = true) {
  const secure = isHttpsRequest(req);
  return {
    httpOnly: true,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    secure,
    path: '/',
    ...(rememberMe ? { maxAge: 1000 * 60 * 60 * 24 * 7 } : {}),
  };
}

function setSessionCookie(
  req: import('express').Request,
  res: import('express').Response,
  token: string,
  rememberMe = true
): void {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(req, rememberMe));
}

authRouter.post('/register', (req, res) => {
  const { full_name, email, student_id, department, year_of_study, password } = req.body as Record<string, string>;

  if (!full_name?.trim() || !email?.trim() || !student_id?.trim() || !password) {
    res.status(400).json({ error: 'Full name, institutional email, student ID, and password are required.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedStudentId = student_id.trim().toUpperCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR student_id = ?').get(normalizedEmail, normalizedStudentId);
  if (existing) {
    res.status(409).json({ error: 'An account with that email or Student ID already exists.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const dept = (department || 'Computer Science').trim();
  const year = (year_of_study || '1st Year').trim();

  const insert = db.prepare(`
    INSERT INTO users (full_name, email, student_id, department, year_of_study, role, password_hash, status, last_login_at)
    VALUES (?, ?, ?, ?, ?, 'student', ?, 'active', datetime('now'))
  `).run(full_name.trim(), normalizedEmail, normalizedStudentId, dept, year, passwordHash);

  const user = db.prepare(`
    SELECT id, full_name, email, student_id, department, year_of_study, role, avatar_url, status
    FROM users WHERE id = ?
  `).get(Number(insert.lastInsertRowid)) as AuthUser;

  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, 'Welcome to SmartLib AI', 'Your student library account is active. You can borrow up to 5 books and query the AI Library Assistant in Online or Offline mode.', 'info')
  `).run(user.id);

  logLoginAttempt(user.id, user.email, user.role, 'success', req);
  logAdminActivity(user, 'STUDENT_REGISTERED', 'user', user.id, `New student registered: ${user.full_name} (${user.student_id})`, getClientIp(req));

  const { token, csrfToken } = createSessionToken(user);
  setSessionCookie(req, res, token);
  res.status(201).json({ user, csrfToken, sessionToken: token });
});

authRouter.post('/login', (req, res) => {
  const { email, password, portal, rememberMe } = req.body as {
    email?: string;
    password?: string;
    portal?: 'student' | 'admin';
    rememberMe?: boolean;
  };

  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Institutional email (or Student ID) and password are required.' });
    return;
  }

  const identifier = email.trim();
  const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR UPPER(student_id) = UPPER(?)').get(
    identifier,
    identifier
  ) as (AuthUser & { password_hash: string }) | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    if (row) {
      logLoginAttempt(row.id, row.email, row.role, 'failed', req);
    }
    res.status(401).json({ error: 'Invalid credentials. Please verify your email/Student ID and password.' });
    return;
  }

  if (row.status === 'suspended') {
    logLoginAttempt(row.id, row.email, row.role, 'failed', req);
    res.status(403).json({ error: 'Your library account is currently suspended. Contact the library administrator.' });
    return;
  }

  if (portal === 'admin' && row.role !== 'admin') {
    logLoginAttempt(row.id, row.email, row.role, 'failed', req);
    res.status(403).json({ error: 'This portal is restricted to authorized library administrators.' });
    return;
  }

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
  logLoginAttempt(row.id, row.email, row.role, 'success', req);

  const user: AuthUser = {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    student_id: row.student_id,
    department: row.department,
    year_of_study: row.year_of_study,
    role: row.role,
    avatar_url: row.avatar_url,
    status: row.status,
  };

  const { token, csrfToken } = createSessionToken(user);
  setSessionCookie(req, res, token, rememberMe !== false);
  res.json({ user, csrfToken, sessionToken: token });
});

authRouter.post('/logout', (req: AuthenticatedRequest, res) => {
  const opts = getSessionCookieOptions(req, false);
  res.clearCookie(SESSION_COOKIE_NAME, opts);
  res.json({ ok: true });
});

authRouter.get('/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.json({ user: null, csrfToken: null, sessionToken: null, unreadNotifications: 0 });
    return;
  }
  const token = getSessionToken(req);
  const session = verifySessionToken(token);
  const unread = (
    db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id) as { c: number }
  ).c;

  res.json({
    user: req.user,
    csrfToken: session?.csrf || null,
    sessionToken: token || null,
    unreadNotifications: unread,
  });
});

authRouter.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const { full_name, department, year_of_study } = req.body as {
    full_name?: string;
    department?: string;
    year_of_study?: string;
  };
  const user = req.user!;
  if (!full_name?.trim()) {
    res.status(400).json({ error: 'Full name cannot be empty.' });
    return;
  }

  db.prepare(`
    UPDATE users SET full_name = ?, department = ?, year_of_study = ? WHERE id = ?
  `).run(full_name.trim(), (department || user.department).trim(), (year_of_study || user.year_of_study).trim(), user.id);

  const updated = db.prepare(`
    SELECT id, full_name, email, student_id, department, year_of_study, role, avatar_url, status
    FROM users WHERE id = ?
  `).get(user.id) as AuthUser;

  res.json({ user: updated });
});

authRouter.put('/password', requireAuth, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Provide your current password and a new password of at least 8 characters.' });
    return;
  }

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as { password_hash: string };
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user!.id);
  res.json({ ok: true, message: 'Password updated successfully.' });
});

authRouter.get('/login-activity', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db.prepare(`
    SELECT id, email, role, ip_address, user_agent, status, created_at
    FROM login_activity
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(req.user!.id);
  res.json({ activity: rows });
});
