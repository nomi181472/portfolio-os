/**
 * lib/analytics/sections.ts
 *
 * Section engagement tracker using IntersectionObserver (§17).
 * Identifies when a section reaches 50% visibility and stays for >= 1.5s.
 */
import { getClientTracker } from './client';

interface VisibleSection {
  sectionId: string;
  enteredAt: number;
  qualifyingTimer: number | null;
  recordedView: boolean;
}

export class SectionObserver {
  private observer: IntersectionObserver | null = null;
  private activeSections = new Map<Element, VisibleSection>();
  private threshold = 0.5;
  private minDurationMs = 1500;

  init(): () => void {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return () => {};
    }

    const tracker = getClientTracker();

    this.observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const entry of entries) {
          const target = entry.target;
          const sectionId = target.getAttribute('data-analytics-section');
          if (!sectionId) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= this.threshold) {
            if (!this.activeSections.has(target)) {
              tracker.sectionEnter(sectionId);

              // Timer to qualify as a meaningful section_view
              const qualifyingTimer = window.setTimeout(() => {
                const active = this.activeSections.get(target);
                if (active && !active.recordedView) {
                  active.recordedView = true;
                  const dur = Date.now() - active.enteredAt;
                  tracker.sectionView(sectionId, dur);
                }
              }, this.minDurationMs);

              this.activeSections.set(target, {
                sectionId,
                enteredAt: now,
                qualifyingTimer,
                recordedView: false,
              });
            }
          } else {
            const active = this.activeSections.get(target);
            if (active) {
              if (active.qualifyingTimer) {
                clearTimeout(active.qualifyingTimer);
              }
              const totalDuration = now - active.enteredAt;
              tracker.sectionExit(sectionId, totalDuration);

              // If it stayed longer than min duration but view hadn't fired yet
              if (!active.recordedView && totalDuration >= this.minDurationMs) {
                tracker.sectionView(sectionId, totalDuration);
              }

              this.activeSections.delete(target);
            }
          }
        }
      },
      {
        threshold: [0, 0.5, 1.0],
      }
    );

    this.observeAll();

    // Re-scan when new DOM elements mount
    const mutationObserver = new MutationObserver(() => {
      this.observeAll();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      this.observer?.disconnect();
      mutationObserver.disconnect();
      this.activeSections.clear();
    };
  }

  private observeAll(): void {
    if (!this.observer) return;
    const elements = document.querySelectorAll('[data-analytics-section]');
    elements.forEach((el) => {
      this.observer?.observe(el);
    });
  }
}
