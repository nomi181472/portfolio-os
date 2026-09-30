/**
 * lib/search.ts
 *
 * A typed index over every entity, built on the server and served to the command
 * menu as plain JSON (§38). No search dependency: the corpus is a few hundred
 * records, and a scoring pass over it costs well under a millisecond.
 *
 * Results always carry their kind, because "Kubernetes — skill" and
 * "Kubernetes migration — research" are different answers to the same query.
 *
 * Two halves live here. `buildIndex` is server-only — it is the part that reads
 * the content file. `search` and `buildHaystack` are pure, and are imported by
 * the browser bundle and by the tests.
 */
import { ENTITY_KINDS } from '@/types/portfolio';
import type { Entity, EntityKind, Portfolio } from '@/types/portfolio';
import { hrefFor } from '@/lib/graph';

export interface SearchRecord {
  kind: EntityKind;
  id: string;
  name: string;
  summary: string;
  href: string;
  organisation?: string;
  status?: string;
  /**
   * The best date the record can offer, used only to break ties between results
   * that score identically. It is the period's end where one exists and its start
   * otherwise, because a role that is still running has no end to report.
   */
  updatedAt?: string;
  /** Lowercased haystack. Kept separate so the display text stays clean. */
  haystack: string;
}

/**
 * One record per entity.
 *
 * The href comes from `hrefFor` rather than a template written here, so a result
 * cannot point at a URL the router does not serve — which is exactly what happens
 * the first time the two disagree about how a slug is spelled.
 */
export function buildIndex(portfolio: Portfolio): SearchRecord[] {
  const records: SearchRecord[] = [];
  for (const kind of ENTITY_KINDS) {
    for (const entity of portfolio[kind] ?? []) {
      records.push({
        kind,
        id: entity.id,
        name: entity.name,
        summary: entity.summary ?? entity.description?.slice(0, 120) ?? '',
        href: hrefFor(kind, entity.slug),
        organisation: entity.organisation,
        status: entity.status,
        updatedAt: entity.period?.endDate ?? entity.period?.startDate,
        haystack: buildHaystack(entity, kind),
      });
    }
  }
  return records;
}

/* --------------------------------------------------------------- ranking */

/**
 * Prefix-matched terms beat substring-matched ones, and an exact name is treated
 * as a direct hit. A record containing one term in a long description scores the
 * same as one with that term in its name; this makes the difference visible.
 */
function scoreRecord(record: SearchRecord, terms: string[]): number {
  const name = record.name.toLowerCase();
  const summary = (record.summary ?? '').toLowerCase();
  const organisation = (record.organisation ?? '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (name === term) score += 100;
    else if (name.startsWith(term)) score += 40;
    else if (name.includes(term)) score += 20;
    else if (summary.includes(term)) score += 8;
    else if (organisation.includes(term)) score += 8;
    // A term only in the long text is a genuine but weak hit, and still better
    // than nothing — but it must rank below a record that has it in a field a
    // person would recognise, which is the whole difference between these arms.
    else if (record.haystack.includes(term)) score += 1;
    else return 0;
  }
  return score;
}

/**
 * A rank-ordered list of matches. `limit` is applied last and applies only to
 * rows the user sees; a caller that wants the full picture asks without one.
 */
export function search(records: SearchRecord[], query: string, limit = 12): SearchRecord[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  // One pass over the index; the work per record is a handful of includes().
  const scored: { record: SearchRecord; score: number }[] = [];
  for (const record of records) {
    const score = scoreRecord(record, terms);
    if (score > 0) scored.push({ record, score });
  }

  // Two ranking passes rather than one.
  //
  // The first is the score, descending. The second is what breaks ties, and the
  // tie is the interesting case: on a short query most of the index ties at the
  // same low score, because "test" appears in the long text of nearly everything.
  //
  // Ordering the ties by name is what the old code did, and it produced the
  // behaviour this replaces — 400 rows tied at 1, cut to 12, which means the
  // results you saw were the first 12 in whatever order the content file happened
  // to be written in. Alphabetically first is not "most relevant"; it is an
  // accident of authoring.
  //
  // So: score first, then recency where the records carry dates, then name as the
  // stable last resort. Recency is the better guess for a portfolio because the
  // newest work is usually the work someone is pointing at when they search for it
  // by a word they half-remember.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byDate = (b.record.updatedAt ?? '').localeCompare(a.record.updatedAt ?? '');
    if (byDate !== 0) return byDate;
    return a.record.name.localeCompare(b.record.name);
  });

  return scored.slice(0, limit).map((entry) => entry.record);
}

/**
 * The fields a query is matched against.
 *
 * `body` is the long-form markdown: a research note's prose, a product's whole
 * technical write-up. Leaving it out meant the only way to find a page by
 * something it discussed was for that word to also appear in a tag, a title, or a
 * one-line summary. The cost is that long text produces the ties the ranking
 * above exists to break.
 *
 * `links` are included because a link's label is often the only place a partner,
 * client or paper title appears at all.
 *
 * Markdown syntax is stripped before it reaches the haystack rather than
 * tokenised: an index containing `#`, `*` and `|` returns matches on table rows
 * and heading markers, and `[Klystr](https://…)` would otherwise match a search
 * for "https".
 */
export function buildHaystack(entity: Entity, kind: EntityKind): string {
  const body = (entity.body ?? '')
    .replace(/```[\s\S]*?```/g, ' ') // fenced blocks carry code, not prose
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images before links: same syntax, and alt text is not searchable
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`|]/g, ' ')
    .replace(/\s+/g, ' ');

  return [
    entity.name,
    entity.summary,
    entity.description,
    body,
    entity.organisation,
    entity.status,
    // The kind is in the haystack so "certification" finds a certification without
    // the word having to appear in the record itself.
    kind,
    ...entity.tags,
    ...entity.technologies,
    // Link *labels* only — the URL is deliberately excluded; see above.
    ...entity.links.map((link) => link.label),
    // A skill's evidence is the sentence that claims the skill, and often the only
    // wording a hiring reader would actually search for.
    ...entity.evidence.map((evidence) => `${evidence.claim} ${evidence.note ?? ''}`),
    ...entity.timeline.map((event) => `${event.label} ${event.detail ?? ''}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
