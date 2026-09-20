/**
 * lib/analytics/metrics.ts
 *
 * Derived metrics (§9, §32, §35): everything that answers "how often does the
 * same visitor appear". Operates on the bounded LRU snapshot, never on history.
 */
export interface VisitorObs {
  sessions: number;
  days: Set<string>;
}

export function averageSessionDurationMs(totalMs: number, samples: number): number {
  return samples > 0 ? Math.round(totalMs / samples) : 0;
}

export function returningPercent(returningSessions: number, totalSessions: number): number {
  return totalSessions > 0 ? Math.round((returningSessions / totalSessions) * 1000) / 10 : 0;
}

function isoWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * 86_400_000);
  const firstDay = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - firstDay.getTime()) / 86_400_000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function analyse(visitors: VisitorObs[]) {
  let sumSessions = 0;
  let sumDays = 0;
  const weeks = new Set<string>();
  const distribution = Array.from({ length: 5 }, () => 0); // 1, 2, 3, 4, 5+
  for (const v of visitors) {
    const sessions = Math.max(1, v.sessions);
    sumSessions += sessions;
    sumDays += v.days.size;
    for (const day of v.days) weeks.add(isoWeek(day));
    const bucket = Math.min(4, sessions - 1);
    distribution[bucket] = (distribution[bucket] ?? 0) + 1;
  }
  return { sumSessions, sumDays, weeks, distribution };
}

export interface FrequencySummary {
  count: number;
  averageVisitsPerVisitor: number;
  averageDailyAppearances: number;
  averageWeeklyAppearances: number;
  distribution: number[]; // index 0 = 1 visit … index 4 = 5+ visits
}

/** Frequency + "average daily appearances" from the bounded visitor LRU. */
export function frequencySummary(visitors: VisitorObs[]): FrequencySummary {
  const { sumSessions, sumDays, weeks, distribution } = analyse(visitors);
  const count = Math.max(1, visitors.length);
  return {
    count: visitors.length,
    averageVisitsPerVisitor: Math.round((sumSessions / count) * 100) / 100,
    averageDailyAppearances: Math.round((sumDays / count) * 100) / 100,
    averageWeeklyAppearances: Math.round((weeks.size / count) * 100) / 100,
    distribution,
  };
}

/** Blend frequency characteristics across two windows (unchanged otherwise). */
export function mergeFrequency(a: FrequencySummary, b: FrequencySummary): FrequencySummary {
  const total = a.count + b.count;
  if (total === 0) return a;
  const weighted = (x: number, y: number) => Math.round((x * a.count + y * b.count) / total * 100) / 100;
  return {
    count: total,
    averageVisitsPerVisitor: weighted(a.averageVisitsPerVisitor, b.averageVisitsPerVisitor),
    averageDailyAppearances: weighted(a.averageDailyAppearances, b.averageDailyAppearances),
    averageWeeklyAppearances: weighted(a.averageWeeklyAppearances, b.averageWeeklyAppearances),
    distribution: a.distribution.map((value, i) => value + (b.distribution[i] ?? 0)),
  };
}