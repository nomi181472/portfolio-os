'use client';

import { useState, useEffect, useTransition } from 'react';
import type { Summary, SeriesPoint } from '@/lib/analytics/singleton';
import { logoutAction } from '@/app/analytics/actions';
import { LineChart } from './charts/LineChart';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';
import { HeatmapChart } from './charts/HeatmapChart';

interface DashboardProps {
  initialSummary: Summary;
  initialTimeseries: SeriesPoint[];
  initialHourlyTimeseries?: SeriesPoint[];
  deployments: { id: string; firstSeenAt: number }[];
  adminEmail: string;
}

type TimeRangePreset = '24h' | '7d' | '30d' | 'all';
type MetricChoice = 'visitors' | 'sessions' | 'pageViews' | 'clicks';

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function AnalyticsDashboard({
  initialSummary,
  initialTimeseries,
  initialHourlyTimeseries = [],
  deployments,
  adminEmail,
}: DashboardProps) {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [timeseries, setTimeseries] = useState<SeriesPoint[]>(initialTimeseries);
  const [hourlyTimeseries, setHourlyTimeseries] = useState<SeriesPoint[]>(initialHourlyTimeseries);
  const [live, setLive] = useState(initialSummary.live);

  const [selectedRange, setSelectedRange] = useState<TimeRangePreset>('7d');
  const [selectedDeployment, setSelectedDeployment] = useState<string>(
    initialSummary.deployment?.id || (deployments[0]?.id ?? 'dev')
  );
  const [activeMetric, setActiveMetric] = useState<MetricChoice>('visitors');
  const [isPending, startTransition] = useTransition();

  // Poll live presence every 15 seconds
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/analytics/admin/live');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data) {
            setLive(data);
          }
        }
      } catch {
        /* silent on failure */
      }
    };

    const interval = setInterval(poll, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch data on filter change
  const handleRangeOrDeploymentChange = (
    newRange: TimeRangePreset,
    newDep: string
  ) => {
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
          fetch(
            `/api/analytics/admin/timeseries?${query.toString()}&granularity=${granularity}`
          ),
          fetch(
            `/api/analytics/admin/timeseries?${query.toString()}&granularity=hour`
          ),
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

  const kpis = summary.kpis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-loose)' }}>
      {/* Mobile responsive overrides */}
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
      {/* Top Header Bar: Status, Deployment, Sign out */}
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
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 'var(--text-meta)',
              color: 'var(--ink-quiet)',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: live.online > 0 ? '#48c774' : 'var(--ink-faint)',
                boxShadow:
                  live.online > 0
                    ? '0 0 8px rgba(72, 199, 116, 0.6)'
                    : 'none',
              }}
            />
            <strong style={{ color: 'var(--ink-bright)', fontFamily: 'var(--font-data)' }}>
              {live.online}
            </strong>{' '}
            {live.online === 1 ? 'visitor online now' : 'visitors online now'}
          </div>

          {live.activeSections.length > 0 && (
            <div
              style={{
                marginTop: '4px',
                fontSize: 'var(--text-fine)',
                fontFamily: 'var(--font-data)',
                color: 'var(--signal)',
              }}
            >
              Viewing:{' '}
              {live.activeSections
                .map((s) => `${s.section} (${s.count})`)
                .join(', ')}
            </div>
          )}
        </div>

        {/* Right side controls: Email, Refresh, Logout */}
        <div className="analytics-header-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-snug)' }}>
          <span
            style={{
              fontSize: 'var(--text-fine)',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-faint)',
            }}
          >
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
                transition: 'border-color var(--dur-quick)',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Filter Bar: Range Presets & Deployment Selector */}
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
        {/* Presets */}
        <div className="analytics-range-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: 'var(--text-fine)',
              color: 'var(--ink-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginRight: '4px',
            }}
          >
            Range:
          </span>
          {(['24h', '7d', '30d', 'all'] as TimeRangePreset[]).map((r) => (
            <button
              key={r}
              onClick={() => handleRangeOrDeploymentChange(r, selectedDeployment)}
              disabled={isPending}
              style={{
                padding: '3px 8px',
                fontSize: 'var(--text-small)',
                fontFamily: 'var(--font-data)',
                borderRadius: 'var(--radius-control)',
                border:
                  selectedRange === r
                    ? 'var(--border-hair) solid var(--signal)'
                    : 'var(--border-hair) solid transparent',
                background:
                  selectedRange === r ? 'var(--signal-wash)' : 'transparent',
                color:
                  selectedRange === r
                    ? 'var(--signal)'
                    : 'var(--ink-quiet)',
                cursor: 'pointer',
              }}
            >
              {r === '24h'
                ? '24 Hours'
                : r === '7d'
                ? '7 Days'
                : r === '30d'
                ? '30 Days'
                : 'All Time'}
            </button>
          ))}
        </div>

        {/* Deployment Switcher */}
        <div className="analytics-dep-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label
            htmlFor="dep-select"
            style={{
              fontSize: 'var(--text-fine)',
              color: 'var(--ink-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Deployment:
          </label>
          <select
            id="dep-select"
            value={selectedDeployment}
            onChange={(e) =>
              handleRangeOrDeploymentChange(selectedRange, e.target.value)
            }
            style={{
              background: 'var(--surface-sunk)',
              border: 'var(--border-hair) solid var(--rule)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--ink-bright)',
              fontSize: 'var(--text-small)',
              fontFamily: 'var(--font-data)',
              padding: '3px 8px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {deployments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} ({new Date(d.firstSeenAt).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div
        className="analytics-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-tight)',
        }}
      >
        {/* Visitors */}
        <div
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-fine)',
              color: 'var(--ink-quiet)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Unique Visitors
          </div>
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
              fontWeight: 600,
              color: 'var(--signal)',
              marginTop: '4px',
            }}
          >
            {kpis.uniqueVisitors.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 'var(--text-fine)',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-faint)',
              marginTop: '2px',
            }}
          >
            HLL sketch estimation
          </div>
        </div>

        {/* Page Views */}
        <div
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-fine)',
              color: 'var(--ink-quiet)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Page Views
          </div>
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
              fontWeight: 600,
              color: 'var(--ink-bright)',
              marginTop: '4px',
            }}
          >
            {kpis.pageViews.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 'var(--text-fine)',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-faint)',
              marginTop: '2px',
            }}
          >
            {(
              kpis.pageViews / Math.max(1, kpis.sessions)
            ).toFixed(1)}{' '}
            views / session
          </div>
        </div>

        {/* Total Sessions */}
        <div
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-fine)',
              color: 'var(--ink-quiet)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Sessions
          </div>
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
              fontWeight: 600,
              color: 'var(--ink-bright)',
              marginTop: '4px',
            }}
          >
            {kpis.sessions.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 'var(--text-fine)',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-faint)',
              marginTop: '2px',
            }}
          >
            {kpis.returningPercent}% returning
          </div>
        </div>

        {/* Avg Duration */}
        <div
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-fine)',
              color: 'var(--ink-quiet)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Avg Duration
          </div>
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
              fontWeight: 600,
              color: 'var(--ink-bright)',
              marginTop: '4px',
            }}
          >
            {formatDuration(kpis.avgSessionDurationMs)}
          </div>
          <div
            style={{
              fontSize: 'var(--text-fine)',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-faint)',
              marginTop: '2px',
            }}
          >
            Active dwell time
          </div>
        </div>

        {/* Interactions & Clicks */}
        <div
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-fine)',
              color: 'var(--ink-quiet)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Clicks & Interactions
          </div>
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
              fontWeight: 600,
              color: 'var(--ink-bright)',
              marginTop: '4px',
            }}
          >
            {kpis.clicks.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 'var(--text-fine)',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-faint)',
              marginTop: '2px',
            }}
          >
            {kpis.resumeDownloads} resume downloads
          </div>
        </div>
      </div>

      {/* Main Timeseries Graph Section */}
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

          {/* Metric Selector Buttons */}
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
                onClick={() => setActiveMetric(m.key)}
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
                    activeMetric === m.key
                      ? 'var(--signal-wash)'
                      : 'transparent',
                  color:
                    activeMetric === m.key
                      ? 'var(--signal)'
                      : 'var(--ink-quiet)',
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

      {/* Grid for Sections & Clicks Distributions */}
      <div
        className="analytics-chart-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 'var(--space)',
        }}
      >
        {/* Top Sections Viewed */}
        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <BarChart
            title="Section Engagement (Views & Time)"
            data={summary.sections.map((s) => ({
              key: `${s.section} (~${formatDuration(s.avgMs)})`,
              value: s.views,
            }))}
            maxItems={8}
            emptyLabel="No section impressions recorded yet"
          />
        </section>

        {/* Top Click Targets */}
        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <BarChart
            title="Top Click Targets"
            data={summary.targets}
            maxItems={8}
            emptyLabel="No interactive clicks recorded yet"
          />
        </section>
      </div>

      {/* Grid for Breakdowns: Devices, Browsers, Countries */}
      <div
        className="analytics-breakdown-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 'var(--space)',
        }}
      >
        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <DonutChart
            title="Device Form Factors"
            data={summary.devices}
            emptyLabel="No device data"
          />
        </section>

        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <DonutChart
            title="Browsers"
            data={summary.browsers}
            emptyLabel="No browser data"
          />
        </section>

        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <DonutChart
            title="Geographic Origin (Country)"
            data={summary.countries}
            emptyLabel="No geo data"
          />
        </section>
      </div>

      {/* Weekly Activity Heatmap */}
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

      {/* Engagement Depth & Referrers Grid */}
      <div
        className="analytics-engagement-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 'var(--space)',
        }}
      >
        {/* Scroll Depth */}
        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <BarChart
            title="Scroll Depth Reached"
            data={summary.scroll.map((sc) => ({
              key: `${sc.bucket}% Depth`,
              value: sc.count,
            }))}
            emptyLabel="No scroll events recorded yet"
          />
        </section>

        {/* Top Referrers */}
        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space)',
          }}
        >
          <BarChart
            title="Traffic Sources (Referrers)"
            data={summary.referrers.length > 0 ? summary.referrers : summary.referrerHosts}
            emptyLabel="Direct visits / No external referrers"
          />
        </section>
      </div>

      {/* Detailed Section Metrics Table */}
      {summary.sections.length > 0 && (
        <section
          style={{
            background: 'var(--surface-raised)',
            border: 'var(--border-hair) solid var(--rule)',
            borderRadius: 'var(--radius-frame)',
            padding: 'var(--space-loose)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-lead)',
              fontWeight: 600,
              color: 'var(--ink-bright)',
              marginBottom: 'var(--space-snug)',
            }}
          >
            Section Visibility Performance
          </h2>
          <div className="analytics-section-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table
              className="analytics-section-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 'var(--text-small)',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: 'var(--border-hair) solid var(--rule)',
                    color: 'var(--ink-quiet)',
                    fontFamily: 'var(--font-data)',
                    fontSize: 'var(--text-fine)',
                  }}
                >
                  <th style={{ padding: '8px' }}>Section</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Views</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>
                    Unique Visitors
                  </th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>
                    Avg Duration
                  </th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>
                    Median Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.sections.map((sec) => (
                  <tr
                    key={sec.section}
                    style={{
                      borderBottom: 'var(--border-hair) solid var(--rule)',
                    }}
                  >
                    <td
                      style={{
                        padding: '10px 8px',
                        fontWeight: 500,
                        color: 'var(--ink-bright)',
                      }}
                    >
                      {sec.section}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-data)',
                        color: 'var(--ink)',
                      }}
                    >
                      {sec.views.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-data)',
                        color: 'var(--signal)',
                      }}
                    >
                      {sec.unique.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-data)',
                        color: 'var(--ink-quiet)',
                      }}
                    >
                      {formatDuration(sec.avgMs)}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-data)',
                        color: 'var(--ink-quiet)',
                      }}
                    >
                      {formatDuration(sec.medianMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
