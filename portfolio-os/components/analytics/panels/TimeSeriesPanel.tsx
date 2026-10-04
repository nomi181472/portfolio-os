'use client';

import { useState } from 'react';
import { LineChart } from '../charts/LineChart';
import type { SeriesPoint } from '@/lib/analytics/singleton';
import type { MetricChoice } from '@/hooks/analytics/useDashboardData';

interface TimeSeriesPanelProps {
  timeseries: SeriesPoint[];
}

export function TimeSeriesPanel({ timeseries }: TimeSeriesPanelProps) {
  const [activeMetric, setActiveMetric] = useState<MetricChoice>('visitors');

  return (
    <section
      style={{
        background: 'var(--surface-raised)',
        border: 'var(--border-hair) solid var(--rule)',
        borderRadius: 'var(--radius-frame)',
        padding: 'var(--space-loose)',
      }}
    >
      <div
        className="analytics-trend-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space)',
          marginBottom: 'var(--space-snug)',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 'var(--text-lead)',
              fontWeight: 600,
              color: 'var(--ink-bright)',
            }}
          >
            Activity Trend
          </h2>
          <p
            style={{
              fontSize: 'var(--text-small)',
              color: 'var(--ink-quiet)',
              marginTop: '2px',
            }}
          >
            Bounded ring data aggregated across time buckets
          </p>
        </div>

        <div className="analytics-metric-btns" style={{ display: 'flex', gap: '6px' }}>
          {(
            [
              { key: 'visitors', label: 'Visitors' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'pageViews', label: 'Page Views' },
              { key: 'clicks', label: 'Clicks' },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key as MetricChoice)}
              style={{
                padding: '3px 10px',
                fontSize: 'var(--text-small)',
                fontFamily: 'var(--font-data)',
                borderRadius: 'var(--radius-control)',
                border:
                  activeMetric === m.key
                    ? 'var(--border-hair) solid var(--signal)'
                    : 'var(--border-hair) solid var(--rule)',
                background:
                  activeMetric === m.key ? 'var(--signal-wash)' : 'transparent',
                color: activeMetric === m.key ? 'var(--signal)' : 'var(--ink-quiet)',
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <LineChart data={timeseries} metric={activeMetric} height={240} />
    </section>
  );
}
