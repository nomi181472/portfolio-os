/**
 * app/sitemap.ts — the crawl map.
 *
 * A sitemap is a promise: every URL in it says "this page exists and is worth
 * your time". Three ways this file used to break that promise, all of them
 * invisible until a crawler complained:
 *
 * - `/startup` was listed unconditionally. A fork without a startup entry renders
 *   `notFound()` there, so the map pointed at a 404.
 * - Empty categories were listed for the same reason — a hub with nothing in it
 *   answers `notFound()` too.
 * - `/copy` was missing, which is the one page a fork's author is searching for.
 *
 * `lastmod` is derived from the content rather than from build time. A map that
 * reports every page as modified on every deploy trains the crawler to ignore the
 * field, which costs a fetch per URL for no benefit. An entity's date is its
 * period's end, falling back to its start; a hub's is the newest of its members.
 */
import type { MetadataRoute } from 'next';
import { getGraph } from '@/lib/source';
import { CATEGORY_LIST } from '@/lib/categories';
import { siteUrl } from '@/lib/seo';

/** Best date an entity can offer, or undefined when it asserts none. */
function entityDate(entity: { data: { period?: { startDate?: string; endDate?: string } } }): string | undefined {
  return entity.data.period?.endDate ?? entity.data.period?.startDate;
}

function entry(
  path: string,
  lastmod?: string,
  priority?: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    // Only emitted when the content actually carries a date. An absent lastmod is
    // read as "unknown", which is honest; a fabricated one is not.
    ...(lastmod ? { lastmod } : {}),
    changeFrequency: 'monthly' as const,
    ...(priority !== undefined ? { priority } : {}),
  };
}

/** Every entity is independently addressable, so every entity is in the map. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { graph, bundle } = await getGraph();

  const fixed = [
    // The surface carries no date of its own; nothing here should claim one.
    entry('/', undefined, 1),
    entry('/explore', undefined, 0.7),
    entry('/future', undefined, 0.6),
    entry('/colophon', undefined, 0.4),
    entry('/copy', undefined, 0.5),
  ];

  // A fork with no startup in its content gets no startup URL, because the route
  // would answer with a 404 and a 404 in a sitemap is worse than an omission.
  if (bundle.data.startup) fixed.push(entry('/startup', undefined, 0.6));

  const categories = CATEGORY_LIST.flatMap((category) => {
    const entities = graph.list(category.kind);
    if (entities.length === 0) return [];
    const newest = entities
      .map((entity) => entityDate(entity) ?? '')
      .filter(Boolean)
      .sort()
      .pop();
    return [entry(`/${category.kind}`, newest, 0.8)];
  });

  const entities = CATEGORY_LIST.flatMap((category) =>
    graph.list(category.kind).map((entity) => entry(entity.href, entityDate(entity), 0.7)),
  );

  return [...fixed, ...categories, ...entities];
}
