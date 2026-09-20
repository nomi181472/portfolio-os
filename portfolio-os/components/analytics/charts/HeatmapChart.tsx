'use client';

import { useState } from 'react';
import type { SeriesPoint } from '@/lib/analytics/singleton';

interface HeatmapChartProps {
  hourlyData?: SeriesPoint[];
  title?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HeatmapChart({ hourlyData = [], title }: HeatmapChartProps) {
  const [hovered, setHovered] = useState<{
    day: string;
    hour: number;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Build a 7 x 24 matrix
  const matrix: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  let maxCount = 1;

  for (const pt of hourlyData) {
    // Expected key format: 'YYYY-MM-DDTHH' or ISO-like
    const date = new Date(pt.label.includes('T') ? pt.label : `${pt.label}:00`);
    if (!isNaN(date.getTime())) {
      const day = date.getDay(); // 0-6
      const hour = date.getHours(); // 0-23
      const count = pt.pageViews ?? pt.visitors ?? 0;
      const row = matrix[day];
      if (row && row[hour] !== undefined) {
        row[hour] += count;
        if (row[hour] > maxCount) {
          maxCount = row[hour];
        }
      }
    }
  }

  const cellSize = 18;
  const cellGap = 3;
  const labelWidth = 32;
  const labelHeight = 20;

  const totalWidth = labelWidth + 24 * (cellSize + cellGap);
  const totalHeight = labelHeight + 7 * (cellSize + cellGap);

  // Color intensity calculation
  const getCellColor = (count: number) => {
    if (count === 0) return 'var(--surface-raised)';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'rgba(207, 163, 95, 0.25)';
    if (ratio < 0.5) return 'rgba(207, 163, 95, 0.5)';
    if (ratio < 0.75) return 'rgba(207, 163, 95, 0.75)';
    return 'var(--signal)';
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
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

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        style={{
          width: '100%',
          minWidth: '540px',
          height: 'auto',
          display: 'block',
        }}
      >
        {/* Hour Header Labels (every 3 hours: 0, 3, 6, 9, 12, 15, 18, 21) */}
        {HOURS.map((h) => {
          if (h % 3 !== 0 && h !== 23) return null;
          const x = labelWidth + h * (cellSize + cellGap) + cellSize / 2;
          return (
            <text
              key={h}
              x={x}
              y={labelHeight - 6}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-data)"
              fill="var(--ink-quiet)"
            >
              {h.toString().padStart(2, '0')}
            </text>
          );
        })}

        {/* Day Rows */}
        {DAYS.map((dayName, dIdx) => {
          const y = labelHeight + dIdx * (cellSize + cellGap);
          return (
            <g key={dayName}>
              {/* Day label */}
              <text
                x={labelWidth - 6}
                y={y + cellSize / 2 + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-data)"
                fill="var(--ink-quiet)"
              >
                {dayName}
              </text>

              {/* 24 Hour cells */}
              {HOURS.map((h) => {
                const count = matrix[dIdx]?.[h] ?? 0;
                const x = labelWidth + h * (cellSize + cellGap);
                const isHovered =
                  hovered?.day === dayName && hovered?.hour === h;

                return (
                  <rect
                    key={h}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx="2"
                    ry="2"
                    fill={getCellColor(count)}
                    stroke={isHovered ? 'var(--signal)' : 'var(--rule)'}
                    strokeWidth={isHovered ? 1.5 : 0.5}
                    style={{
                      cursor: 'pointer',
                      transition:
                        'transform var(--dur-instant) var(--ease-out)',
                    }}
                    onMouseEnter={() =>
                      setHovered({
                        day: dayName,
                        hour: h,
                        count,
                        x: x + cellSize / 2,
                        y: y - 8,
                      })
                    }
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: `${hovered.x}px`,
            top: `${hovered.y}px`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface-vitrine)',
            border: 'var(--border-hair) solid var(--rule-strong)',
            boxShadow: 'var(--lift)',
            borderRadius: 'var(--radius-control)',
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            color: 'var(--ink-bright)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          <div>
            {hovered.day} {hovered.hour.toString().padStart(2, '0')}:00
          </div>
          <div style={{ color: 'var(--signal)', fontWeight: 600 }}>
            {hovered.count} {hovered.count === 1 ? 'event' : 'events'}
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '6px',
          marginTop: 'var(--space-tight)',
          fontSize: '10px',
          fontFamily: 'var(--font-data)',
          color: 'var(--ink-quiet)',
        }}
      >
        <span>Less</span>
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'var(--surface-raised)',
            borderRadius: '2px',
            border: '0.5px solid var(--rule)',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(207, 163, 95, 0.25)',
            borderRadius: '2px',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(207, 163, 95, 0.5)',
            borderRadius: '2px',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(207, 163, 95, 0.75)',
            borderRadius: '2px',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'var(--signal)',
            borderRadius: '2px',
          }}
        />
        <span>More</span>
      </div>
    </div>
  );
}
