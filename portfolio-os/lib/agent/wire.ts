/**
 * lib/agent/wire.ts
 *
 * Rebuilds the in-memory agent from what the knowledge route sent.
 *
 * The engine runs in the browser, not on the server — `PLAN.md` §5 puts every
 * module in `lib/agent/` as pure and DOM-free, and the data flow ends at the UI.
 * So the client receives the derived knowledge payload and has to reconstruct the
 * parts JSON cannot carry.
 *
 * `byKey` and `byKind` are `Map`s and therefore arrive as `{}`. That failure is
 * silent and nasty: a `Map` that became an object still *looks* present, so the
 * client would build an engine that answers every question with "no evidence"
 * rather than throwing. Both are rebuilt here from `records`, which is the only
 * input, so there is exactly one place where a missing `Map` can turn into a
 * wrong answer — and it is a place with a check on it.
 */
import type { KnowledgeRecord, KnowledgePayload, KnowledgeRecordWire, PortfolioKnowledge } from './types';
import type { EntityKind } from '@/types/portfolio';

/**
 * The failure mode this guards against.
 *
 * `JSON.stringify(new Map([['a', 1]]))` is `{}`, and `{}` passes every structural
 * check a caller would plausibly write. Asserting the *absence* of Maps in the
 * serialised payload catches it at the boundary instead.
 */
export function assertNoMaps(value: unknown, path = '$'): void {
  if (value instanceof Map || value instanceof Set) {
    throw new TypeError(`Map or Set reached the wire at ${path}; it would arrive as {}`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoMaps(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      assertNoMaps(entry, `${path}.${key}`);
    }
  }
}

/**
 * Text is optional on the wire because `?corpus=none` withholds it.
 *
 * The retrieval index is built from `record.text`, so a client that fetched the
 * lean payload cannot run local lexical retrieval over it. It can still answer
 * anything driven by the alias table and the evidence graph, which is where
 * every claim in this system comes from; what it cannot do is retrieve.
 */
function withText(record: KnowledgeRecordWire): KnowledgeRecord {
  return { ...record, text: record.text ?? '' } as KnowledgeRecord;
}

export function rehydrateKnowledge(payload: KnowledgePayload): PortfolioKnowledge {
  assertNoMaps(payload);

  const records = payload.records.map(withText);

  const byKey = new Map<string, KnowledgeRecord>();
  const byKind = new Map<EntityKind, KnowledgeRecord[]>();

  for (const record of records) {
    byKey.set(record.key, record);
    const bucket = byKind.get(record.kind);
    if (bucket) bucket.push(record);
    else byKind.set(record.kind, [record]);
  }

  return {
    profile: payload.profile,
    availability: payload.availability,
    services: payload.services,
    records,
    byKey,
    byKind,
    experienceSpan: payload.experienceSpan,
    navigation: payload.navigation,
    // Not on the wire by design — see `KnowledgePayload`. The server holds the
    // real reading in the `X-Knowledge-Generated-At` header; this value exists so
    // the type is satisfied and nothing reads it.
    generatedAt: '',
  };
}

/** True when the payload carries the haystack that local retrieval needs. */
export function canRetrieveLocally(payload: KnowledgePayload): boolean {
  return payload.records.every((record) => typeof record.text === 'string' && record.text.length > 0);
}