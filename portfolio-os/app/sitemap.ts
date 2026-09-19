import type { MetadataRoute } from 'next';
import { getGraph } from '@/lib/source';
import { CATEGORY_LIST } from '@/lib/categories';
import { portfolioConfig } from '@/config/portfolio.config';

/** Every entity is independently addressable, so every entity is in the map. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { graph } = await getGraph();
  const base = portfolioConfig.site.url;

  const fixed = ['', '/explore', '/future', '/startup', '/colophon'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.6,
  }));

  const categories = CATEGORY_LIST.map((category) => ({
    url: `${base}/${category.kind}`,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const entities = CATEGORY_LIST.flatMap((category) =>
    graph.list(category.kind).map((entity) => ({
      url: `${base}${entity.href}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  );

  return [...fixed, ...categories, ...entities];
}
