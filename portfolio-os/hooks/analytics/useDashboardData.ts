import { useState, useTransition } from 'react';
import type { Summary, SeriesPoint } from '@/lib/analytics/singleton';

export type TimeRangePreset = '24h' | '7d' | '30d' | 'all';
export type MetricChoice = 'visitors' | 'sessions' | 'pageViews' | 'clicks';

export function useDashboardData(
  initialSummary: Summary,
  initialTimeseries: SeriesPoint[],
  initialHourlyTimeseries: SeriesPoint[],
  deployments: { id: string; firstSeenAt: number }[]
) {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [timeseries, setTimeseries] = useState<SeriesPoint[]>(initialTimeseries);
  const [hourlyTimeseries, setHourlyTimeseries] = useState<SeriesPoint[]>(initialHourlyTimeseries);
  
  const [selectedRange, setSelectedRange] = useState<TimeRangePreset>('7d');
  const [selectedDeployment, setSelectedDeployment] = useState<string>(
    initialSummary.deployment?.id || (deployments[0]?.id ?? 'dev')
  );
  
  const [isPending, startTransition] = useTransition();

  const handleRangeOrDeploymentChange = (newRange: TimeRangePreset, newDep: string) => {
    setSelectedRange(newRange);
    setSelectedDeployment(newDep);

    startTransition(async () => {
      try {
        const now = Date.now();
        let from: number | undefined;
        let granularity: 'hour' | 'day' = 'day';

        if (newRange === '24h') {
          from = now - 24 * 60 * 60 * 1000;
          granularity = 'hour';
        } else if (newRange === '7d') {
          from = now - 7 * 24 * 60 * 60 * 1000;
          granularity = 'day';
        } else if (newRange === '30d') {
          from = now - 30 * 24 * 60 * 60 * 1000;
          granularity = 'day';
        }

        const query = new URLSearchParams();
        if (newDep) query.set('deploymentId', newDep);
        if (from) query.set('from', String(from));

        const [sumRes, timeRes, hourlyRes] = await Promise.all([
          fetch(`/api/analytics/admin/summary?${query.toString()}`),
          fetch(`/api/analytics/admin/timeseries?${query.toString()}&granularity=${granularity}`),
          fetch(`/api/analytics/admin/timeseries?${query.toString()}&granularity=hour`),
        ]);

        if (sumRes.ok) {
          const sumData = await sumRes.json();
          if (sumData.summary) setSummary(sumData.summary);
        }

        if (timeRes.ok) {
          const timeData = await timeRes.json();
          if (timeData.timeseries) setTimeseries(timeData.timeseries);
        }

        if (hourlyRes.ok) {
          const hourlyData = await hourlyRes.json();
          if (hourlyData.timeseries) setHourlyTimeseries(hourlyData.timeseries);
        }
      } catch (err) {
        console.error('Failed to update analytics filter', err);
      }
    });
  };

  return {
    summary,
    timeseries,
    hourlyTimeseries,
    selectedRange,
    selectedDeployment,
    isPending,
    handleRangeOrDeploymentChange
  };
}
