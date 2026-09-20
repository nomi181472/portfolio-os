'use client';

interface BarItem {
  key: string;
  value: number;
}

interface BarChartProps {
  data: BarItem[];
  title?: string;
  emptyLabel?: string;
  unit?: string;
  maxItems?: number;
  highlightKey?: string;
}

export function BarChart({
  data,
  title,
  emptyLabel = 'No data recorded',
  unit = '',
  maxItems = 10,
  highlightKey,
}: BarChartProps) {
  const items = (data || []).slice(0, maxItems);
  const maxValue = Math.max(...items.map((d) => d.value), 1);
  const total = items.reduce((acc, curr) => acc + curr.value, 0);

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-snug)',
          color: 'var(--ink-faint)',
          fontSize: 'var(--text-small)',
          fontFamily: 'var(--font-data)',
          border: 'var(--border-hair) dashed var(--rule)',
          borderRadius: 'var(--radius-frame)',
          textAlign: 'center',
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {title && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 'var(--space-tight)',
            fontSize: 'var(--text-small)',
          }}
        >
          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{title}</span>
          <span
            style={{
              fontSize: 'var(--text-fine)',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-quiet)',
            }}
          >
            Total: {total.toLocaleString()} {unit}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, idx) => {
          const pct = Math.round((item.value / maxValue) * 100);
          const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isHighlight = highlightKey === item.key;

          return (
            <div
              key={item.key || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                padding: '4px 6px',
                borderRadius: 'var(--radius-frame)',
                background: isHighlight ? 'var(--signal-wash)' : 'transparent',
                transition: 'background var(--dur-quick) var(--ease-out)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--text-small)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--ink-bright)',
                    maxWidth: '70%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.key}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      color: 'var(--ink-faint)',
                      marginRight: '6px',
                    }}
                  >
                    #{idx + 1}
                  </span>
                  {item.key}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: '12px',
                    color: isHighlight ? 'var(--signal)' : 'var(--ink-quiet)',
                  }}
                >
                  {item.value.toLocaleString()}
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--ink-faint)',
                      marginLeft: '6px',
                    }}
                  >
                    ({share}%)
                  </span>
                </span>
              </div>

              {/* Progress track & fill */}
              <div
                style={{
                  height: '4px',
                  width: '100%',
                  background: 'var(--rule)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: isHighlight
                      ? 'var(--signal)'
                      : 'var(--signal-quiet)',
                    borderRadius: '2px',
                    transition: 'width var(--dur-considered) var(--ease-out)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
