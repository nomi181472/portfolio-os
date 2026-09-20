/**
 * lib/analytics/auth.ts
 *
 * Private admin auth (§29). Credentials live only in environment variables and
 * are never returned to the client or written to any store. A successful login
 * issues an HMAC-signed, HttpOnly, SameSite=Strict cookie; every admin page and
 * /api/analytics/admin/* route re-checks the signature + expiry.
 */
import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const COOKIE_NAME = 'analytics_session';
/** Read-only name of the admin session cookie — for route/action cookies(). */
export const adminCookieName = COOKIE_NAME;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function adminCredentials(): { email: string; password: string } | null {
  const email = process.env.ANALYTICS_ADMIN_EMAIL?.trim() ?? '';
  const password = process.env.ANALYTICS_ADMIN_PASSWORD ?? '';
  if (!email || !password) return null;
  return { email, password };
}

export function adminLoginEnabled(): boolean {
  return adminCredentials() !== null;
}

function secret(): string {
  const configured = process.env.ANALYTICS_ADMIN_SECRET?.trim();
  if (configured) return configured;
  const creds = adminCredentials();
  // Non-empty derived fallback so a missing secret cannot create empty-HMAC tokens.
  return createHash('sha256').update(`${creds?.email ?? ''}:${creds?.password ?? ''}`).digest('hex');
}

function digest(password: string): Buffer {
  return Buffer.from(createHash('sha256').update(`portfolio-analytics:${password}`).digest('binary'), 'binary');
}

/** Constant-time credential comparison using same-length SHA-256 hashes. */
export function verifyCredentials(email: string, password: string): boolean {
  const creds = adminCredentials();
  if (!creds) return false;
  const a = digest(`${creds.email}:${creds.password}`);
  const b = digest(`${email}:${password}`);
  return timingSafeEqual(a, b);
}

function hmac(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url');
}

export function issueSessionToken(email: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const body = `${email}\n${expiresAt}`;
  const encodedBody = Buffer.from(body).toString('base64url');
  const signature = hmac(encodedBody);
  return { token: `${encodedBody}.${signature}`, expiresAt };
}

export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return null;
  const body = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!body || !signature) return null;
  const expected = hmac(body);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  const decoded = Buffer.from(body, 'base64url').toString('utf8');
  const newline = decoded.indexOf('\n');
  const email = newline >= 0 ? decoded.slice(0, newline) : '';
  const rawExp = newline >= 0 ? decoded.slice(newline + 1) : '';
  const expiresAt = Number(rawExp);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return email;
}

/** Verify the analytics cookie value (or the raw cookie header). */
export function verifyCookie(cookieValue: string | null | undefined): string | null {
  return verifySessionToken(cookieValue);
}

/** Parse the analytics cookie out of a request cookie header. */
export function cookieFromHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
    `Max-Age=${SESSION_TTL_MS / 1000}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearCookieHeader(secure: boolean): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=0`;
}

/** One-shot random value, fine for storybook of token expiry flags. */
export function csrfNonce(): string {
  return randomBytes(16).toString('base64url');
}