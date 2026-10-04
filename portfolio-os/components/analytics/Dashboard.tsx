'use client';

import type { Summary, SeriesPoint } from '@/lib/analytics/singleton';
import { logoutAction } from '@/app/analytics/actions';
import { useDashboardData } from '@/hooks/analytics/useDashboardData';
import { useLivePresence } from '@/hooks/analytics/useLivePresence';

import { LivePresenceCard } from './panels/LivePresenceCard';
import { KpiGrid } from './panels/KpiGrid';
import { TimeSeriesPanel } from './panels/TimeSeriesPanel';
import { DistributionGrid } from './panels/DistributionGrid';
import { ActivityHeatmap } from './panels/ActivityHeatmap';
import { WebVitalsTable } from './panels/WebVitalsTable';

import { BarChart } from './charts/BarChart';

interface DashboardProps {
  initialSummary: Summary;
  initialTimeseries: SeriesPoint[];
  initialHourlyTimeseries?: SeriesPoint[];
  deployments: { id: string; firstSeenAt: number }[];
  adminEmail: string;
}

export function AnalyticsDashboard({
  initialSummary,
  initialTimeseries,
  initialHourlyTimeseries = [],
  deployments,
  adminEmail,
}: DashboardProps) {
  const {
    summary,
    timeseries,
    hourlyTimeseries,
    selectedRange,
    selectedDeployment,
    isPending,
    handleRangeOrDeploymentChange
  } = useDashboardData(initialSummary, initialTimeseries, initialHourlyTimeseries, deployments);

  const { activeCount, activeSections } = useLivePresence(initialSummary.live);

  function formatDuration(ms: number) {
    if (!ms || ms <= 0) return '0s';
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-loose)' }}>
      <style>{`
        @media (max-width: 640px) {
          .analytics-header { flex-direction: column !important; align-items: flex-start !important; }
          .analytics-header-right { width: 100% !important; justify-content: space-between !important; }
          .analytics-filter-bar { flex-direction: column !important; align-items: stretch !important; }
          .analytics-range-row { flex-wrap: wrap !important; }
          .analytics-dep-row { flex-wrap: wrap !important; }
          .analytics-metric-btns { flex-wrap: wrap !important; }
          .analytics-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .analytics-chart-grid { grid-template-columns: 1fr !important; }
          .analytics-breakdown-grid { grid-template-columns: 1fr !important; }
          .analytics-engagement-grid { grid-template-columns: 1fr !important; }
          .analytics-trend-header { flex-direction: column !important; align-items: flex-start !important; }
          .analytics-section-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
          .analytics-section-table { min-width: 520px; }
          .analytics-kpi-value { font-size: 1.35rem !important; }
        }
        @media (max-width: 400px) {
          .analytics-kpi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <header
        className="analytics-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space)',
          paddingBottom: 'var(--space)',
          borderBottom: 'var(--border-hair) solid var(--rule)',
        }}
      >
        <LivePresenceCard activeCount={activeCount} activeSections={activeSections} />
        <div className="analytics-header-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-snug)' }}>
          <span style={{ fontSize: 'var(--text-fine)', fontFamily: 'var(--font-data)', color: 'var(--ink-faint)' }}>
            {adminEmail}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                background: 'transparent',
                border: 'var(--border-hair) solid var(--rule)',
                borderRadius: 'var(--radius-control)',
                padding: '4px 10px',
                fontSize: 'var(--text-small)',
                color: 'var(--ink-quiet)',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div
        className="analytics-filter-bar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space)',
          background: 'var(--surface-raised)',
          padding: 'var(--space-tight) var(--space)',
          border: 'var(--border-hair) solid var(--rule)',
          borderRadius: 'var(--radius-frame)',
        }}
      >
        <div className="analytics-range-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: 'var(--text-fine)', color: 'var(--ink-faint)', textTransform: 'uppercase', marginRight: '4px' }}>Range:</span>
          {(['24h', '7d', '30d', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => handleRangeOrDeploymentChange(r, selectedDeployment)}
              disabled={isPending}
              style={{
                padding: '3px 8px',
                fontSize: 'var(--text-small)',
                fontFamily: 'var(--font-data)',
                borderRadius: 'var(--radius-control)',
                border: selectedRange === r ? 'var(--border-hair) solid var(--signal)' : 'var(--border-hair) solid transparent',
                background: selectedRange === r ? 'var(--signal-wash)' : 'transparent',
                color: selectedRange === r ? 'var(--signal)' : 'var(--ink-quiet)',
                cursor: 'pointer',
              }}
            >
              {r === '24h' ? '24 Hours' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
        <div className="analytics-dep-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: 'var(--text-fine)', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Deployment:</label>
          <select
            value={selectedDeployment}
            onChange={(e) => handleRangeOrDeploymentChange(selectedRange, e.target.value)}
            style={{ background: 'var(--surface-sunk)', border: 'var(--border-hair) solid var(--rule)', borderRadius: 'var(--radius-control)', color: 'var(--ink-bright)', fontSize: 'var(--text-small)', fontFamily: 'var(--font-data)', padding: '3px 8px', outline: 'none', cursor: 'pointer' }}
          >
            {deployments.map((d) => (
              <option key={d.id} value={d.id}>{d.id} ({new Date(d.firstSeenAt).toLocaleDateString()})</option>
            ))}
          </select>
        </div>
      </div>

      <KpiGrid kpis={summary.kpis} />
      <TimeSeriesPanel timeseries={timeseries} />
      
      <div className="analytics-chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 'var(--space)' }}>
        <section style={{ background: 'var(--surface-raised)', border: 'var(--border-hair) solid var(--rule)', borderRadius: 'var(--radius-frame)', padding: 'var(--space)' }}>
          <BarChart title="Section Engagement (Views & Time)" data={summary.sections.map((s) => ({ key: `${s.section} (~${formatDuration(s.avgMs)})`, value: s.views }))} maxItems={8} emptyLabel="No section impressions recorded yet" />
        </section>
        <section style={{ background: 'var(--surface-raised)', border: 'var(--border-hair) solid var(--rule)', borderRadius: 'var(--radius-frame)', padding: 'var(--space)' }}>
          <BarChart title="Top Click Targets" data={summary.targets} maxItems={8} emptyLabel="No interactive clicks recorded yet" />
        </section>
      </div>

      <DistributionGrid devices={summary.devices} browsers={summary.browsers} countries={summary.countries} />
      <ActivityHeatmap hourlyTimeseries={hourlyTimeseries} />
      
      <div className="analytics-engagement-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 'var(--space)' }}>
        <section style={{ background: 'var(--surface-raised)', border: 'var(--border-hair) solid var(--rule)', borderRadius: 'var(--radius-frame)', padding: 'var(--space)' }}>
          <BarChart title="Scroll Depth Reached" data={summary.scroll.map((sc) => ({ key: `${sc.bucket}% Depth`, value: sc.count }))} emptyLabel="No scroll events recorded yet" />
        </section>
        <section style={{ background: 'var(--surface-raised)', border: 'var(--border-hair) solid var(--rule)', borderRadius: 'var(--radius-frame)', padding: 'var(--space)' }}>
          <BarChart title="Traffic Sources (Referrers)" data={summary.referrers.length > 0 ? summary.referrers : summary.referrerHosts} emptyLabel="Direct visits / No external referrers" />
        </section>
      </div>

      <WebVitalsTable sections={summary.sections} />
    </div>
  );
}
