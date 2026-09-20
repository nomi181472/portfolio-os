'use client';

/**
 * components/analytics/Provider.tsx
 *
 * Client analytics coordinator component mounted in the root layout (§42).
 * Integrates page views, scroll depth, click delegation, section intersection,
 * Web Vitals, and periodic heartbeats seamlessly.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getClientTracker } from '@/lib/analytics/client';
import { SectionObserver } from '@/lib/analytics/sections';
import { observePerformance } from '@/lib/analytics/performance';
import { SCROLL_BUCKETS } from '@/lib/analytics/shared';

export function AnalyticsProvider() {
  const pathname = usePathname();
  const prevPathRef = useRef<string>('');
  const reachedScrollBucketsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const tracker = getClientTracker();
    tracker.init();

    // 1. Section observer
    const sectionObserver = new SectionObserver();
    const cleanupSections = sectionObserver.init();

    // 2. Performance observer
    const cleanupPerf = observePerformance();

    // 3. Heartbeat interval (20s)
    const heartbeatTimer = window.setInterval(() => {
      tracker.heartbeat();
    }, 20_000);

    // 4. Global Click Delegation (§18, §19, §26)
    const handleClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-analytics-id], a, button'
      );
      if (!el) return;

      const targetId =
        el.getAttribute('data-analytics-id') ||
        el.getAttribute('id') ||
        el.getAttribute('href') ||
        el.textContent?.trim().slice(0, 32);

      if (!targetId) return;

      const targetType = el.getAttribute('data-analytics-type') || 'other';
      const namespace = el.getAttribute('data-analytics-namespace') || 'ui';
      const sectionEl = el.closest<HTMLElement>('[data-analytics-section]');
      const section = sectionEl?.getAttribute('data-analytics-section') || undefined;

      if (
        targetId.toLowerCase().includes('resume') ||
        el.getAttribute('href')?.endsWith('.pdf') ||
        el.getAttribute('data-analytics-action') === 'resume'
      ) {
        tracker.resumeDownload(targetId);
      } else {
        tracker.click(targetId, namespace, section);
      }
    };

    document.addEventListener('click', handleClick, { capture: true });

    // 5. Scroll Depth Observer (§24)
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const scrollPercent = Math.round((window.scrollY / docHeight) * 100);

      for (const bucket of SCROLL_BUCKETS) {
        if (scrollPercent >= bucket && !reachedScrollBucketsRef.current.has(bucket)) {
          reachedScrollBucketsRef.current.add(bucket);
          tracker.scrollDepth(bucket);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      cleanupSections();
      cleanupPerf();
      clearInterval(heartbeatTimer);
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Track page transitions (§43)
  useEffect(() => {
    if (!pathname) return;
    if (pathname !== prevPathRef.current) {
      reachedScrollBucketsRef.current.clear();
      getClientTracker().pageView(pathname, prevPathRef.current || undefined);
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  return null;
}
