'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './SkillSectionGraph.module.css';

export interface GraphSkillNode {
  id: string;
  name: string;
  slug: string;
  href: string;
  level?: string;
  targets: Array<{
    id: string;
    name: string;
    kind: 'products' | 'projects';
    href: string;
  }>;
}

interface SkillSectionGraphProps {
  sectionTitle: string;
  skills: GraphSkillNode[];
}

export function SkillSectionGraph({ sectionTitle, skills }: SkillSectionGraphProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredSkillId, setHoveredSkillId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  // Mobile / Android interaction state
  const [mobileMode, setMobileMode] = useState<'by-skill' | 'by-deliverable'>('by-skill');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Filter skills that have at least one product/project target, plus list other standalone skills
  const connectedSkills = useMemo(() => skills.filter((s) => s.targets.length > 0), [skills]);

  // Aggregate all unique target products/projects in this section
  const uniqueTargets = useMemo(() => {
    const map = new Map<string, { id: string; name: string; kind: 'products' | 'projects'; href: string; count: number }>();
    for (const s of connectedSkills) {
      for (const t of s.targets) {
        const existing = map.get(t.id);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(t.id, { ...t, count: 1 });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [connectedSkills]);

  if (connectedSkills.length === 0 || uniqueTargets.length === 0) {
    return null;
  }

  // Layout calculations
  const leftX = 14;
  const leftWidth = 180;
  const rightWidth = 200;
  const totalWidth = 720;
  const rightX = totalWidth - rightWidth - 14;

  const rowHeight = 32;
  const verticalPadding = 20;

  const leftCount = connectedSkills.length;
  const rightCount = uniqueTargets.length;
  const maxItems = Math.max(leftCount, rightCount);
  const canvasHeight = Math.max(160, maxItems * rowHeight + verticalPadding * 2);

  // Calculate Y positions evenly distributed
  const skillYPositions = new Map<string, number>();
  const leftStep = (canvasHeight - verticalPadding * 2) / Math.max(1, leftCount);
  connectedSkills.forEach((s, idx) => {
    skillYPositions.set(s.id, verticalPadding + idx * leftStep + leftStep / 2);
  });

  const targetYPositions = new Map<string, number>();
  const rightStep = (canvasHeight - verticalPadding * 2) / Math.max(1, rightCount);
  uniqueTargets.forEach((t, idx) => {
    targetYPositions.set(t.id, verticalPadding + idx * rightStep + rightStep / 2);
  });

  // Calculate active states
  const activeSkillIds = useMemo(() => {
    if (hoveredSkillId) return new Set([hoveredSkillId]);
    if (hoveredTargetId) {
      const set = new Set<string>();
      for (const s of connectedSkills) {
        if (s.targets.some((t) => t.id === hoveredTargetId)) {
          set.add(s.id);
        }
      }
      return set;
    }
    return new Set<string>();
  }, [hoveredSkillId, hoveredTargetId, connectedSkills]);

  const activeTargetIds = useMemo(() => {
    if (hoveredTargetId) return new Set([hoveredTargetId]);
    if (hoveredSkillId) {
      const skill = connectedSkills.find((s) => s.id === hoveredSkillId);
      return new Set(skill?.targets.map((t) => t.id) ?? []);
    }
    return new Set<string>();
  }, [hoveredSkillId, hoveredTargetId, connectedSkills]);

  const isAnyHovered = Boolean(hoveredSkillId || hoveredTargetId);

  // Derive active items for mobile view
  const activeMobileSkill = useMemo(() => {
    if (selectedSkillId) {
      const found = connectedSkills.find((s) => s.id === selectedSkillId);
      if (found) return found;
    }
    return connectedSkills[0] || null;
  }, [selectedSkillId, connectedSkills]);

  const activeMobileTarget = useMemo(() => {
    if (selectedTargetId) {
      const found = uniqueTargets.find((t) => t.id === selectedTargetId);
      if (found) return found;
    }
    return uniqueTargets[0] || null;
  }, [selectedTargetId, uniqueTargets]);

  const deliverableSkills = useMemo(() => {
    if (!activeMobileTarget) return [];
    return connectedSkills.filter((s) => s.targets.some((t) => t.id === activeMobileTarget.id));
  }, [activeMobileTarget, connectedSkills]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.metaInfo}>
          <span className={styles.pulseDot} />
          <span>
            CONNECTIVITY GRAPH · {connectedSkills.length} SKILLS ↔ {uniqueTargets.length} DELIVERABLES
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={styles.toggleButton}
          aria-label="Toggle section graph"
        >
          {collapsed ? 'Show Graph +' : 'Collapse Graph −'}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className={styles.desktopCanvasWrapper}>
            <svg
              className={styles.svgCanvas}
              viewBox={`0 0 ${totalWidth} ${canvasHeight}`}
              style={{ height: `${canvasHeight}px` }}
            >
            <defs>
              <linearGradient id="silverGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#c0c5d0" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {/* Bezier connection lines */}
            <g className="edges">
              {connectedSkills.flatMap((skill) => {
                const y1 = skillYPositions.get(skill.id) ?? 0;
                const x1 = leftX + leftWidth;

                return skill.targets.map((target) => {
                  const y2 = targetYPositions.get(target.id) ?? 0;
                  const x2 = rightX;

                  const isEdgeActive =
                    (hoveredSkillId === skill.id && activeTargetIds.has(target.id)) ||
                    (hoveredTargetId === target.id && activeSkillIds.has(skill.id));

                  const isEdgeDimmed = isAnyHovered && !isEdgeActive;

                  const dx = (x2 - x1) * 0.5;
                  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                  return (
                    <path
                      key={`${skill.id}->${target.id}`}
                      d={d}
                      className={`${styles.edge} ${isEdgeActive ? styles.edgeActive : ''} ${
                        isEdgeDimmed ? styles.edgeDimmed : ''
                      }`}
                    />
                  );
                });
              })}
            </g>

            {/* Left nodes: Skills */}
            <g className="skill-nodes">
              {connectedSkills.map((skill) => {
                const y = skillYPositions.get(skill.id) ?? 0;
                const nodeH = 24;
                const nodeY = y - nodeH / 2;
                const isActive = activeSkillIds.has(skill.id);
                const isDimmed = isAnyHovered && !isActive;

                const displayName =
                  skill.name.length > 20 ? `${skill.name.slice(0, 19)}…` : skill.name;

                return (
                  <g
                    key={skill.id}
                    className={styles.nodeGroup}
                    style={{ opacity: isDimmed ? 0.35 : 1 }}
                    onMouseEnter={() => setHoveredSkillId(skill.id)}
                    onMouseLeave={() => setHoveredSkillId(null)}
                    onClick={() => router.push(skill.href)}
                  >
                    <rect
                      x={leftX}
                      y={nodeY}
                      width={leftWidth}
                      height={nodeH}
                      className={`${styles.nodeRect} ${isActive ? styles.nodeRectActive : ''}`}
                    />
                    <text x={leftX + 8} y={y} className={styles.nodeText}>
                      {displayName}
                    </text>
                    {/* Badge count */}
                    <rect
                      x={leftX + leftWidth - 28}
                      y={nodeY + 4}
                      width={20}
                      height={16}
                      className={`${styles.countBadge} ${isActive ? styles.countBadgeActive : ''}`}
                    />
                    <text
                      x={leftX + leftWidth - 18}
                      y={y}
                      className={`${styles.countText} ${isActive ? styles.countTextActive : ''}`}
                    >
                      {skill.targets.length}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Right nodes: Projects and Products */}
            <g className="target-nodes">
              {uniqueTargets.map((target) => {
                const y = targetYPositions.get(target.id) ?? 0;
                const nodeH = 24;
                const nodeY = y - nodeH / 2;
                const isActive = activeTargetIds.has(target.id);
                const isDimmed = isAnyHovered && !isActive;

                const rawName = target.name.split('—')[0]?.trim() || target.name;
                const displayName = rawName.length > 22 ? `${rawName.slice(0, 21)}…` : rawName;

                return (
                  <g
                    key={target.id}
                    className={styles.nodeGroup}
                    style={{ opacity: isDimmed ? 0.35 : 1 }}
                    onMouseEnter={() => setHoveredTargetId(target.id)}
                    onMouseLeave={() => setHoveredTargetId(null)}
                    onClick={() => router.push(target.href)}
                  >
                    <rect
                      x={rightX}
                      y={nodeY}
                      width={rightWidth}
                      height={nodeH}
                      className={`${styles.nodeRect} ${isActive ? styles.nodeRectActive : ''}`}
                    />
                    {/* Target type indicator dot */}
                    <circle
                      cx={rightX + 9}
                      cy={y}
                      r={3}
                      fill={target.kind === 'products' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'}
                    />
                    <text x={rightX + 18} y={y} className={styles.nodeText}>
                      {displayName}
                    </text>
                    {/* Skill backlink count badge */}
                    <rect
                      x={rightX + rightWidth - 28}
                      y={nodeY + 4}
                      width={20}
                      height={16}
                      className={`${styles.countBadge} ${isActive ? styles.countBadgeActive : ''}`}
                    />
                    <text
                      x={rightX + rightWidth - 18}
                      y={y}
                      className={`${styles.countText} ${isActive ? styles.countTextActive : ''}`}
                    >
                      {target.count}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          </div>

          {/* Mobile / Android Touch Connectivity Navigator (<= 768px) */}
          <div className={styles.mobileViewWrapper}>
            {/* Segmented Mode Controller */}
            <div className={styles.mobileSegmentControl}>
              <button
                type="button"
                className={`${styles.mobileSegmentBtn} ${
                  mobileMode === 'by-skill' ? styles.mobileSegmentBtnActive : ''
                }`}
                onClick={() => setMobileMode('by-skill')}
              >
                By Skill ({connectedSkills.length})
              </button>
              <button
                type="button"
                className={`${styles.mobileSegmentBtn} ${
                  mobileMode === 'by-deliverable' ? styles.mobileSegmentBtnActive : ''
                }`}
                onClick={() => setMobileMode('by-deliverable')}
              >
                By Deliverable ({uniqueTargets.length})
              </button>
            </div>

            {mobileMode === 'by-skill' ? (
              <>
                {/* Horizontal scroll chips for skills */}
                <div className={styles.mobileChipScroll}>
                  {connectedSkills.map((s) => {
                    const isSelected = (activeMobileSkill?.id ?? connectedSkills[0]?.id) === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`${styles.mobileChip} ${isSelected ? styles.mobileChipActive : ''}`}
                        onClick={() => setSelectedSkillId(s.id)}
                      >
                        <span className={styles.mobileChipDot} />
                        <span className={styles.mobileChipText}>{s.name}</span>
                        <span className={styles.mobileChipCount}>{s.targets.length}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Skill Active Bridge Card */}
                {activeMobileSkill ? (
                  <div className={styles.mobileActiveCard}>
                    <div className={styles.mobileActiveCardHeader}>
                      <div className={styles.mobileActiveTitleBlock}>
                        <span className={styles.mobileActiveSubLabel}>ACTIVE SKILL</span>
                        <h4 className={styles.mobileActiveTitle}>{activeMobileSkill.name}</h4>
                      </div>
                      <Link href={activeMobileSkill.href} className={styles.mobileActiveLink}>
                        Explore Skill ↗
                      </Link>
                    </div>

                    <div className={styles.mobileConnectionsSection}>
                      <div className={styles.mobileConnectionsHeader}>
                        <span>CONNECTED DELIVERABLES</span>
                        <span className={styles.mobileConnectionsCount}>
                          {activeMobileSkill.targets.length}
                        </span>
                      </div>

                      <div className={styles.mobileTargetList}>
                        {activeMobileSkill.targets.map((target) => (
                          <Link
                            key={target.id}
                            href={target.href}
                            className={styles.mobileTargetItem}
                          >
                            <div className={styles.mobileTargetLeft}>
                              <span
                                className={`${styles.mobileTargetBadge} ${
                                  target.kind === 'products'
                                    ? styles.mobileTargetBadgeProduct
                                    : styles.mobileTargetBadgeProject
                                }`}
                              >
                                {target.kind === 'products' ? 'PRODUCT' : 'PROJECT'}
                              </span>
                              <span className={styles.mobileTargetName}>{target.name}</span>
                            </div>
                            <span className={styles.mobileTargetArrow}>→</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {/* Horizontal scroll chips for deliverables */}
                <div className={styles.mobileChipScroll}>
                  {uniqueTargets.map((t) => {
                    const isSelected = (activeMobileTarget?.id ?? uniqueTargets[0]?.id) === t.id;
                    const shortName = t.name.split('—')[0]?.trim() || t.name;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`${styles.mobileChip} ${isSelected ? styles.mobileChipActive : ''}`}
                        onClick={() => setSelectedTargetId(t.id)}
                      >
                        <span className={styles.mobileChipDot} />
                        <span className={styles.mobileChipText}>{shortName}</span>
                        <span className={styles.mobileChipCount}>{t.count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Deliverable Active Bridge Card */}
                {activeMobileTarget ? (
                  <div className={styles.mobileActiveCard}>
                    <div className={styles.mobileActiveCardHeader}>
                      <div className={styles.mobileActiveTitleBlock}>
                        <span className={styles.mobileActiveSubLabel}>
                          {activeMobileTarget.kind === 'products' ? 'PRODUCT ARCHITECTURE' : 'PROJECT AUDIT'}
                        </span>
                        <h4 className={styles.mobileActiveTitle}>{activeMobileTarget.name}</h4>
                      </div>
                      <Link href={activeMobileTarget.href} className={styles.mobileActiveLink}>
                        Open Deliverable ↗
                      </Link>
                    </div>

                    <div className={styles.mobileConnectionsSection}>
                      <div className={styles.mobileConnectionsHeader}>
                        <span>SKILLS UTILIZED ({sectionTitle.toUpperCase()})</span>
                        <span className={styles.mobileConnectionsCount}>
                          {deliverableSkills.length}
                        </span>
                      </div>

                      <div className={styles.mobileTargetList}>
                        {deliverableSkills.map((skill) => (
                          <Link
                            key={skill.id}
                            href={skill.href}
                            className={styles.mobileTargetItem}
                          >
                            <div className={styles.mobileTargetLeft}>
                              <span className={styles.mobileTargetBadgeSkill}>SKILL</span>
                              <span className={styles.mobileTargetName}>{skill.name}</span>
                            </div>
                            <span className={styles.mobileTargetArrow}>→</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
