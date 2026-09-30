/**
 * tests/pulse.test.ts
 *
 * The date pulse is the one place in the interface where typography is
 * deliberately moved. Two things therefore have to hold, and neither is visible
 * in a screenshot: the string is never altered, and the wave is never long
 * enough to become something a visitor waits for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { pulseTiming, pulseStagger, PULSE_CHAR_MS, PULSE_REPEAT_DELAY_MS } from '../lib/pulse';
import { formatDate, formatPeriod } from '../lib/format';

const RANGES = [
  '2026',
  'Sep 2026',
  '1 Jan 2026',
  '1 Jan 2026 — 31 Mar 2026',
  '1 Nov 2024 — 31 Mar 2025',
  '1 Nov 2025 — present',
  '2022 — 2023',
];

test('a real range sweeps in under 1.2s and still reads as a sequence', () => {
  for (const range of RANGES) {
    const { step, total, char } = pulseTiming(range);
    assert.equal(char, PULSE_CHAR_MS, 'a character\'s own motion is fixed');
    assert.ok(
      total <= 1200,
      `"${range}" takes ${total}ms, which is long enough to feel like a wait`,
    );
    // Neighbouring characters must overlap, or it is a queue and not a wave.
    assert.ok(step < char, `"${range}" steps ${step}ms against a ${char}ms motion`);
  }
});

test('the sweep is compressed as the string gets longer, never stretched', () => {
  const short = pulseTiming('1 Jan 2026');
  const long = pulseTiming('1 Jan 2026 — 31 Mar 2026');
  assert.ok(long.step <= short.step, 'a longer date steps no faster per character');
  assert.ok(long.total > short.total, 'a longer date takes longer to finish');
});

test('step and total stay inside their clamps', () => {
  for (const range of RANGES) {
    const { step, total, length } = pulseTiming(range);
    assert.ok(step >= 22 && step <= 40, `step ${step}ms for "${range}" is out of range`);
    assert.ok(
      total === step * (length - 1) + PULSE_CHAR_MS,
      `total ${total}ms for "${range}" does not match its own sweep`,
    );
  }
});

test('a string of one character still has a motion, and a delay of zero', () => {
  const single = pulseTiming('7');
  assert.equal(single.step, 0);
  assert.equal(single.total, PULSE_CHAR_MS);
});

test('an empty string cannot divide by zero', () => {
  const empty = pulseTiming('');
  assert.equal(empty.length, 0);
  assert.equal(empty.step, 0);
  assert.equal(empty.total, PULSE_CHAR_MS);
});

test('the separator is one character, so the wave steps over it rather than through it', () => {
  // An em dash is BMP, but code-point splitting is what guarantees the glyph
  // count the stagger was computed from is the glyph count that gets rendered.
  const range = formatPeriod({ ongoing: false, startDate: '2026-01-01', endDate: '2026-03-31' });
  assert.equal(range, '1 Jan 2026 — 31 Mar 2026');
  assert.equal(Array.from(range).length, pulseTiming(range).length);
});

test('the quiet second pass is a pause, not a loop', () => {
  assert.ok(PULSE_REPEAT_DELAY_MS > 5000, 'it has to outlast the impulse to read as a repeat');
  assert.ok(
    PULSE_REPEAT_DELAY_MS > pulseTiming('1 Jan 2026 — 31 Mar 2026').total,
    'the first pass must be finished before the second begins',
  );
});

test('a batch of dates cascades instead of pulsing as one block', () => {
  assert.equal(pulseStagger(0), 0, 'the first date waits for nobody');
  assert.equal(pulseStagger(1), 55);
  assert.equal(pulseStagger(4), 220);
  // Strictly increasing, so the cascade is visible as a cascade.
  for (let i = 1; i < 6; i++) assert.ok(pulseStagger(i) > pulseStagger(i - 1));
  // Capped, so a long list does not leave its last row waiting on a timer.
  assert.equal(pulseStagger(1000), 360);
  assert.equal(pulseStagger(-5), 0, 'a negative index is not a delay');
  // A capped cascade must still finish inside the same feel as one pass.
  assert.ok(pulseStagger(1000) + pulseTiming('1 Jan 2026 — 31 Mar 2026').total < 2000);
});

test('the dates the site actually renders all fit the budget', () => {
  for (const value of ['2026-01-01', '2024-11', '2022']) {
    const text = formatDate(value);
    assert.ok(text.length > 0, `${value} should format to something`);
    assert.ok(pulseTiming(text).total <= 1200, `"${text}" overruns the budget`);
  }
});
