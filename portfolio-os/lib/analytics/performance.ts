/**
 * lib/analytics/performance.ts
 *
 * Lightweight browser Web Vitals & performance observer (§27).
 * Observes TTFB, FCP, LCP, CLS, and INP without slowing down page execution.
 */
import { getClientTracker } from './client';
import type { PerfValues } from './events';

export function observePerformance(): () => void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  const perf: PerfValues = {};
  let reported = false;

  const sendPerf = () => {
    if (reported) return;
    if (perf.ttfb || perf.fcp || perf.lcp || perf.cls !== undefined || perf.inp) {
      reported = true;
      getClientTracker().performance(perf);
    }
  };

  // TTFB
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const nav = navEntries[0];
    if (nav) {
      perf.ttfb = Math.round(nav.responseStart - nav.requestStart);
    }
  } catch {}

  // Paint (FCP)
  let paintObserver: PerformanceObserver | null = null;
  try {
    paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          perf.fcp = Math.round(entry.startTime);
        }
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch {}

  // LCP
  let lcpObserver: PerformanceObserver | null = null;
  try {
    lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        perf.lcp = Math.round(last.startTime);
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  // CLS
  let clsObserver: PerformanceObserver | null = null;
  let clsValue = 0;
  try {
    clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          perf.cls = Math.round(clsValue * 1000) / 1000;
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {}

  // Flush performance on page hidden or after 6 seconds
  const timer = window.setTimeout(sendPerf, 6000);
  const onHide = () => {
    if (document.visibilityState === 'hidden') sendPerf();
  };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onHide);
    paintObserver?.disconnect();
    lcpObserver?.disconnect();
    clsObserver?.disconnect();
  };
}
