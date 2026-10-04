'use client';

import styles from './SkillSectionGraph.module.css';

interface ProjectNodeProps {
  target: {
    id: string;
    name: string;
    kind: 'products' | 'projects';
    count: number;
    href: string;
  };
  x: number;
  y: number;
  cy: number;
  width: number;
  height: number;
  isActive: boolean;
  isDimmed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

export function ProjectNode({
  target,
  x,
  y,
  cy,
  width,
  height,
  isActive,
  isDimmed,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: ProjectNodeProps) {
  const rawName = target.name.split('—')[0]?.trim() || target.name;
  const displayName = rawName.length > 22 ? `${rawName.slice(0, 21)}…` : rawName;

  return (
    <g
      className={styles.nodeGroup}
      style={{ opacity: isDimmed ? 0.35 : 1 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className={`${styles.nodeRect} ${isActive ? styles.nodeRectActive : ''}`}
      />
      <circle
        cx={x + 9}
        cy={cy}
        r={3}
        fill={target.kind === 'products' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'}
      />
      <text x={x + 18} y={cy} className={styles.nodeText}>
        {displayName}
      </text>
      <rect
        x={x + width - 28}
        y={y + 4}
        width={20}
        height={16}
        className={`${styles.countBadge} ${isActive ? styles.countBadgeActive : ''}`}
      />
      <text
        x={x + width - 18}
        y={cy}
        className={`${styles.countText} ${isActive ? styles.countTextActive : ''}`}
      >
        {target.count}
      </text>
    </g>
  );
}
