'use client';

/**
 * components/offline/OfflineProvider.tsx
 *
 * Provides:
 * 1. Automatic Service Worker registration so all Next.js static JS chunks,
 *    media, and visited pages are cached offline.
 * 2. Visual "Offline Mode — Cached Portfolio" top banner with download/loading indicator
 *    when network disconnects.
 * 3. Graceful notification instead of app crash or blank screen.
 */

import { useEffect, useState } from 'react';

export function OfflineProvider() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Register service worker if supported
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Service worker registration failed or unsupported in iframe/sandbox
        });
      });
    }

    // 2. Network status monitoring
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--surface-sunken, #1c1c1e)',
        borderBottom: '1px solid var(--rule-strong, #3a3a3c)',
        color: 'var(--ink-bright, #f5f5f7)',
        padding: '8px 16px',
        fontSize: '0.8125rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--signal-warn, #f5a623)',
          boxShadow: '0 0 6px var(--signal-warn, #f5a623)',
        }}
      />
      <span>
        <strong>Offline mode:</strong> You are currently disconnected. Cached portfolio content is being loaded.
      </span>
    </aside>
  );
}
