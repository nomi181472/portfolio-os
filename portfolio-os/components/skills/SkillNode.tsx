'use client';

import styles from './SkillSectionGraph.module.css';

interface SkillNodeProps {
  skill: {
    id: string;
    name: string;
    href: string;
    targets: any[];
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

export function SkillNode({
  skill,
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
}: SkillNodeProps) {
  const displayName = skill.name.length > 20 ? `${skill.name.slice(0, 19)}…` : skill.name;

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
      <text x={x + 8} y={cy} className={styles.nodeText}>
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
        {skill.targets.length}
      </text>
    </g>
  );
}
