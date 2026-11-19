import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('smartlib-ai-dev-secret-key-2026').digest('hex');
export const SESSION_COOKIE_NAME = 'smartlib_session';

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  student_id: string | null;
  department: string;
  year_of_study: string;
  role: 'student' | 'admin';
  avatar_url: string | null;
  status: 'active' | 'suspended';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface SessionPayload {
  uid: number;
  role: 'student' | 'admin';
  csrf: string;
  exp: number;
}

function signPayload(payloadB64: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
}

export function createSessionToken(user: AuthUser): { token: string; csrfToken: string } {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const payload: SessionPayload = {
    uid: user.id,
    role: user.role,
    csrf: csrfToken,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayload(payloadB64);
  return { token: `${payloadB64}.${signature}`, csrfToken };
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expectedSig = signPayload(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function extractBearerToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    return token || undefined;
  }
  return undefined;
}

export function getSessionToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (cookieToken) return cookieToken;
  return extractBearerToken(req);
}

export function attachAuthContext(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = getSessionToken(req);
  const session = verifySessionToken(token);
  if (!session) {
    return next();
  }

  const user = db.prepare(`
    SELECT id, full_name, email, student_id, department, year_of_study, role, avatar_url, status
    FROM users WHERE id = ?
  `).get(session.uid) as AuthUser | undefined;

  if (user && user.status === 'active') {
    req.user = user;
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required for this operation.' });
    return;
  }
  next();
}

export function verifyCsrf(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!cookieToken) {
    // Public auth endpoints (login/register) or Bearer-authenticated API calls do not rely on cookie auth
    return next();
  }
  const session = verifySessionToken(cookieToken);
  if (!session) {
    return next();
  }
  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || headerToken !== session.csrf) {
    res.status(403).json({ error: 'Invalid or missing CSRF security token.' });
    return;
  }
  next();
}

export function logAdminActivity(
  actor: AuthUser | null,
  action: string,
  entityType: string,
  entityId: string | number | null,
  details: string,
  ipAddress = '127.0.0.1'
): void {
  db.prepare(`
    INSERT INTO admin_activity (actor_id, actor_email, action, entity_type, entity_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    actor?.id ?? null,
    actor?.email ?? 'system@smartlib.edu',
    action,
    entityType,
    entityId !== null ? String(entityId) : null,
    details,
    ipAddress
  );
}

export function logLoginAttempt(
  userId: number,
  email: string,
  role: string,
  status: 'success' | 'failed',
  req: Request
): void {
  db.prepare(`
    INSERT INTO login_activity (user_id, email, role, ip_address, user_agent, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    email,
    role,
    getClientIp(req),
    String(req.headers['user-agent'] || 'Web Client').slice(0, 180),
    status
  );
}
