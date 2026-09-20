'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { loginAction, type LoginState } from '../actions';

function Message({ state }: { state: LoginState }) {
  if (state.status === 'idle') return null;
  return (
    <p className="notice" role="status" aria-live="polite" style={{ marginTop: 'var(--space-loose)' }}>
      {state.message}
    </p>
  );
}

/**
 * Admin login (§29): the only page that accepts credentials, and they are
 * compared in constant time against ANALYTICS_ADMIN_EMAIL / ANALYTICS_ADMIN_PASSWORD
 * before an HttpOnly session cookie is issued. No credentials ever reach the
 * client, the store, or any log.
 */
export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {
    status: 'idle',
  });

  return (
    <div className="page">
      <header style={{ marginTop: 'var(--space)', marginBottom: 'var(--space-loose)' }}>
        <h1 className="heading">Sign in</h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          Private analytics. Credentials are configured only in environment
          variables and never stored or served.
        </p>
      </header>

      <form action={formAction} className="stack" style={{ maxWidth: '28rem' }}>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" className="field" autoComplete="email" required />

        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />

        <button type="submit" className="control" data-emphasis="signal" style={{ justifySelf: 'start' }}>
          Sign in
        </button>

        <Message state={state} />

        <p className="meta" style={{ marginTop: 'var(--space-snug)' }}>
          <Link className="link" href="/">
            Back to the portfolio
          </Link>
        </p>
      </form>
    </div>
  );
}
