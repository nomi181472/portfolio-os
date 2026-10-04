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

interface WebVitalsTableProps {
  sections: {
    section: string;
    views: number;
    unique: number;
    avgMs: number;
    medianMs: number;
  }[];
}

export function WebVitalsTable({ sections }: WebVitalsTableProps) {
  if (!sections || sections.length === 0) return null;

  return (
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
              <th style={{ padding: '8px', textAlign: 'right' }}>Unique Visitors</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Avg Duration</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Median Duration</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
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
  );
}
