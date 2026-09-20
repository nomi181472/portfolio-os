'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ScrollManager: Bulletproof scroll positioning across Next.js App Router navigations.
 *
 * Solves:
 * 1. Navigating between dynamic routes (e.g. /skills/[slug] <-> /skills)
 *    where Next.js reuses layout segments and leaves the previous page's scroll
 *    position (e.g. stuck at the bottom).
 * 2. Going back via browser history, mobile swipe back, or breadcrumbs.
 *    By disabling automatic browser scrollRestoration and enforcing top (0, 0)
 *    scroll across DOM paint frames, the user always lands at the top of the page.
 */
export function ScrollManager() {
  const pathname = usePathname();
  const prevPathRef = useRef<string>(pathname);

  useEffect(() => {
    // Set manual scroll restoration so the browser doesn't randomly restore stale bottom coordinates
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      try {
        window.history.scrollRestoration = 'manual';
      } catch {
        /* ignore */
      }
    }

    const resetScroll = () => {
      // If there's an explicit hash in the URL, don't override it
      if (window.location.hash) {
        const el = document.getElementById(window.location.hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'instant' });
          return;
        }
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    const handlePopState = () => {
      resetScroll();
      requestAnimationFrame(resetScroll);
      setTimeout(resetScroll, 20);
      setTimeout(resetScroll, 80);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!pathname) return;

    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    // Check if there is an explicit URL hash
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.slice(1);
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'instant' });
        return;
      }
    }

    // Always reset to top when navigating between pages
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    resetScroll();
    requestAnimationFrame(() => {
      resetScroll();
      requestAnimationFrame(resetScroll);
    });
    const t1 = setTimeout(resetScroll, 20);
    const t2 = setTimeout(resetScroll, 80);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  return null;
}
