/**
 * components/home/Schematic.tsx
 *
 * The hero diagram. Precomputes graph geometry and weights from the portfolio
 * graph and delegates to the interactive SchematicView client component for
 * full relationship highlighting on hover.
 */

import { CATEGORIES } from '@/lib/categories';
import type { PortfolioGraph } from '@/lib/graph';
import type { EntityKind } from '@/types/portfolio';
import {
  SchematicView,
  type SerializableNode,
  type SerializableEdge,
  type SerializableSpoke,
} from './SchematicView';

const W = 720;
const H = 420;
const CX = W / 2;
const CY = H / 2 + 6;

/** Placement is fixed so the diagram is stable between visits and deploys. */
const RING: { kind: EntityKind; angle: number; radius: number }[] = [
  { kind: 'products', angle: -90, radius: 150 },
  { kind: 'projects', angle: -28, radius: 168 },
  { kind: 'research', angle: 30, radius: 158 },
  { kind: 'publications', angle: 78, radius: 186 },
  { kind: 'skills', angle: 128, radius: 150 },
  { kind: 'experience', angle: 180, radius: 168 },
  { kind: 'education', angle: 220, radius: 182 },
  { kind: 'leadership', angle: 255, radius: 196 },
  { kind: 'awards', angle: 290, radius: 180 },
];

function place(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: CX + Math.cos(radians) * radius * 1.15, y: CY + Math.sin(radians) * radius * 0.72 };
}

export function Schematic({ graph, name }: { graph: PortfolioGraph; name: string }) {
  const rawNodes = RING.map((entry) => {
    const entities = graph.list(entry.kind);
    return {
      ...entry,
      ...place(entry.angle, entry.radius),
      count: entities.length,
      category: CATEGORIES[entry.kind],
    };
  }).filter((node) => node.count > 0);

  // Edge weights from the real graph: how many relationships cross each pair.
  const weights = new Map<string, number>();
  for (const node of rawNodes) {
    for (const entity of graph.list(node.kind)) {
      for (const edge of graph.neighbours(entity)) {
        if (edge.kind === node.kind) continue;
        const key = [node.kind, edge.kind].sort().join('~');
        weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }

  const rawEdges = rawNodes.flatMap((from, index) =>
    rawNodes.slice(index + 1).flatMap((to) => {
      const weight = weights.get([from.kind, to.kind].sort().join('~')) ?? 0;
      if (weight === 0) return [];
      return [{ from, to, weight }];
    }),
  );

  const maxWeight = Math.max(1, ...rawEdges.map((edge) => edge.weight));

  const nodes: SerializableNode[] = rawNodes.map((node) => ({
    kind: node.kind,
    label: node.category.label,
    count: node.count,
    x: node.x,
    y: node.y,
    radius: 7 + Math.min(9, node.count * 0.9),
  }));

  const edges: SerializableEdge[] = rawEdges.map(({ from, to, weight }, index) => ({
    id: `${from.kind}-${to.kind}`,
    fromKind: from.kind,
    toKind: to.kind,
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    baseWidth: 0.5 + (weight / maxWeight) * 1.2,
    animationDelay: `${180 + index * 42}ms`,
  }));

  const spokes: SerializableSpoke[] = rawNodes.map((node, index) => ({
    kind: node.kind,
    x: node.x,
    y: node.y,
    animationDelay: `${index * 55}ms`,
  }));

  return (
    <SchematicView
      nodes={nodes}
      edges={edges}
      spokes={spokes}
      name={name}
      width={W}
      height={H}
      cx={CX}
      cy={CY}
    />
  );
}
