/**
 * lib/graph.ts
 *
 * The portfolio is a graph, not a list of pages (§35). Authors write outbound
 * references only — `relatedSkills: ["kubernetes"]` — and this module derives
 * everything else, including the reverse edges. That means a product and a
 * skill can never disagree about whether they are connected.
 *
 * A reference to something that does not exist produces a dangling-ref notice,
 * never an exception (§68).
 */

import { ENTITY_KINDS } from '@/types/portfolio';
import type { Entity, EntityKind, Portfolio, RelationEdge, ResolvedEntity } from '@/types/portfolio';

/** The reference fields on `Entity`, and which collection each points into. */
const REFERENCE_FIELDS: Record<string, EntityKind> = {
  relatedSkills: 'skills',
  relatedProducts: 'products',
  relatedProjects: 'projects',
  relatedResearch: 'research',
  relatedPublications: 'publications',
  relatedExperience: 'experience',
  relatedEducation: 'education',
  relatedAwards: 'awards',
};

export function hrefFor(kind: EntityKind, slug: string): string {
  return `/${kind}/${slug}`;
}

export interface PortfolioGraph {
  /** Every entity, keyed `kind:id`. */
  byKey: Map<string, ResolvedEntity>;
  byKind: Map<EntityKind, ResolvedEntity[]>;
  warnings: string[];
  get(kind: EntityKind, idOrSlug: string): ResolvedEntity | undefined;
  list(kind: EntityKind): ResolvedEntity[];
  /** Neighbours of an entity, outbound and inbound, de-duplicated. */
  neighbours(entity: ResolvedEntity): RelationEdge[];
  /** Adjacent entities in the same collection, for previous/next (§12). */
  siblings(entity: ResolvedEntity): { previous?: ResolvedEntity; next?: ResolvedEntity };
}

function getEntityEndDate(entity: Entity): string {
  if (entity.period) {
    if (entity.period.ongoing) return '9999-12-31';
    if (entity.period.endDate) return String(entity.period.endDate);
    if (entity.period.startDate) return String(entity.period.startDate);
  }
  if ('issued' in entity && entity.issued) {
    return String(entity.issued);
  }
  if ('date' in entity && entity.date) {
    return String(entity.date);
  }
  if ('lastUpdated' in entity && entity.lastUpdated) {
    return String(entity.lastUpdated);
  }
  return '';
}

function getEntityStartDate(entity: Entity): string {
  if (entity.period?.startDate) return String(entity.period.startDate);
  return getEntityEndDate(entity);
}

function sortEntities(items: Entity[]): Entity[] {
  return [...items].sort((a, b) => {
    if (a.order !== undefined || b.order !== undefined) {
      return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
    }
    const aEnd = getEntityEndDate(a);
    const bEnd = getEntityEndDate(b);
    if (aEnd && bEnd && aEnd !== bEnd) return bEnd.localeCompare(aEnd); // newest first (top)
    const aStart = getEntityStartDate(a);
    const bStart = getEntityStartDate(b);
    if (aStart && bStart && aStart !== bStart) return bStart.localeCompare(aStart); // newest start date first
    if (aEnd && !bEnd) return -1;
    if (!aEnd && bEnd) return 1;
    return 0; // preserve authored order
  });
}


export function buildGraph(portfolio: Portfolio): PortfolioGraph {
  const byKey = new Map<string, ResolvedEntity>();
  const byKind = new Map<EntityKind, ResolvedEntity[]>();
  const warnings: string[] = [];

  // Pass 1 — materialise nodes.
  for (const kind of ENTITY_KINDS) {
    const raw = (portfolio[kind] ?? []) as Entity[];
    const resolved = sortEntities(raw).map<ResolvedEntity>((data) => ({
      kind,
      data,
      href: hrefFor(kind, data.slug),
      relations: [],
      backlinks: [],
      danglingRefs: [],
    }));
    byKind.set(kind, resolved);
    for (const entity of resolved) byKey.set(`${kind}:${entity.data.id}`, entity);
  }

  const lookup = (kind: EntityKind, id: string): ResolvedEntity | undefined => {
    const direct = byKey.get(`${kind}:${id}`);
    if (direct) return direct;
    return byKind.get(kind)?.find((candidate) => candidate.data.slug === id);
  };

  // Pass 2 — wire edges, both directions.
  for (const kind of ENTITY_KINDS) {
    for (const entity of byKind.get(kind) ?? []) {
      for (const [field, targetKind] of Object.entries(REFERENCE_FIELDS)) {
        const refs = (entity.data as unknown as Record<string, string[] | undefined>)[field] ?? [];
        for (const ref of refs) {
          const target = lookup(targetKind, ref);
          if (!target) {
            entity.danglingRefs.push(`${field}: ${ref}`);
            warnings.push(
              `${kind}[${entity.data.slug}].${field} references "${ref}", which is not in ${targetKind}. The link is hidden.`,
            );
            continue;
          }
          entity.relations.push({
            kind: target.kind,
            id: target.data.id,
            name: target.data.name,
            href: target.href,
            via: field,
          });
          target.backlinks.push({
            kind: entity.kind,
            id: entity.data.id,
            name: entity.data.name,
            href: entity.href,
            via: field,
          });
        }
      }
    }
  }

  const graph: PortfolioGraph = {
    byKey,
    byKind,
    warnings,
    get(kind, idOrSlug) {
      return lookup(kind, idOrSlug);
    },
    list(kind) {
      return byKind.get(kind) ?? [];
    },
    neighbours(entity) {
      const seen = new Set<string>();
      const out: RelationEdge[] = [];
      for (const edge of [...entity.relations, ...entity.backlinks]) {
        const key = `${edge.kind}:${edge.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(edge);
      }
      return out;
    },
    siblings(entity) {
      const list = byKind.get(entity.kind) ?? [];
      const index = list.findIndex((candidate) => candidate.data.id === entity.data.id);
      if (index === -1) return {};
      return { previous: list[index - 1], next: list[index + 1] };
    },
  };

  return graph;
}

/**
 * A skill's evidence is not authored on the skill — it is every entity that
 * claims to use it. This is what turns "I know Kubernetes" into "here is where
 * it ran" (§24, §36).
 */
export function evidenceForSkill(graph: PortfolioGraph, skillId: string): RelationEdge[] {
  const skill = graph.get('skills', skillId);
  if (!skill) return [];
  return graph.neighbours(skill).filter((edge) => edge.kind !== 'skills');
}
