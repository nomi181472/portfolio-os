'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EntityKind } from '@/types/portfolio';
import styles from './Schematic.module.css';

export interface SerializableNode {
  kind: EntityKind;
  label: string;
  count: number;
  x: number;
  y: number;
  radius: number;
}

export interface SerializableEdge {
  id: string;
  fromKind: EntityKind;
  toKind: EntityKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  baseWidth: number;
  animationDelay: string;
}

export interface SerializableSpoke {
  kind: EntityKind;
  x: number;
  y: number;
  animationDelay: string;
}

interface SchematicViewProps {
  nodes: SerializableNode[];
  edges: SerializableEdge[];
  spokes: SerializableSpoke[];
  name: string;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export function SchematicView({
  nodes,
  edges,
  spokes,
  name,
  width,
  height,
  cx,
  cy,
}: SchematicViewProps) {
  const [hoveredKind, setHoveredKind] = useState<EntityKind | null>(null);
  const [selectedKind, setSelectedKind] = useState<EntityKind | null>(null);

  const activeKind = hoveredKind || selectedKind;

  // Compute set of connected kinds when a node is active
  const connectedKinds = new Set<EntityKind>();
  if (activeKind) {
    connectedKinds.add(activeKind);
    for (const edge of edges) {
      if (edge.fromKind === activeKind) connectedKinds.add(edge.toKind);
      if (edge.toKind === activeKind) connectedKinds.add(edge.fromKind);
    }
  }

  const isInspectionActive = activeKind !== null;
  const activeNode = nodes.find((n) => n.kind === activeKind);

  // Connected category labels for the inspector
  const connectedNames = activeKind
    ? nodes
        .filter((n) => n.kind !== activeKind && connectedKinds.has(n.kind))
        .map((n) => n.label)
    : [];

  return (
    <div className={styles.frame}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.svg}
        role="img"
        aria-label={`Schematic of ${name}'s work: ${nodes.map((node) => `${node.count} ${node.label.toLowerCase()}`).join(', ')}.`}
        onClick={(e) => {
          // Clicking on the backdrop clears selection
          if (e.target === e.currentTarget || (e.target as SVGElement).tagName === 'line') {
            setSelectedKind(null);
          }
        }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Measurement grid: a drawing surface */}
        <g className={styles.grid} aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={(width / 8) * i} y1="0" x2={(width / 8) * i} y2={height} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={(height / 5) * i} x2={width} y2={(height / 5) * i} />
          ))}
        </g>

        {/* Connecting relationship edges */}
        <g aria-hidden="true">
          {edges.map((edge) => {
            const isConnected =
              isInspectionActive && (edge.fromKind === activeKind || edge.toKind === activeKind);
            const isDimmed = isInspectionActive && !isConnected;

            let edgeClass = styles.edge;
            if (isConnected) edgeClass += ` ${styles.edgeHighlighted}`;
            else if (isDimmed) edgeClass += ` ${styles.edgeDimmed}`;

            return (
              <line
                key={edge.id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                className={edgeClass}
                strokeWidth={isConnected ? edge.baseWidth * 1.6 + 1.2 : edge.baseWidth}
                style={{ animationDelay: edge.animationDelay }}
              />
            );
          })}

          {/* Central spokes */}
          {spokes.map((spoke) => {
            const isSpokeActive = isInspectionActive && spoke.kind === activeKind;
            const isSpokeDimmed = isInspectionActive && !isSpokeActive;

            let spokeClass = styles.spoke;
            if (isSpokeActive) spokeClass += ` ${styles.spokeHighlighted}`;
            else if (isSpokeDimmed) spokeClass += ` ${styles.spokeDimmed}`;

            return (
              <line
                key={`spoke-${spoke.kind}`}
                x1={cx}
                y1={cy}
                x2={spoke.x}
                y2={spoke.y}
                className={spokeClass}
                style={{ animationDelay: spoke.animationDelay }}
              />
            );
          })}
        </g>

        {/* Centre aperture / core */}
        <g aria-hidden="true" className={`${styles.core} ${isInspectionActive ? styles.coreHovered : ''}`}>
          <circle cx={cx} cy={cy} r="26" />
          <circle cx={cx} cy={cy} r="16" className={styles.coreInner} />
          <circle cx={cx} cy={cy} r="3.5" className={styles.coreDot} />
        </g>

        {/* Interactive nodes */}
        {nodes.map((node, index) => {
          const isTarget = activeKind === node.kind;
          const isNeighbor = isInspectionActive && !isTarget && connectedKinds.has(node.kind);
          const isDimmed = isInspectionActive && !isTarget && !isNeighbor;

          let nodeClass = styles.node;
          if (isTarget) nodeClass += ` ${styles.nodeActive}`;
          else if (isNeighbor) nodeClass += ` ${styles.nodeNeighbor}`;
          else if (isDimmed) nodeClass += ` ${styles.nodeDimmed}`;

          return (
            <Link
              key={node.kind}
              href={`/${node.kind}`}
              className={nodeClass}
              style={{ animationDelay: `${300 + index * 60}ms` }}
              onMouseEnter={() => setHoveredKind(node.kind)}
              onMouseLeave={() => setHoveredKind(null)}
              onFocus={() => setHoveredKind(node.kind)}
              onBlur={() => setHoveredKind(null)}
              onClick={(e) => {
                // On first touch/tap on mobile, inspect connections instead of navigating immediately
                if (selectedKind !== node.kind) {
                  e.preventDefault();
                  setSelectedKind(node.kind);
                }
              }}
            >
              {/* Outer ripple halo on active state */}
              {isTarget && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 6}
                  className={styles.nodeHalo}
                />
              )}

              {/* Main circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                className={styles.nodeShape}
              />

              {/* Extended touch/pointer hit area (44px min touch target compliant) */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius + 18}
                className={styles.nodeHit}
              />

              {/* Section label */}
              <text
                x={node.x}
                y={node.y - node.radius - 12}
                className={styles.nodeLabel}
                textAnchor="middle"
              >
                {node.label}
              </text>

              {/* Count label */}
              <text
                x={node.x}
                y={node.y + node.radius + 18}
                className={styles.nodeCount}
                textAnchor="middle"
              >
                {node.count}
              </text>
            </Link>
          );
        })}
      </svg>

      {/* Floating Inspection Bar for Touch / Active Node */}
      {activeNode ? (
        <div className={styles.inspector} role="status">
          <div className={styles.inspectorInfo}>
            <div className={styles.inspectorTitle}>
              {activeNode.label} · {activeNode.count} {activeNode.count === 1 ? 'record' : 'records'}
            </div>
            <div className={styles.inspectorSubtitle}>
              {connectedNames.length > 0
                ? `Connected to ${connectedNames.join(', ')}`
                : 'Central System Node'}
            </div>
          </div>
          <Link href={`/${activeNode.kind}`} className={styles.inspectorAction}>
            <span>Explore</span>
            <span>→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
