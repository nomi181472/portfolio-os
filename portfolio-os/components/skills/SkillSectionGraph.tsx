'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './SkillSectionGraph.module.css';
import { useGraphLayout } from '@/hooks/useGraphLayout';
import { SkillNode } from './SkillNode';
import { ProjectNode } from './ProjectNode';
import { ConnectionEdge } from './ConnectionEdge';

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

  // Get purely geometric nodes and edges from custom hook
  const { nodes, edges, dimensions } = useGraphLayout(connectedSkills, uniqueTargets);

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

  if (connectedSkills.length === 0 || uniqueTargets.length === 0) {
    return null;
  }

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
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              style={{ height: `${dimensions.height}px` }}
            >
              <defs>
                <linearGradient id="silverGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="var(--signal-quiet)" stopOpacity="0.85" />
                </linearGradient>
              </defs>

              {/* Bezier connection lines */}
              <g className="edges">
                {edges.map((edge) => {
                  const isEdgeActive =
                    (hoveredSkillId === edge.skillId && activeTargetIds.has(edge.targetId)) ||
                    (hoveredTargetId === edge.targetId && activeSkillIds.has(edge.skillId));

                  const isEdgeDimmed = isAnyHovered && !isEdgeActive;

                  return (
                    <ConnectionEdge
                      key={edge.id}
                      d={edge.d}
                      isActive={isEdgeActive}
                      isDimmed={isEdgeDimmed}
                    />
                  );
                })}
              </g>

              {/* Left nodes: Skills */}
              <g className="skill-nodes">
                {nodes.skills.map((node) => {
                  const isActive = activeSkillIds.has(node.data.id);
                  const isDimmed = isAnyHovered && !isActive;

                  return (
                    <SkillNode
                      key={node.data.id}
                      skill={node.data}
                      x={node.x}
                      y={node.y}
                      cy={node.cy}
                      width={node.width}
                      height={node.height}
                      isActive={isActive}
                      isDimmed={isDimmed}
                      onMouseEnter={() => setHoveredSkillId(node.data.id)}
                      onMouseLeave={() => setHoveredSkillId(null)}
                      onClick={() => router.push(node.data.href)}
                    />
                  );
                })}
              </g>

              {/* Right nodes: Projects and Products */}
              <g className="target-nodes">
                {nodes.targets.map((node) => {
                  const isActive = activeTargetIds.has(node.data.id);
                  const isDimmed = isAnyHovered && !isActive;

                  return (
                    <ProjectNode
                      key={node.data.id}
                      target={node.data}
                      x={node.x}
                      y={node.y}
                      cy={node.cy}
                      width={node.width}
                      height={node.height}
                      isActive={isActive}
                      isDimmed={isDimmed}
                      onMouseEnter={() => setHoveredTargetId(node.data.id)}
                      onMouseLeave={() => setHoveredTargetId(null)}
                      onClick={() => router.push(node.data.href)}
                    />
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
