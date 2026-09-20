'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type LoginState } from '@/app/analytics/actions';

function Message({ state }: { state: LoginState }) {
  if (state.status === 'idle') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginTop: 'var(--space)',
        padding: 'var(--space-tight) var(--space)',
        background: 'var(--signal-wash)',
        border: 'var(--border-hair) solid var(--signal-quiet)',
        borderRadius: 'var(--radius-control)',
        fontSize: 'var(--text-small)',
        color: 'var(--signal)',
      }}
    >
      {state.message}
    </div>
  );
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    { status: 'idle' }
  );

  return (
    <form
      action={formAction}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space)',
        maxWidth: '28rem',
        background: 'var(--surface-raised)',
        padding: 'var(--space-loose)',
        border: 'var(--border-hair) solid var(--rule)',
        borderRadius: 'var(--radius-frame)',
        boxShadow: 'var(--lift)',
      }}
    >
      <div>
        <label
          htmlFor="email"
          style={{
            display: 'block',
            fontSize: 'var(--text-meta)',
            color: 'var(--ink-quiet)',
            marginBottom: 'var(--space-tight)',
          }}
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          style={{
            width: '100%',
            padding: 'var(--space-tight) var(--space-snug)',
            background: 'var(--surface-sunk)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--ink-bright)',
            fontSize: 'var(--text-body)',
            outline: 'none',
          }}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          style={{
            display: 'block',
            fontSize: 'var(--text-meta)',
            color: 'var(--ink-quiet)',
            marginBottom: 'var(--space-tight)',
          }}
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          style={{
            width: '100%',
            padding: 'var(--space-tight) var(--space-snug)',
            background: 'var(--surface-sunk)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--ink-bright)',
            fontSize: 'var(--text-body)',
            outline: 'none',
          }}
        />
      </div>

      <Message state={state} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'var(--space-tight)',
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: 'var(--space-tight) var(--space-loose)',
            background: 'var(--signal)',
            color: 'var(--surface-sunk)',
            border: 'none',
            borderRadius: 'var(--radius-control)',
            fontWeight: 500,
            fontSize: 'var(--text-small)',
            cursor: isPending ? 'wait' : 'pointer',
            opacity: isPending ? 0.7 : 1,
            transition: 'opacity var(--dur-quick) var(--ease-out)',
          }}
        >
          {isPending ? 'Verifying…' : 'Authenticate'}
        </button>

        <Link
          href="/"
          style={{
            fontSize: 'var(--text-small)',
            color: 'var(--ink-faint)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          Return to site
        </Link>
      </div>
    </form>
  );
}
