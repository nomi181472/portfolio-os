/**
 * lib/agent/knowledge.ts
 *
 * The adapter from `portfolio.json` to the shape the agent reasons over.
 *
 * The important property is that this file *derives* rather than *declares*.
 * Every record, every href, every evidence edge and the whole experience span are
 * read out of the content document and the graph in `lib/graph.ts`. Nothing here
 * is a second copy of a fact, which is what keeps the agent from drifting away
 * from the site it is supposed to describe.
 *
 * Three decisions worth reading before the code:
 *
 * 1. **Keys are `${kind}:${id}`, never slugs.** `projects[0]` and `research[0]`
 *    both model lab.nomanali.online and carry near-identical slugs and identical
 *    names. A slug-keyed registry would silently merge or misroute them.
 *
 * 2. **Availability wording is written here and read verbatim.** The model does
 *    not get to decide what "closed" sounds like. See `AVAILABILITY_STATEMENT`.
 *
 * 3. **The experience span is computed, never read from `briefing.yearsActive`.**
 *    The briefing says 5; the union of the two documented roles is 4.83 years as
 *    of 2026-09-30, and the owner-asserted number will not be true until ~Feb
 *    2027. An agent that quotes the static string makes a false claim that
 *    happens to be correct next year.
 *
 * Pure and DOM-free: the same function runs in the route handler and in tests.
 */

import { ENTITY_KINDS } from '@/types/portfolio';
import type { Entity, EntityKind, Portfolio } from '@/types/portfolio';
import { buildGraph, hrefFor, type PortfolioGraph } from '@/lib/graph';
import { buildNavigationRegistry } from './navigation';
import type {
  AvailabilityKnowledge,
  EntityRef,
  ExperienceSpan,
  KnowledgeLink,
  KnowledgeRecord,
  NavigationTarget,
  PortfolioKnowledge,
} from './types';

/* ------------------------------------------------------- availability text */

/**
 * The only sentences the agent is ever allowed to produce about availability.
 *
 * A `null` statement is meaningful: it means the agent has nothing to say and
 * must not volunteer a guess. That is the `'closed'` case, and it is the reason
 * the enum exists rather than a boolean — a boolean would have forced one of
 * the three real states to be expressed as the absence of the others, and
 * "not open to work" is a claim too.
 */
function buildAvailability(portfolio: Portfolio): AvailabilityKnowledge {
  const raw = portfolio.availability;
  const name = portfolio.profile?.name || 'The candidate';
  const statements: Record<AvailabilityKnowledge['status'], string | null> = {
    'open-to-work': `${name} is currently open to work.`,
    'looking-for-opportunities': `${name} is open to conversations about opportunities, though the portfolio does not state an active search.`,
    closed: null,
  };

  return {
    status: raw.status,
    ...(raw.note === undefined ? {} : { note: raw.note }),
    ...(raw.updatedAt === undefined ? {} : { updatedAt: raw.updatedAt }),
    statement: statements[raw.status],
  };
}

/* ------------------------------------------------------------ text corpus */

/**
 * The single string both the embedder and the lexical scorer read.
 *
 * Built once per record so a document cannot rank well on one path and badly on
 * the other for reasons that have nothing to do with the query. Markdown is
 * stripped with the same rules `buildHaystack` uses, because a search index full
 * of `#` and `[…](…)` returns matches on table rows.
 */
function corpusFor(entity: Entity, kind: EntityKind): string {
  const body = (entity.body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
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
    // The kind is searchable so "certification" finds a certification without
    // the word appearing in the record.
    kind,
    // Specialised fields. `buildGraph` widens every collection to the base
    // `Entity`, so `role`, `systems`, `category` and the rest are read back off
    // a loose record rather than off a type that no longer describes them. This
    // is the one place the widening is undone, deliberately and in one spot.
    looseString(entity, 'role'),
    looseString(entity, 'tagline'),
    looseString(entity, 'impact'),
    looseString(entity, 'category'),
    looseString(entity, 'depth'),
    looseString(entity, 'discipline'),
    looseString(entity, 'degree'),
    looseString(entity, 'field'),
    looseString(entity, 'institution'),
    looseString(entity, 'venue'),
    looseString(entity, 'scope'),
    looseString(entity, 'contribution'),
    looseString(entity, 'vision'),
    looseString(entity, 'concept'),
    looseString(entity, 'problem'),
    looseString(entity, 'hypothesis'),
    looseString(entity, 'approach'),
    looseString(entity, 'implementation'),
    looseString(entity, 'results'),
    looseString(entity, 'lessons'),
    looseString(entity, 'futureWork'),
    looseString(entity, 'abstract'),
    looseString(entity, 'findings'),
    looseString(entity, 'citation'),
    looseString(entity, 'architecture'),
    looseString(entity, 'outcome'),
    looseString(entity, 'professionalContext'),
    looseString(entity, 'reason'),
    looseString(entity, 'context'),
    ...looseStrings(entity, 'systems'),
    ...looseStrings(entity, 'responsibilities'),
    ...looseStrings(entity, 'achievements'),
    ...looseStrings(entity, 'features'),
    ...looseStrings(entity, 'subjects'),
    ...looseStrings(entity, 'metrics'),
    ...looseStrings(entity, 'integrations'),
    ...entity.tags,
    ...entity.technologies,
    ...entity.links.map((link) => link.label),
    ...entity.evidence.map((item) => `${item.claim} ${item.note ?? ''}`),
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();
}

function looseString(entity: Entity, field: string): string {
  const value = (entity as unknown as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : '';
}

function looseStrings(entity: Entity, field: string): string[] {
  const value = (entity as unknown as Record<string, unknown>)[field];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toRef(kind: EntityKind, id: string, name: string, href: string): EntityRef {
  return { key: `${kind}:${id}`, kind, id, name, href };
}

/* ------------------------------------------------------------- experience */

/**
 * Months since year 0, so bare years, year-months and full dates all land on the
 * same integer axis. `lib/format.ts` treats a bare "2022" as January for the
 * same reason: it is the earliest instant the string can be describing, and
 * over-claiming duration is the worse error.
 */
function monthIndex(value: string): number {
  const [year, month] = value.split('-');
  return Number(year) * 12 + (month ? Number(month) - 1 : 0);
}

function monthsBetween(from: number, to: number): number {
  return Math.max(0, to - from + 1);
}

/**
 * The union of documented employment, with gaps reported rather than hidden.
 *
 * Summing the roles would give a different and wrong answer: the MS in Data
 * Science (2023-08 → 2025-06) overlaps both jobs, and a naive sum would double
 * count it. Unioning the intervals is also what makes the 4-month gap between
 * Ktrade and QBS visible instead of quietly absorbed.
 */
function buildExperienceSpan(portfolio: Portfolio, graph: PortfolioGraph, now: Date): ExperienceSpan {
  const nowMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const roles: ExperienceSpan['roles'] = [];

  for (const entity of graph.list('experience')) {
    const data = entity.data as Portfolio['experience'][number];
    const start = data.period?.startDate ? monthIndex(String(data.period.startDate)) : null;
    // An ongoing role runs to today; a finished one runs to its end date. A role
    // with no dates at all is excluded rather than guessed at.
    const end = data.period?.ongoing
      ? nowMonth
      : data.period?.endDate
        ? monthIndex(String(data.period.endDate))
        : null;

    if (start === null || end === null) continue;

    roles.push({
      // Canonical, like every other key in this module. A bare `id` here was
      // indistinguishable from a slug at the call site, so resolving a role to a
      // destination failed the `unknown-target` check and every availability
      // answer came back with cards it could not link.
      key: `experience:${entity.data.id}`,
      name: data.role ?? data.name,
      organisation: data.organisation ?? '',
      href: entity.href,
      start: data.period?.startDate === undefined ? undefined : String(data.period.startDate),
      end: data.period?.ongoing
        ? undefined
        : data.period?.endDate === undefined
          ? undefined
          : String(data.period.endDate),
      ongoing: Boolean(data.period?.ongoing),
      // Interval is carried separately so the merge below does not have to
      // re-parse the dates.
      ...({ __from: start, __to: end } as Record<string, number>),
    });
  }

  if (roles.length === 0) {
    return { months: 0, years: 0, first: '', last: '', gapMonths: 0, roles: [] };
  }

  const intervals = (roles as unknown as Array<Record<string, unknown>>)
    .map((role) => ({ from: role.__from as number, to: role.__to as number }))
    .sort((a, b) => a.from - b.from);

  const merged: { from: number; to: number }[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    // `to + 1` so two adjacent roles (one ends 2023-10, next starts 2023-11)
    // merge instead of leaving a phantom one-month gap.
    if (last && interval.from <= last.to + 1) {
      last.to = Math.max(last.to, interval.to);
    } else {
      merged.push({ ...interval });
    }
  }

  const totalMonths = merged.reduce((sum, interval) => sum + monthsBetween(interval.from, interval.to), 0);
  const first = merged[0];
  const lastInterval = merged[merged.length - 1];
  if (!first || !lastInterval) {
    return { months: 0, years: 0, first: '', last: '', gapMonths: 0, roles };
  }

  const calendarMonths = monthsBetween(first.from, lastInterval.to);

  // `roles` was built in graph order, which is data order, not date order. The
  // span has to be read off the sorted intervals, so the sort and the display
  // list are the same list.
  const dated = (roles as unknown as Array<Record<string, unknown>>)
    .map((role) => ({ role, from: role.__from as number, to: role.__to as number }))
    .sort((a, b) => a.from - b.from);
  const clean = dated.map(
    ({ role: { __from: _from, __to: _to, ...rest } }) => rest as ExperienceSpan['roles'][number],
  );

  const firstRole = clean[0];
  const lastRole = clean[clean.length - 1];

  return {
    months: totalMonths,
    // One decimal, truncated rather than rounded, so the figure never overstates.
    // 4.9 years must not come from 4.83 being rounded up and then quoted as five.
    years: Math.floor((totalMonths / 12) * 10) / 10,
    first: firstRole?.start ?? '',
    // An ongoing role has no end date; the span does not stop, so this reports
    // `present` rather than a stale date from the last finished role.
    last: lastRole ? (lastRole.ongoing ? 'present' : (lastRole.end ?? 'present')) : '',
    gapMonths: Math.max(0, calendarMonths - totalMonths),
    roles: clean,
  };
}

/* ----------------------------------------------------------------- build */

export interface BuildKnowledgeOptions {
  /** Injected so tests are not at the mercy of the wall clock. */
  now?: Date;
}

export function buildKnowledge(
  portfolio: Portfolio,
  graph: PortfolioGraph = buildGraph(portfolio),
  options: BuildKnowledgeOptions = {},
): PortfolioKnowledge {
  const now = options.now ?? new Date();
  const records: KnowledgeRecord[] = [];
  const byKey = new Map<string, KnowledgeRecord>();
  const byKind = new Map<EntityKind, KnowledgeRecord[]>();

  for (const kind of ENTITY_KINDS) {
    const list: KnowledgeRecord[] = [];

    for (const resolved of graph.list(kind)) {
      const entity = resolved.data;
      const links: KnowledgeLink[] = entity.links.map((link) => ({
        label: link.label,
        url: link.url,
        type: link.type,
      }));

      // Evidence = the non-skill entities that reference this record, in either
      // direction. 35.7% of authored edges are one-way, so reading only
      // `relations` would miss most corroboration; `neighbours` merges both.
      const evidence: EntityRef[] = [];
      for (const edge of graph.neighbours(resolved)) {
        if (edge.kind === 'skills') continue;
        evidence.push(toRef(edge.kind, edge.id, edge.name, edge.href));
      }

      const record: KnowledgeRecord = {
        key: `${kind}:${entity.id}`,
        kind,
        id: entity.id,
        slug: entity.slug,
        name: entity.name,
        href: hrefFor(kind, entity.slug),
        summary: entity.summary ?? entity.description?.slice(0, 240) ?? '',
        text: corpusFor(entity, kind),
        technologies: [...entity.technologies],
        tags: [...entity.tags],
        ...('aliases' in entity && Array.isArray(entity.aliases) ? { aliases: [...entity.aliases] } : {}),
        featured: Boolean(entity.featured),
        evidence,
        links,
        ...(entity.organisation === undefined ? {} : { organisation: entity.organisation }),
        ...(entity.status === undefined ? {} : { status: entity.status }),
        ...('depth' in entity && typeof entity.depth === 'string' ? { depth: entity.depth } : {}),
        ...(entity.period === undefined
          ? {}
          : {
              period: {
                ...(entity.period.startDate === undefined ? {} : { start: String(entity.period.startDate) }),
                ...(entity.period.endDate === undefined ? {} : { end: String(entity.period.endDate) }),
                ongoing: Boolean(entity.period.ongoing),
              },
            }),
      };

      list.push(record);
      byKey.set(record.key, record);
    }

    byKind.set(kind, list);
    records.push(...list);
  }

  return {
    profile: {
      name: portfolio.profile.name,
      ...(portfolio.profile.discipline === undefined ? {} : { discipline: portfolio.profile.discipline }),
      ...(portfolio.profile.positioning === undefined ? {} : { positioning: portfolio.profile.positioning }),
      ...(portfolio.profile.location === undefined ? {} : { location: portfolio.profile.location }),
      ...(portfolio.profile.email === undefined ? {} : { email: portfolio.profile.email }),
      ...(portfolio.profile.briefing.focus === undefined ? {} : { focus: portfolio.profile.briefing.focus }),
      ...(portfolio.profile.briefing.specialisation === undefined
        ? {}
        : { specialisation: portfolio.profile.briefing.specialisation }),
      ...(portfolio.profile.briefing.philosophy === undefined
        ? {}
        : { philosophy: portfolio.profile.briefing.philosophy }),
      ...(portfolio.profile.briefing.yearsActive === undefined
        ? {}
        : { statedYearsActive: portfolio.profile.briefing.yearsActive }),
      domains: [...portfolio.profile.briefing.domains],
      industries: [...portfolio.profile.briefing.industries],
      links: portfolio.profile.links.map((link) => ({ label: link.label, url: link.url, type: link.type })),
    },
    availability: buildAvailability(portfolio),
    ...(portfolio.taxonomy
      ? {
          taxonomy: {
            families: portfolio.taxonomy.families ?? {},
            aliases: portfolio.taxonomy.aliases ?? {},
          },
        }
      : {}),
    services: [],
    records,
    byKey,
    byKind,
    experienceSpan: buildExperienceSpan(portfolio, graph, now),
    navigation: buildNavigationRegistry(portfolio).targets,
    generatedAt: now.toISOString(),
  };
}

/**
 * `profile.briefing.yearsActive` is the owner's own number and is preserved for
 * display, but `experienceSpan.years` is what any statement about duration must
 * be built from. This helper exists so no call site reaches for the static field
 * by accident.
 */
export function documentedYears(knowledge: PortfolioKnowledge): number {
  return knowledge.experienceSpan.years;
}
