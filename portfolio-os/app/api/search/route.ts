/**
 * app/api/search/route.ts
 *
 * The search index used to be built in the root layout and handed to the command
 * menu as a client prop, which meant React serialised every record — including a
 * lowercased haystack containing every description and tag — into the RSC payload
 * of *every* page. That is ~90 kB of JSON in the initial HTML of a page whose
 * visitor may never press Ctrl+K.
 *
 * It is now fetched on first use. Two things this route has to get right:
 *
 * - **It answers a query.** `search()` is a pure function over the index, so the
 *   ranking runs here rather than in the browser, and the response carries only
 *   the hits. The old shape (send everything, filter client-side) is what made the
 *   index cheap to attack on a phone.
 * - **It is not cached as one snapshot.** A GET route handler that touches no
 *   dynamic API is treated as static, and Next then serves the build-time response
 *   to every query — which looks like a working search box that always shows the
 *   same ten items. `force-dynamic` is what keeps `?q=` meaningful, and the
 *   response is marked `must-revalidate` so a proxy cannot replay one query's
 *   answers for another. The CommandMenu keeps its own copy for the session, which
 *   is where the caching actually earns its keep.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getPortfolio } from '@/lib/source';
import { buildIndex, search, type SearchRecord } from '@/lib/search';
import { getPortfolioRepository } from '@/lib/repositories/server';

export const dynamic = 'force-dynamic';

/**
 * Building the index is a read of the whole content file plus a pass over every
 * record. In production the content cannot change underneath us, so the promise is
 * memoised. In development it is not, because a stale index after a save is worse
 * than a few milliseconds — the editor and the search box would disagree about what
 * exists, and the one that lies is the one you just typed into.
 */
let cached: Promise<SearchRecord[]> | null = null;

function getIndex(): Promise<SearchRecord[]> {
  const build = getPortfolio().then((bundle) => buildIndex(bundle.data));
  if (process.env.NODE_ENV !== 'production') return build;
  cached ??= build;
  return cached;
}

/**
 * Two modes:
 *
 * 1. Without `q`: Returns the entire legacy SearchRecord index for CommandMenu
 *    client-side cache and rapid keyboard filtering.
 * 2. With `q`: Runs SQLite FTS5 BM25 search over portfolio.db chunks and entities,
 *    returning structured results matching Specification Section 32 & 34.
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') ?? '';
    const format = request.nextUrl.searchParams.get('format') ?? '';

    // If query is present, attempt SQLite FTS5 search, falling back to in-memory index
    if (query.trim()) {
      try {
        const portfolioRepo = getPortfolioRepository();
        const ftsHits = await portfolioRepo.search(query.trim(), 10);
        
        if (format === 'spec') {
          const results = ftsHits.map((hit) => ({
            entityId: hit.entityId,
            title: hit.title,
            content: hit.content,
            canonicalUrl: hit.canonicalUrl,
            score: Math.max(0, parseFloat((1 / (1 + Math.abs(hit.rank))).toFixed(3))),
          }));

          return NextResponse.json({ results }, {
            headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
          });
        }
      } catch {
        // SQLite index unavailable; fall back to fast in-memory search index
      }

      // Default scored search records (compatible with both deep-links and CommandMenu)
      const entries = await getIndex();
      const results = search(entries, query);
      return NextResponse.json(results, {
        headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
      });
    }

    const entries = await getIndex();
    return NextResponse.json(entries, {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Search index unavailable.', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
