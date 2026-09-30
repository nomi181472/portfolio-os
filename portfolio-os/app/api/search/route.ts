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
 * Two shapes, both deliberate.
 *
 * With no `q` this returns the entire index, because that is what the CommandMenu
 * asks for: it fetches once when the dialog opens and filters every keystroke after
 * that against its own copy, which is why typing feels instant and why there is no
 * spinner between letters. Truncating this response would not save bandwidth — the
 * menu would simply never find the records that were cut, and the failure would look
 * like a search box that does not know its own content.
 *
 * With a `q` the scoring pass runs here and the hits come back ranked, which is the
 * shape for a deep link (`/api/search?q=kubernetes`) or a client that would rather
 * not hold the corpus at all.
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') ?? '';
    const entries = await getIndex();
    const results = query.trim() ? search(entries, query) : entries;

    return NextResponse.json(results, {
      headers: {
        // `private` because this is a portfolio, not a shop: a CDN copying every
        // query for every visitor buys nothing here and doubles the surprise when
        // one fork's results turn up on another's origin. The index itself is not a
        // secret — it is the same content the hub pages list — but answering per
        // query means one query's results must not be replayed for another.
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
