'use client';

import { useState, useId } from 'react';
import type { SeriesPoint } from '@/lib/analytics/singleton';

interface LineChartProps {
  data: SeriesPoint[];
  metric?: 'visitors' | 'sessions' | 'pageViews' | 'clicks';
  height?: number;
  showAllMetrics?: boolean;
}

export function LineChart({
  data,
  metric = 'visitors',
  height = 240,
}: LineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const id = useId();

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
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
        No activity recorded in this period
      </div>
    );
  }

  const width = 800;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Extract values
  const values = data.map((d) => d[metric] ?? 0);
  const maxVal = Math.max(...values, 5);
  // Round maxVal up to pleasant interval
  const yTicksCount = 4;
  const yMax = Math.ceil(maxVal * 1.15);

  const getX = (i: number) => {
    if (data.length <= 1) return padding.left + chartW / 2;
    return padding.left + (i / (data.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    return padding.top + chartH - (val / yMax) * chartH;
  };

  // Build SVG path
  const points = data.map((d, i) => `${getX(i)},${getY(d[metric] ?? 0)}`);
  const pathD = points.length > 1 ? `M ${points.join(' L ')}` : '';
  const areaD =
    points.length > 1
      ? `M ${getX(0)},${padding.top + chartH} L ${points.join(' L ')} L ${getX(
          data.length - 1
        )},${padding.top + chartH} Z`
      : '';

  // Secondary line for sessions if metric is visitors
  const sessionPoints =
    metric === 'visitors'
      ? data.map((d, i) => `${getX(i)},${getY(d.sessions ?? 0)}`)
      : [];
  const sessionPathD =
    sessionPoints.length > 1 ? `M ${sessionPoints.join(' L ')}` : '';

  // Calculate X label step
  const xLabelStep = Math.max(1, Math.ceil(data.length / 6));

  const gradientId = `line-grad-${id.replace(/[^a-zA-Z0-9]/g, '')}`;

  const hoveredPoint = hoveredIdx !== null ? data[hoveredIdx] : undefined;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: 'auto',
          overflow: 'visible',
          display: 'block',
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Grid lines and labels */}
        {Array.from({ length: yTicksCount + 1 }).map((_, i) => {
          const val = Math.round((yMax / yTicksCount) * i);
          const y = getY(val);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--rule)"
                strokeDasharray={i === 0 ? undefined : '2,3'}
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-data)"
                fill="var(--ink-faint)"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}

        {/* Sessions secondary line (dashed) if metric is visitors */}
        {sessionPathD && (
          <path
            d={sessionPathD}
            fill="none"
            stroke="var(--ink-quiet)"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            opacity="0.6"
          />
        )}

        {/* Main Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--signal)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* X Axis labels */}
        {data.map((d, i) => {
          if (i % xLabelStep !== 0 && i !== data.length - 1) return null;
          const x = getX(i);
          // Label formatting (truncate or show date)
          const cleanLabel = d.label.includes('T')
            ? d.label.split('T')[1]?.slice(0, 5) || d.label
            : d.label.slice(5);
          return (
            <text
              key={i}
              x={x}
              y={padding.top + chartH + 18}
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--font-data)"
              fill="var(--ink-quiet)"
            >
              {cleanLabel}
            </text>
          );
        })}

        {/* Data points & Interactive Hover targets */}
        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(d[metric] ?? 0);
          const isHovered = hoveredIdx === i;

          return (
            <g key={i}>
              {/* Invisible touch/hover target */}
              <circle
                cx={cx}
                cy={cy}
                r="18"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              {/* Visible dot */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5 : 2.5}
                fill={isHovered ? 'var(--signal)' : 'var(--surface-raised)'}
                stroke="var(--signal)"
                strokeWidth={isHovered ? 2 : 1.5}
                style={{
                  transition: 'r var(--dur-quick) var(--ease-out)',
                  pointerEvents: 'none',
                }}
              />
            </g>
          );
        })}

        {/* Hover vertical guideline */}
        {hoveredIdx !== null && (
          <line
            x1={getX(hoveredIdx)}
            y1={padding.top}
            x2={getX(hoveredIdx)}
            y2={padding.top + chartH}
            stroke="var(--signal-quiet)"
            strokeDasharray="3,3"
            strokeWidth="1"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Floating Tooltip */}
      {hoveredPoint && hoveredIdx !== null && (
        <div
          style={{
            position: 'absolute',
            left: `calc(${(getX(hoveredIdx) / width) * 100}% - 70px)`,
            top: `${Math.max(0, getY(hoveredPoint[metric] ?? 0) - 58)}px`,
            background: 'var(--surface-vitrine)',
            border: 'var(--border-hair) solid var(--rule-strong)',
            boxShadow: 'var(--lift)',
            borderRadius: 'var(--radius-control)',
            padding: '4px 8px',
            pointerEvents: 'none',
            zIndex: 10,
            width: '140px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              color: 'var(--ink-quiet)',
              marginBottom: '2px',
            }}
          >
            {hoveredPoint.label}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-data)',
              color: 'var(--signal)',
            }}
          >
            {metric.toUpperCase()}: {hoveredPoint[metric] ?? 0}
          </div>
          {metric === 'visitors' && (
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-data)',
                color: 'var(--ink-faint)',
              }}
            >
              Sessions: {hoveredPoint.sessions ?? 0} | Views:{' '}
              {hoveredPoint.pageViews ?? 0}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
