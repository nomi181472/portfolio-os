import Link from 'next/link';
import { cookies } from 'next/headers';

import {
  adminCookieName,
  adminLoginEnabled,
  verifySessionToken,
} from '@/lib/analytics/auth';

/**
 * Quiet top-right corner link to the private analytics view (§29). It renders
 * nothing while auth is disabled, so a default build is byte-identical to one
 * that never carried analytics. When enabled, this marker alone does what the
 * footer does too: it knows the server-side session, and picks the destination
 * without a single client decision - signed in, the dashboard; otherwise, the
 * sign-in page. The client can never widen this door; it only follows the href
 * this server component decided.
 */
export async function AdminCorner() {
  if (!adminLoginEnabled()) return null;
  const store = await cookies();
  const token = store.get(adminCookieName)?.value;
  const authed = token ? Boolean(verifySessionToken(token)) : false;
  const href = authed ? '/admin/dashboard' : '/admin/login';

  return (
    <Link
      href={href}
      aria-label={authed ? 'Analytics dashboard' : 'Analytics sign in'}
      title={authed ? 'Analytics dashboard' : 'Analytics sign in'}
      style={{
        position: 'fixed',
        top: 'var(--space-tight)',
        right: 'var(--space-tight)',
        zIndex: 60,
        display: 'grid',
        placeItems: 'center',
        width: 30,
        height: 30,
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-soft)',
        background: 'var(--bg-rail)',
        boxShadow: 'var(--shadow-faint)',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path d="M2 11 L5 6 L8 9 L11 3 L13 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
