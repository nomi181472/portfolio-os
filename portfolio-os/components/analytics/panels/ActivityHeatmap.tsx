'use client';

import { HeatmapChart } from '../charts/HeatmapChart';
import type { SeriesPoint } from '@/lib/analytics/singleton';

interface ActivityHeatmapProps {
  hourlyTimeseries: SeriesPoint[];
}

export function ActivityHeatmap({ hourlyTimeseries }: ActivityHeatmapProps) {
  return (
    <section
      style={{
        background: 'var(--surface-raised)',
        border: 'var(--border-hair) solid var(--rule)',
        borderRadius: 'var(--radius-frame)',
        padding: 'var(--space-loose)',
      }}
    >
      <HeatmapChart
        hourlyData={hourlyTimeseries}
        title="Weekly Activity Pattern (7 Days × 24 Hours)"
      />
    </section>
  );
}
