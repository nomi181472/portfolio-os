/**
 * lib/search.ts
 *
 * A typed index over every entity, built once on the server and shipped to the
 * command menu as plain JSON (§38). No search dependency: the corpus is a few
 * hundred records, and a scoring pass over it costs well under a millisecond.
 *
 * Results always carry their kind, because "Kubernetes — skill" and
 * "Kubernetes migration — research" are different answers to the same query.
 */
import { ENTITY_KINDS } from '@/types/portfolio';
import type { EntityKind, Portfolio } from '@/types/portfolio';

export interface SearchRecord {
  kind: EntityKind;
  id: string;
  name: string;
  summary: string;
  href: string;
  status?: string;
  /** Lowercased haystack. Kept separate so the display text stays clean. */
  haystack: string;
}

export function buildIndex(portfolio: Portfolio): SearchRecord[] {
  const records: SearchRecord[] = [];
  for (const kind of ENTITY_KINDS) {
    for (const entity of portfolio[kind] ?? []) {
      const parts = [
        entity.name,
        entity.summary ?? '',
        entity.description ?? '',
        entity.tags.join(' '),
        entity.technologies.join(' '),
      ];
      records.push({
        kind,
        id: entity.id,
        name: entity.name,
        summary: entity.summary ?? entity.description?.slice(0, 120) ?? '',
        href: `/${kind}/${entity.slug}`,
        status: entity.status,
        haystack: parts.join(' ').toLowerCase(),
      });
    }
  }
  return records;
}

export function search(index: SearchRecord[], query: string, limit = 12): SearchRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);

  const scored = index
    .map((record) => {
      let score = 0;
      const name = record.name.toLowerCase();
      for (const term of terms) {
        if (!record.haystack.includes(term)) return { record, score: -1 };
        if (name === term) score += 100;
        else if (name.startsWith(term)) score += 40;
        else if (name.includes(term)) score += 20;
        else score += 5;
      }
      return { record, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((entry) => entry.record);
}
