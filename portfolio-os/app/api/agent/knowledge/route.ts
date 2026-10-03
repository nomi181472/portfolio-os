/**
 * app/api/agent/knowledge/route.ts
 *
 * Ships the derived portfolio to the chat widget.
 *
 * The route does no reasoning. It reads the content document, builds
 * `PortfolioKnowledge` in pure code, and serialises it. Everything the agent is
 * allowed to say is already in this payload, which is the property that makes the
 * "every claim is traceable to a content path" checkpoint checkable: there is no
 * other source for the client to draw on.
 *
 * Three decisions that are not obvious from the code:
 *
 * - **`?corpus=none` exists because the corpus is the biggest single component.**
 *   Measured against the current content: the full payload is ~193 kB raw /
 *   ~39 kB gzipped, made up of ~80 kB of corpus, ~50 kB of evidence edges and
 *   ~6 kB of everything else. Dropping the corpus gives ~110 kB / ~17 kB, a 56%
 *   saving on the wire. A client that scores server-side, or that only wants to
 *   render cards, does not need 80 kB of lowercased haystack in memory. The size
 *   of what was withheld is reported rather than hidden, so a caller can decide
 *   whether the saving was worth the loss of local retrieval.
 *
 * - **`force-dynamic` is required, not defensive.** A GET route handler that
 *   touches no dynamic API is treated as static by Next, which would snapshot
 *   this response at build time. The search route has the same constraint for the
 *   same reason. The `now` used for the computed experience span also has to stay
 *   a request-time value or the figure silently goes stale.
 *
 * - **Cache headers are `must-revalidate` and content-addressed by ETag.** The
 *   payload is identical for every visitor and changes only when the content file
 *   does, so it is worth caching — but only with a validator, or a deploy that
 *   changes the content would keep serving the old portfolio to whoever has it
 *   cached.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';

import { getPortfolio } from '@/lib/source';
import { buildGraph } from '@/lib/graph';
import { buildKnowledge } from '@/lib/agent/knowledge';
import type { KnowledgePayload } from '@/lib/agent/types';

export const dynamic = 'force-dynamic';

type CacheEntry = { body: string; etag: string; generatedAt: string };
let cache: Map<'full' | 'lean', CacheEntry> | null = null;

async function payloadFor(variant: 'full' | 'lean'): Promise<CacheEntry> {
  if (process.env.NODE_ENV === 'production' && cache) {
    const hit = cache.get(variant);
    if (hit) return hit;
  }

  const bundle = await getPortfolio();
  const knowledge = buildKnowledge(bundle.data, buildGraph(bundle.data));

  const corpusBytes = knowledge.records.reduce((sum, record) => sum + record.text.length, 0);
  const records =
    variant === 'lean'
      ? knowledge.records.map(({ text: _text, ...rest }) => rest)
      : knowledge.records;

  const payload: KnowledgePayload = {
    profile: knowledge.profile,
    availability: knowledge.availability,
    services: knowledge.services,
    records,
    experienceSpan: knowledge.experienceSpan,
    navigation: knowledge.navigation,
    corpusIncluded: variant === 'full',
    ...(variant === 'lean' ? { corpusBytes } : {}),
  };

  const body = JSON.stringify(payload);
  // Hash the body, not the variant name: two variants with identical content
  // would otherwise advertise the same ETag and a cache could serve the lean body
  // to a client that asked for the corpus.
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`;

  const generatedAt = knowledge.generatedAt;
  if (process.env.NODE_ENV === 'production') {
    cache ??= new Map();
    cache.set(variant, { body, etag, generatedAt });
  }

  return { body, etag, generatedAt };
}

export async function GET(request: NextRequest) {
  try {
    const variant = request.nextUrl.searchParams.get('corpus') === 'none' ? 'lean' : 'full';
    const { body, etag, generatedAt } = await payloadFor(variant);

    // Honour a conditional request: the client revalidates with `If-None-Match`
    // and gets a 304 rather than 138 kB it already has.
    const inm = request.headers.get('if-none-match');
    if (inm && inm.split(',').some((tag) => tag.trim() === etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'X-Knowledge-Generated-At': generatedAt },
      });
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: etag,
        // `public` because the payload is identical for everyone and is not
        // visitor-specific, unlike `/api/search` which is per-query. `must-revalidate`
        // pairs with the ETag so a content change cannot be served stale.
        'Cache-Control': 'public, max-age=0, must-revalidate',
        // When the adapter ran. A header, not a body field, so it cannot make
        // two identical payloads differ and break revalidation. Useful in
        // debugging a stale deploy; ignored by the client.
        'X-Knowledge-Generated-At': generatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Knowledge payload unavailable.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
