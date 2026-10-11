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
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [mobileFlowMode, setMobileFlowMode] = useState<'river' | 'list'>('river');

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
          <span className={styles.metaTextDesktop}>
            CONNECTIVITY GRAPH · {connectedSkills.length} SKILLS ↔ {uniqueTargets.length} DELIVERABLES
          </span>
          <span className={styles.metaTextMobile}>
            GRAPH · {connectedSkills.length} SKILLS ↔ {uniqueTargets.length} DELIVERABLES
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={styles.toggleButton}
          aria-label="Toggle section graph"
        >
          <span className={styles.toggleDesktop}>
            {collapsed ? 'Show Graph +' : 'Collapse Graph −'}
          </span>
          <span className={styles.toggleMobile}>
            {collapsed ? 'Show +' : 'Collapse −'}
          </span>
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
                onClick={() => {
                  setMobileMode('by-skill');
                  setShowAllTargets(false);
                }}
              >
                By Skill ({connectedSkills.length})
              </button>
              <button
                type="button"
                className={`${styles.mobileSegmentBtn} ${
                  mobileMode === 'by-deliverable' ? styles.mobileSegmentBtnActive : ''
                }`}
                onClick={() => {
                  setMobileMode('by-deliverable');
                  setShowAllTargets(false);
                }}
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
                        onClick={() => {
                          setSelectedSkillId(s.id);
                          setShowAllTargets(false);
                        }}
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

                    {/* Model 1: Flow Mode Switcher */}
                    <div className={styles.mobileFlowControl}>
                      <div className={styles.mobileFlowMeta}>
                        <span className={styles.mobileFlowPulse} />
                        <span>CIRCUIT RIVER FLOW</span>
                      </div>
                      <div className={styles.mobileFlowToggle}>
                        <button
                          type="button"
                          className={`${styles.mobileFlowToggleBtn} ${
                            mobileFlowMode === 'river' ? styles.mobileFlowToggleBtnActive : ''
                          }`}
                          onClick={() => setMobileFlowMode('river')}
                          aria-label="Vertical River Flow View"
                        >
                          🔀 River
                        </button>
                        <button
                          type="button"
                          className={`${styles.mobileFlowToggleBtn} ${
                            mobileFlowMode === 'list' ? styles.mobileFlowToggleBtnActive : ''
                          }`}
                          onClick={() => setMobileFlowMode('list')}
                          aria-label="List View"
                        >
                          📋 List
                        </button>
                      </div>
                    </div>

                    {/* Model 1: Vertical River SVG Emitter & Edges */}
                    {mobileFlowMode === 'river' && activeMobileSkill.targets.length > 0 ? (
                      <div className={styles.mobileRiverContainer} aria-hidden="true">
                        <div className={styles.mobileRiverHeader}>
                          <span className={styles.mobileRiverSourceLabel}>
                            SOURCE EMITTER · {activeMobileSkill.name.toUpperCase()}
                          </span>
                          <span className={styles.mobileRiverSignalRate}>
                            {activeMobileSkill.targets.length} CHANNELS
                          </span>
                        </div>

                        <svg className={styles.mobileRiverSvg} viewBox="0 0 320 64" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="mobileRiverGradSkill" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="var(--signal)" stopOpacity="1" />
                              <stop offset="100%" stopColor="var(--signal-quiet)" stopOpacity="0.85" />
                            </linearGradient>
                            <filter id="mobileRiverGlow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="2.5" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>

                          {/* Top Source Emitter Node */}
                          <circle cx="160" cy="8" r="8" fill="none" stroke="var(--signal)" strokeWidth="1" opacity="0.4" className={styles.riverPulseRing} />
                          <circle cx="160" cy="8" r="4.5" fill="var(--signal)" filter="url(#mobileRiverGlow)" />

                          {/* Branching Vertical River Edges */}
                          {(() => {
                            const count = Math.min(activeMobileSkill.targets.length, showAllTargets ? activeMobileSkill.targets.length : 5);
                            const list = activeMobileSkill.targets.slice(0, count);
                            return list.map((target, idx) => {
                              const destX = count === 1 ? 160 : 20 + (idx / (count - 1)) * 280;
                              const destY = 56;
                              const isSelected = selectedTargetId === target.id;
                              const isAnySelected = Boolean(selectedTargetId);
                              const isDimmed = isAnySelected && !isSelected;
                              const d = `M 160 8 C 160 36, ${destX} 32, ${destX} ${destY}`;

                              return (
                                <g key={target.id} className={styles.riverBranchGroup}>
                                  <path
                                    d={d}
                                    fill="none"
                                    stroke={isSelected ? 'url(#mobileRiverGradSkill)' : isDimmed ? 'var(--rule)' : 'url(#mobileRiverGradSkill)'}
                                    strokeWidth={isSelected ? 2.6 : isDimmed ? 1 : 1.5}
                                    strokeOpacity={isSelected ? 1 : isDimmed ? 0.15 : 0.65}
                                    className={`${styles.riverPath} ${isSelected ? styles.riverPathSelected : ''}`}
                                  />

                                  {/* Traveling Energy Pulse on Selected or Primary Edge */}
                                  {(isSelected || (!isAnySelected && idx === 0)) && (
                                    <circle r="3.2" fill="var(--signal)" filter="url(#mobileRiverGlow)">
                                      <animateMotion path={d} dur="1.6s" repeatCount="indefinite" />
                                    </circle>
                                  )}

                                  {/* Target Receptor Node */}
                                  <circle
                                    cx={destX}
                                    cy={destY}
                                    r={isSelected ? 5 : 3.5}
                                    fill={isSelected ? 'var(--signal)' : 'var(--surface-raised)'}
                                    stroke={isSelected ? 'var(--signal)' : 'var(--rule-strong)'}
                                    strokeWidth={isSelected ? 2 : 1}
                                    filter={isSelected ? 'url(#mobileRiverGlow)' : undefined}
                                  />
                                </g>
                              );
                            });
                          })()}
                        </svg>
                      </div>
                    ) : null}

                    <div className={styles.mobileConnectionsSection}>
                      <div className={styles.mobileConnectionsHeader}>
                        <span>CONNECTED DELIVERABLES</span>
                        <span className={styles.mobileConnectionsCount}>
                          {activeMobileSkill.targets.length}
                        </span>
                      </div>

                      <div className={styles.mobileTargetList}>
                        {(showAllTargets ? activeMobileSkill.targets : activeMobileSkill.targets.slice(0, 5)).map((target) => {
                          const isTargetActive = selectedTargetId === target.id;
                          return (
                            <div
                              key={target.id}
                              className={`${styles.mobileTargetItem} ${isTargetActive ? styles.mobileTargetItemActive : ''}`}
                              onClick={() => {
                                if (selectedTargetId !== target.id) {
                                  setSelectedTargetId(target.id);
                                } else {
                                  router.push(target.href);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Select deliverable ${target.name}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') router.push(target.href);
                              }}
                            >
                              <div className={styles.mobileTargetLeft}>
                                <span
                                  className={`${styles.mobileFlowPin} ${isTargetActive ? styles.mobileFlowPinActive : ''}`}
                                  aria-hidden="true"
                                />
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
                              <Link
                                href={target.href}
                                className={styles.mobileTargetArrowLink}
                                aria-label={`Open ${target.name}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className={styles.mobileTargetArrow}>→</span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>

                      {activeMobileSkill.targets.length > 5 ? (
                        <button
                          type="button"
                          className={styles.mobileShowMoreBtn}
                          onClick={() => setShowAllTargets(!showAllTargets)}
                        >
                          {showAllTargets
                            ? 'Show fewer deliverables ↑'
                            : `Show all ${activeMobileSkill.targets.length} deliverables (+${activeMobileSkill.targets.length - 5}) ↓`}
                        </button>
                      ) : null}
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
                        onClick={() => {
                          setSelectedTargetId(t.id);
                          setShowAllTargets(false);
                        }}
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

                    {/* Model 1: Flow Mode Switcher */}
                    <div className={styles.mobileFlowControl}>
                      <div className={styles.mobileFlowMeta}>
                        <span className={styles.mobileFlowPulse} />
                        <span>CIRCUIT RIVER FLOW</span>
                      </div>
                      <div className={styles.mobileFlowToggle}>
                        <button
                          type="button"
                          className={`${styles.mobileFlowToggleBtn} ${
                            mobileFlowMode === 'river' ? styles.mobileFlowToggleBtnActive : ''
                          }`}
                          onClick={() => setMobileFlowMode('river')}
                          aria-label="Vertical River Flow View"
                        >
                          🔀 River
                        </button>
                        <button
                          type="button"
                          className={`${styles.mobileFlowToggleBtn} ${
                            mobileFlowMode === 'list' ? styles.mobileFlowToggleBtnActive : ''
                          }`}
                          onClick={() => setMobileFlowMode('list')}
                          aria-label="List View"
                        >
                          📋 List
                        </button>
                      </div>
                    </div>

                    {/* Model 1: Vertical River SVG Emitter & Edges */}
                    {mobileFlowMode === 'river' && deliverableSkills.length > 0 ? (
                      <div className={styles.mobileRiverContainer} aria-hidden="true">
                        <div className={styles.mobileRiverHeader}>
                          <span className={styles.mobileRiverSourceLabel}>
                            SOURCE EMITTER · {activeMobileTarget.name.toUpperCase()}
                          </span>
                          <span className={styles.mobileRiverSignalRate}>
                            {deliverableSkills.length} SKILLS
                          </span>
                        </div>

                        <svg className={styles.mobileRiverSvg} viewBox="0 0 320 64" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="mobileRiverGradDeliverable" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="var(--signal-quiet)" stopOpacity="1" />
                              <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.85" />
                            </linearGradient>
                            <filter id="mobileRiverGlowDeliv" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="2.5" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>

                          {/* Top Source Emitter Node */}
                          <circle cx="160" cy="8" r="8" fill="none" stroke="var(--signal)" strokeWidth="1" opacity="0.4" className={styles.riverPulseRing} />
                          <circle cx="160" cy="8" r="4.5" fill="var(--signal)" filter="url(#mobileRiverGlowDeliv)" />

                          {/* Branching Vertical River Edges */}
                          {(() => {
                            const count = Math.min(deliverableSkills.length, showAllTargets ? deliverableSkills.length : 5);
                            const list = deliverableSkills.slice(0, count);
                            return list.map((sk, idx) => {
                              const destX = count === 1 ? 160 : 20 + (idx / (count - 1)) * 280;
                              const destY = 56;
                              const isSelected = selectedSkillId === sk.id;
                              const isAnySelected = Boolean(selectedSkillId);
                              const isDimmed = isAnySelected && !isSelected;
                              const d = `M 160 8 C 160 36, ${destX} 32, ${destX} ${destY}`;

                              return (
                                <g key={sk.id} className={styles.riverBranchGroup}>
                                  <path
                                    d={d}
                                    fill="none"
                                    stroke={isSelected ? 'url(#mobileRiverGradDeliverable)' : isDimmed ? 'var(--rule)' : 'url(#mobileRiverGradDeliverable)'}
                                    strokeWidth={isSelected ? 2.6 : isDimmed ? 1 : 1.5}
                                    strokeOpacity={isSelected ? 1 : isDimmed ? 0.15 : 0.65}
                                    className={`${styles.riverPath} ${isSelected ? styles.riverPathSelected : ''}`}
                                  />

                                  {/* Traveling Energy Pulse on Selected or Primary Edge */}
                                  {(isSelected || (!isAnySelected && idx === 0)) && (
                                    <circle r="3.2" fill="var(--signal)" filter="url(#mobileRiverGlowDeliv)">
                                      <animateMotion path={d} dur="1.6s" repeatCount="indefinite" />
                                    </circle>
                                  )}

                                  {/* Target Receptor Node */}
                                  <circle
                                    cx={destX}
                                    cy={destY}
                                    r={isSelected ? 5 : 3.5}
                                    fill={isSelected ? 'var(--signal)' : 'var(--surface-raised)'}
                                    stroke={isSelected ? 'var(--signal)' : 'var(--rule-strong)'}
                                    strokeWidth={isSelected ? 2 : 1}
                                    filter={isSelected ? 'url(#mobileRiverGlowDeliv)' : undefined}
                                  />
                                </g>
                              );
                            });
                          })()}
                        </svg>
                      </div>
                    ) : null}

                    <div className={styles.mobileConnectionsSection}>
                      <div className={styles.mobileConnectionsHeader}>
                        <span>SKILLS UTILIZED ({sectionTitle.toUpperCase()})</span>
                        <span className={styles.mobileConnectionsCount}>
                          {deliverableSkills.length}
                        </span>
                      </div>

                      <div className={styles.mobileTargetList}>
                        {(showAllTargets ? deliverableSkills : deliverableSkills.slice(0, 5)).map((skill) => {
                          const isSkillActive = selectedSkillId === skill.id;
                          return (
                            <div
                              key={skill.id}
                              className={`${styles.mobileTargetItem} ${isSkillActive ? styles.mobileTargetItemActive : ''}`}
                              onClick={() => {
                                if (selectedSkillId !== skill.id) {
                                  setSelectedSkillId(skill.id);
                                } else {
                                  router.push(skill.href);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Select skill ${skill.name}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') router.push(skill.href);
                              }}
                            >
                              <div className={styles.mobileTargetLeft}>
                                <span
                                  className={`${styles.mobileFlowPin} ${isSkillActive ? styles.mobileFlowPinActive : ''}`}
                                  aria-hidden="true"
                                />
                                <span className={styles.mobileTargetBadgeSkill}>SKILL</span>
                                <span className={styles.mobileTargetName}>{skill.name}</span>
                              </div>
                              <Link
                                href={skill.href}
                                className={styles.mobileTargetArrowLink}
                                aria-label={`Open ${skill.name}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className={styles.mobileTargetArrow}>→</span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>

                      {deliverableSkills.length > 5 ? (
                        <button
                          type="button"
                          className={styles.mobileShowMoreBtn}
                          onClick={() => setShowAllTargets(!showAllTargets)}
                        >
                          {showAllTargets
                            ? 'Show fewer skills ↑'
                            : `Show all ${deliverableSkills.length} skills (+${deliverableSkills.length - 5}) ↓`}
                        </button>
                      ) : null}
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
