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

  // Build a 7 x 24 matrix (7 days of week, 24 hours of day)
  const matrix: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  let maxCount = 1;
  let totalEvents = 0;

  for (const pt of hourlyData) {
    if (!pt || !pt.label) continue;

    // Supports:
    // 1. 'YYYY-MM-DDTHH' (hour bucket)
    // 2. 'YYYY-MM-DD' (day bucket)
    // 3. Full ISO timestamp
    const label = String(pt.label).trim();
    const match = label.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}))?/);

    let day = -1;
    let hour = 0;

    if (match && match[1] && match[2] && match[3]) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const dayOfMonth = parseInt(match[3], 10);
      const hourOfDay = match[4] !== undefined ? parseInt(match[4], 10) : 12;

      const d = new Date(Date.UTC(year, month, dayOfMonth, hourOfDay));
      if (!isNaN(d.getTime())) {
        day = d.getUTCDay();
        hour = match[4] !== undefined ? parseInt(match[4], 10) : 0;
      }
    } else {
      const fallback = new Date(label);
      if (!isNaN(fallback.getTime())) {
        day = fallback.getUTCDay();
        hour = fallback.getUTCHours();
      }
    }

    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
      const count = pt.pageViews ?? pt.visitors ?? 0;
      const row = matrix[day];
      if (row) {
        const current = row[hour];
        if (typeof current === 'number') {
          const nextVal = current + count;
          row[hour] = nextVal;
          totalEvents += count;
          if (nextVal > maxCount) {
            maxCount = nextVal;
          }
        }
      }
    }
  }

  const cellSize = 18;
  const cellGap = 3;
  const labelWidth = 34;
  const labelHeight = 22;

  const totalWidth = labelWidth + 24 * (cellSize + cellGap);
  const totalHeight = labelHeight + 7 * (cellSize + cellGap);

  // Strict 2-color monochrome luminescence (Obsidian Substrate + Crisp Silver/White)
  const getCellColor = (count: number) => {
    if (count === 0) return 'rgba(255, 255, 255, 0.03)';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'rgba(255, 255, 255, 0.20)';
    if (ratio < 0.5) return 'rgba(255, 255, 255, 0.45)';
    if (ratio < 0.75) return 'rgba(255, 255, 255, 0.75)';
    return '#ffffff';
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-tight)',
          flexWrap: 'wrap',
          gap: 'var(--space-tight)',
        }}
      >
        {title && (
          <div
            style={{
              fontWeight: 500,
              fontSize: 'var(--text-small)',
              color: 'var(--ink-bright)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {title}
          </div>
        )}
        <span
          className="meta"
          style={{ fontSize: '11px', color: 'var(--ink-quiet)' }}
        >
          {totalEvents} {totalEvents === 1 ? 'total recorded event' : 'total recorded events'}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        style={{
          width: '100%',
          minWidth: 'min(560px, 100%)',
          height: 'auto',
          display: 'block',
        }}
      >
        {/* Hour Header Labels (every 3 hours: 00, 03, 06, 09, 12, 15, 18, 21, 23) */}
        {HOURS.map((h) => {
          if (h % 3 !== 0 && h !== 23) return null;
          const x = labelWidth + h * (cellSize + cellGap) + cellSize / 2;
          return (
            <text
              key={h}
              x={x}
              y={labelHeight - 7}
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
                x={labelWidth - 8}
                y={y + cellSize / 2 + 3.5}
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
                    rx="3"
                    ry="3"
                    fill={getCellColor(count)}
                    stroke={
                      isHovered
                        ? '#ffffff'
                        : count > 0
                        ? 'rgba(255, 255, 255, 0.3)'
                        : 'rgba(255, 255, 255, 0.07)'
                    }
                    strokeWidth={isHovered ? 1.5 : 0.75}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 120ms ease-out',
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
            background: '#141820',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 12px rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            padding: '5px 9px',
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            color: '#ffffff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 20,
          }}
        >
          <div style={{ color: 'var(--ink-quiet)' }}>
            {hovered.day} at {hovered.hour.toString().padStart(2, '0')}:00 UTC
          </div>
          <div style={{ color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>
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
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '2px',
            border: '0.75px solid rgba(255, 255, 255, 0.07)',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.20)',
            borderRadius: '2px',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.45)',
            borderRadius: '2px',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.75)',
            borderRadius: '2px',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            background: '#ffffff',
            borderRadius: '2px',
          }}
        />
        <span>More</span>
      </div>
    </div>
  );
}
