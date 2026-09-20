'use client';

import { useState } from 'react';

interface DonutItem {
  key: string;
  value: number;
}

interface DonutChartProps {
  data: DonutItem[];
  title?: string;
  emptyLabel?: string;
  size?: number;
  maxItems?: number;
}

const PALETTE = [
  'var(--signal)', // brass
  '#59a595', // muted teal / cyan-gray
  '#c77d58', // warm terracotta
  '#7b8ca3', // steel blue
  '#9a7bc7', // soft violet
  '#5f7176', // ink-faint
];

export function DonutChart({
  data,
  title,
  emptyLabel = 'No data',
  size = 180,
  maxItems = 6,
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const rawItems = (data || []).filter((d) => d.value > 0);
  const items = rawItems.slice(0, maxItems);
  const otherCount = rawItems.slice(maxItems).reduce((acc, curr) => acc + curr.value, 0);
  if (otherCount > 0) {
    items.push({ key: 'Other', value: otherCount });
  }

  const total = items.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0 || items.length === 0) {
    return (
      <div
        style={{
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-faint)',
          fontSize: 'var(--text-small)',
          fontFamily: 'var(--font-data)',
          border: 'var(--border-hair) dashed var(--rule)',
          borderRadius: 'var(--radius-frame)',
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  const strokeWidth = 22;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const segments = items.map((item, idx) => {
    const percent = item.value / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercent * circumference;
    cumulativePercent += percent;

    return {
      ...item,
      color: PALETTE[idx % PALETTE.length],
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeItem = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div style={{ width: '100%' }}>
      {title && (
        <div
          style={{
            fontWeight: 500,
            fontSize: 'var(--text-small)',
            color: 'var(--ink)',
            marginBottom: 'var(--space-tight)',
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space)',
        }}
      >
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg
            viewBox="0 0 160 160"
            style={{
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)',
              overflow: 'visible',
            }}
          >
            {/* Background ring */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke="var(--rule)"
              strokeWidth={strokeWidth}
            />

            {/* Segments */}
            {segments.map((seg, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <circle
                  key={seg.key}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  style={{
                    cursor: 'pointer',
                    transition:
                      'stroke-width var(--dur-quick) var(--ease-out), opacity var(--dur-quick)',
                    opacity: hoveredIdx !== null && !isHovered ? 0.4 : 1,
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center Info Text */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
              padding: '8px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: activeItem ? '15px' : '18px',
                fontWeight: 600,
                color: activeItem ? activeItem.color : 'var(--ink-bright)',
                lineHeight: 1.1,
              }}
            >
              {activeItem
                ? `${activeItem.percent}%`
                : total.toLocaleString()}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                color: 'var(--ink-quiet)',
                maxWidth: '90px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '2px',
              }}
            >
              {activeItem ? activeItem.key : 'Total'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            flex: 1,
            minWidth: '130px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {segments.map((seg, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={seg.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  fontSize: 'var(--text-small)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: 'var(--radius-frame)',
                  background: isHovered ? 'var(--signal-wash)' : 'transparent',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: seg.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: isHovered ? 'var(--ink-bright)' : 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '12px',
                    }}
                  >
                    {seg.key}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: '11px',
                    color: isHovered ? 'var(--signal)' : 'var(--ink-quiet)',
                    flexShrink: 0,
                  }}
                >
                  {seg.value} ({seg.percent}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
