'use client';

/**
 * components/entity/PeriodPulse.tsx
 *
 * A date that wants to be looked at.
 *
 * The whole text is in the DOM and painted from the first frame — there is no
 * reveal here, no masking, and no character that arrives late. What travels is
 * the energy: a wave that lifts, brightens and settles each character in turn
 * and then leaves the typography exactly as it found it.
 *
 * Splitting the string is the only structural thing this component does, and it
 * is invisible to everything that reads text. The spans are adjacent in the
 * markup with no whitespace between them, so `textContent`, `getSelection`,
 * copy-paste, and anything indexing the page all still see the original string.
 * The wrapper keeps the caller's class, so the date is set in `.meta` exactly as
 * it always was and the wave only ever touches rendering.
 *
 * Two triggers, both of them deliberate. The wave runs once when the date first
 * scrolls into view — quietly, a third of the volume, six seconds later — and
 * again whenever the date or the row containing it is pointed at or focused.
 * Nothing here loops.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { pulseTiming, PULSE_REPEAT_DELAY_MS } from '@/lib/pulse';
import styles from './PeriodPulse.module.css';

/** Custom properties are set inline; `CSSProperties` has no index signature. */
type PulseVars = CSSProperties & {
  '--i': number;
  '--pulse-dur': string;
  '--pulse-step': string;
};

type PulseState = 'idle' | 'view' | 'repeat';

/** Slack between the last character settling and the pass being retired. */
const SETTLE_MS = 80;

interface PeriodPulseProps {
  text: string;
  className?: string;
  /**
   * Extra milliseconds before the first pass starts, so a batch of dates that
   * reaches the viewport together cascades instead of pulsing as one block.
   */
  stagger?: number;
  /** The quieter second pass. Off for a wall of dates; on for one date. */
  repeat?: boolean;
}

export function PeriodPulse({ text, className, stagger = 0, repeat = false }: PeriodPulseProps) {
  const glyphs = useMemo(() => Array.from(text), [text]);
  const timing = useMemo(() => pulseTiming(text), [text]);

  const [state, setState] = useState<PulseState>('idle');
  const nodeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || glyphs.length === 0) return;
    // Read in the effect, never during render, so the server and client agree
    // on the markup. The stylesheet already removes the animation under reduced
    // motion; this only avoids the observer and the timers.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let done = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    const observer = new IntersectionObserver(
      (entries) => {
        if (done) return;
        if (!entries.some((entry) => entry.isIntersecting)) return;

        // One pass per date, however the visitor arrives at it.
        observer.disconnect();

        const first = timing.total + SETTLE_MS;
        after(stagger, () => setState('view'));
        after(stagger + first, () => setState('idle'));

        if (repeat) {
          const second = PULSE_REPEAT_DELAY_MS;
          after(stagger + first + second, () => setState('repeat'));
          after(stagger + first + second + first, () => setState('idle'));
        }
      },
      // Enough of the date on screen to be read, not merely touched by the edge
      // of the viewport on the way past.
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      done = true;
      observer.disconnect();
      timers.forEach(window.clearTimeout);
    };
  }, [glyphs.length, repeat, stagger, timing.total]);

  if (glyphs.length === 0) return null;

  return (
    <span
      ref={nodeRef}
      className={className ? `${className} ${styles.run}` : styles.run}
      data-state={state}
      style={{ '--pulse-dur': `${timing.char}ms`, '--pulse-step': `${timing.step}ms` } as PulseVars}
    >
      {glyphs.map((glyph, index) => (
        <span
          // Index, not the character: "1 Jan 2026" repeats its digits.
          key={index}
          className={styles.glyph}
          style={{ '--i': index } as PulseVars}
        >
          {glyph}
        </span>
      ))}
    </span>
  );
}
