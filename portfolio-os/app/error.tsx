'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors
    console.error('App runtime error caught by boundary:', error);
  }, [error]);

  const isNetworkError =
    !navigator.onLine ||
    error.message?.includes('fetch') ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('Failed to fetch');

  return (
    <div className="page" style={{ padding: 'var(--space-loose) var(--space)', maxWidth: '640px' }}>
      <h1 className="heading">
        {isNetworkError ? 'Network Disconnected' : 'Something went wrong'}
      </h1>
      <p className="lead" style={{ marginTop: 'var(--space)' }}>
        {isNetworkError
          ? 'It looks like your internet connection dropped while downloading the requested section. Please reconnect your Wi-Fi/network and retry.'
          : 'An unexpected error occurred while loading this view.'}
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-snug)', marginTop: 'var(--space-loose)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="control"
          onClick={() => reset()}
          style={{ cursor: 'pointer' }}
        >
          Try Again
        </button>
        <Link className="control" href="/">
          Back to surface
        </Link>
      </div>
    </div>
  );
}
