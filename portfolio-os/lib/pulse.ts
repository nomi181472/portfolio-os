/**
 * lib/pulse.ts
 *
 * The travelling wave a date runs when it wants to be looked at. All the
 * arithmetic lives here rather than in the component so it can be tested
 * without a DOM (§101: one place decides how a period reads, one place decides
 * how a period moves).
 *
 * The rule the effect is built on: a pulse is a nudge, never a reveal. Every
 * character is painted from the first frame; what travels is the energy, not
 * the text. So the only thing timing has to get right is how long the whole
 * thing takes and how far apart two neighbours start.
 */

/** Wall-clock budget for the stagger across the whole string. */
const SWEEP_BUDGET_MS = 760;

/** One character's own motion. Long enough to settle, short enough to overlap. */
export const PULSE_CHAR_MS = 340;

/**
 * A real range is 24 characters; a bare year is 4. The step is stretched or
 * compressed to fit the same sweep, then clamped so a short string still reads
 * as a wave rather than a jump-cut.
 */
const STEP_MIN_MS = 22;
const STEP_MAX_MS = 40;

/** Between the first pass and the quiet second one. */
export const PULSE_REPEAT_DELAY_MS = 6000;

/** How far apart two dates in the same batch start, and how far the cascade runs. */
const STAGGER_STEP_MS = 55;
const STAGGER_MAX_MS = 360;

/**
 * A wall of dates reaching the viewport together should cascade, not pulse as
 * one block. Index is the date's position in its list; the cap stops a long
 * list from leaving the last rows waiting.
 */
export function pulseStagger(index: number): number {
  return Math.min(Math.max(index, 0) * STAGGER_STEP_MS, STAGGER_MAX_MS);
}

export interface PulseTiming {
  /** Characters in the string, by code point. */
  length: number;
  /** Distance between consecutive character starts, in ms. */
  step: number;
  /** One character's motion, in ms. */
  char: number;
  /** Sweep + settle: when the last character is back to rest, in ms. */
  total: number;
}

export function pulseTiming(text: string): PulseTiming {
  // Array.from splits by code point, so an em dash stays one glyph and a
  // surrogate pair (if a locale ever adds one) is never cut in half.
  const length = Array.from(text).length;
  const char = PULSE_CHAR_MS;

  if (length <= 1) {
    return { length, step: 0, char, total: char };
  }

  const ideal = Math.round(SWEEP_BUDGET_MS / (length - 1));
  const step = Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, ideal));

  return { length, step, char, total: step * (length - 1) + char };
}

/**
 * The rest state is never declared, only reached. This is the constant the
 * keyframes use to sit still; it is deliberately a full transform list and a
 * full filter list so it interpolates cleanly against the peak.
 */
export const PULSE_REST = {
  y: '0px',
  scale: '1',
  rotate: '0deg',
  blur: '0px',
  brightness: '1',
} as const;
