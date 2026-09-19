/**
 * lib/format.ts
 *
 * Dates live in the JSON as ISO-ish strings and are formatted only here (§101),
 * so changing how a period reads never means editing a component.
 */
import type { Period } from '@/types/portfolio';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(value?: string, opts: { precision?: 'year' | 'month' | 'day' } = {}): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year) return '';
  if (!month || opts.precision === 'year') return year;
  const monthLabel = MONTHS[Number(month) - 1] ?? month;
  if (!day || opts.precision === 'month') return `${monthLabel} ${year}`;
  return `${Number(day)} ${monthLabel} ${year}`;
}

export function formatPeriod(period?: Period): string {
  if (!period) return '';
  const start = formatDate(period.startDate);
  if (period.ongoing) return start ? `${start} — present` : 'Present';
  const end = formatDate(period.endDate);
  if (start && end) return start === end ? start : `${start} — ${end}`;
  return start || end || '';
}

/** Rough duration, for an experience entry. Deliberately coarse. */
export function durationInMonths(period?: Period): number | undefined {
  if (!period?.startDate) return undefined;
  const parse = (value: string) => {
    const [y, m] = value.split('-');
    return { y: Number(y), m: m ? Number(m) - 1 : 0 };
  };
  const start = parse(period.startDate);
  const endSource = period.ongoing || !period.endDate ? undefined : period.endDate;
  const end = endSource ? parse(endSource) : { y: new Date().getFullYear(), m: new Date().getMonth() };
  return Math.max(0, (end.y - start.y) * 12 + (end.m - start.m));
}

export function formatDuration(period?: Period): string {
  const months = durationInMonths(period);
  if (months === undefined) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${Math.max(1, rest)} mo`;
  if (rest === 0) return `${years} yr`;
  return `${years} yr ${rest} mo`;
}

/** Sentence-case a hyphenated enum value: `in-development` -> `In development`. */
export function humanise(value: string): string {
  const spaced = value.replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
