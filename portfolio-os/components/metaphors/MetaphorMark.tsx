/**
 * components/metaphors/MetaphorMark.tsx
 *
 * One drawing language for every category (§6, §7). All marks are built on the
 * same 24-unit grid with the same 1.25 hairline, the same square caps, and the
 * same rule: the mark describes the *object*, so that the object explains the
 * category. A flask means experiments. A caliper means instruments you measure
 * with. Nothing here was chosen because it looked good in a toolbar.
 *
 * Marks inherit `currentColor` so they survive the two-colour constraint
 * unchanged — they read as ink by default and turn brass when they mark the
 * current position.
 */

import type { MetaphorMark as MarkName } from '@/lib/categories';

const PATHS: Record<MarkName, { d: string; title: string }> = {
  // An object held inside a frame: a made thing, presented for inspection.
  artifact: {
    title: 'A finished object inside a display frame',
    d: 'M3 4h4M3 4v4M21 4h-4M21 4v4M3 20h4M3 20v-4M21 20h-4M21 20v-4M8.5 9.5h7v5h-7zM8.5 12h7M12 9.5v5',
  },
  // A flask with a level line: something being tried, with a measurable result.
  experiment: {
    title: 'A flask with a marked level line',
    d: 'M10 3v6.2L5.6 17.4A2 2 0 0 0 7.4 20.4h9.2a2 2 0 0 0 1.8-3L14 9.2V3M8.6 3h6.8M7.7 15h8.6',
  },
  // An open notebook, ruled: work in progress, written down as it happens.
  notebook: {
    title: 'An open notebook with ruled pages',
    d: 'M12 6.4v13M12 6.4C10.2 5.1 7.8 4.6 4 4.8v12.6c3.8-.2 6.2.3 8 1.6M12 6.4c1.8-1.3 4.2-1.8 8-1.6v12.6c-3.8-.2-6.2.3-8 1.6M6.6 8.7h3M6.6 11.4h3M14.4 8.7h3M14.4 11.4h3',
  },
  // A route with stations: a journey with places you stopped and did work.
  route: {
    title: 'A route with marked stations',
    d: 'M3 18.5h4.2l3.3-7.4 3.2 4.2 2.4-9.8H21',
  },
  // Layers bearing load: what everything above is standing on.
  foundation: {
    title: 'Load-bearing layers',
    d: 'M4 18.5h16M6 14.8h12M8.5 11h7M10.8 7.3h2.4M4 21h16',
  },
  // A caliper: the instrument you reach for when precision matters.
  instrument: {
    title: 'A caliper measuring a workpiece',
    d: 'M4 4v13.5M20 4v13.5M4 17.5h16M9 4v9M15 4v9M9 13h6M11.4 20.5h1.2',
  },
  // Shelved spines: things that were published and can be cited.
  library: {
    title: 'Shelved volumes',
    d: 'M4 5.5h3v13H4zM9 5.5h3v13H9zM14.6 6.2l2.9.8-3.4 12.5-2.9-.8zM3 21h18',
  },
  // A seal with a notch: issued by someone, checkable by anyone.
  seal: {
    title: 'An issued seal',
    d: 'M12 3l7.4 4.3v8.6L12 20.2 4.6 15.9V7.3zM9 11.7l2.2 2.2 4.1-4.5',
  },
  // A marker post on a route: you passed this point.
  milestone: {
    title: 'A marker post',
    d: 'M7 3.5v17M7 5h10.5l-2.4 3.2 2.4 3.2H7',
  },
  // A hub with edges: coordination, not headcount.
  network: {
    title: 'A hub connected to nodes',
    d: 'M12 12m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0M5 5m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0M19 5m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0M5 19m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0M19 19m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0M6.2 6.2l4 4M17.8 6.2l-4 4M6.2 17.8l4-4M17.8 17.8l-4-4',
  },
  // Effort converging on one point: what you gave to something shared.
  contribution: {
    title: 'Contributions converging on a point',
    d: 'M12 13.2v7.3M3.5 4.5l7.3 7.3M20.5 4.5l-7.3 7.3M8.6 20.5h6.8M12 11.3a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6',
  },
  // A signal carried on a channel: language as something being transmitted.
  channel: {
    title: 'A signal across a channel',
    d: 'M3 12h2.6l1.8-5.6 2.4 11.2 2.4-8.4 1.9 5.6 1.5-2.8H21',
  },
  // An arc past a horizon: where the work is heading, not where it has been.
  trajectory: {
    title: 'An arc rising past a horizon',
    d: 'M3 17.5h18M3.5 20C6 10.8 12.2 5.4 20.5 4M20.5 4l-4.3.4M20.5 4l-.5 4.2',
  },
  // A sealed chamber with something rising in it: an idea under conditions.
  incubator: {
    title: 'A chamber with something rising inside',
    d: 'M5 8.5h14v11.5H5zM5 8.5L7.5 4h9L19 8.5M12 17.5v-5M12 12.5l-2 2M12 12.5l2 2',
  },
  // Two layered sheets: copy or duplicate this system.
  copy: {
    title: 'Copy or fork this portfolio OS',
    d: 'M8 4h10a2 2 0 0 1 2 2v10M6 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z',
  },
};

export interface MetaphorMarkProps {
  name: MarkName;
  size?: number;
  /** Set when the mark stands in for the category and needs a name. */
  labelled?: boolean;
  className?: string;
}

export function MetaphorMark({ name, size = 20, labelled = false, className }: MetaphorMarkProps) {
  const mark = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      role={labelled ? 'img' : 'presentation'}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? mark.title : undefined}
      focusable="false"
    >
      <path d={mark.d} />
    </svg>
  );
}
