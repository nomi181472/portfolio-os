'use client';

import styles from './SkillSectionGraph.module.css';

interface ConnectionEdgeProps {
  d: string;
  isActive: boolean;
  isDimmed: boolean;
}

export function ConnectionEdge({ d, isActive, isDimmed }: ConnectionEdgeProps) {
  return (
    <path
      d={d}
      className={`${styles.edge} ${isActive ? styles.edgeActive : ''} ${
        isDimmed ? styles.edgeDimmed : ''
      }`}
    />
  );
}
