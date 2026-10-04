'use client';

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

interface KpiGridProps {
  kpis: {
    uniqueVisitors: number;
    pageViews: number;
    sessions: number;
    returningPercent: number;
    avgSessionDurationMs: number;
    clicks: number;
    resumeDownloads: number;
  };
}

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
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
          className="analytics-kpi-value"
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
          className="analytics-kpi-value"
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
          {(kpis.pageViews / Math.max(1, kpis.sessions)).toFixed(1)} views / session
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
          className="analytics-kpi-value"
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
          className="analytics-kpi-value"
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
          className="analytics-kpi-value"
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
  );
}
