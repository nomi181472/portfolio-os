/**
 * app/[category]/[slug]/page.tsx — entity depth (depth 3).
 *
 * The generic entity route. Statically generated for every entity in the
 * content file, so each product, experiment and station is crawlable and
 * shareable on its own URL (§39, §117).
 *
 * Categories that carry long-form markdown are served by their own segment
 * (app/research, app/publications) so that this route never pulls in the
 * reading stack. They are excluded here rather than 404ing, because Next
 * resolves the static segment first and would otherwise generate both.
 */

import type { Metadata } from 'next';
import { getGraph } from '@/lib/source';
import { CATEGORY_LIST, isReadingKind } from '@/lib/categories';
import { EntityPageBody, entityMetadata } from '@/components/entity/EntityPageBody';

export async function generateStaticParams() {
  const { graph } = await getGraph();
  return CATEGORY_LIST.filter((category) => !isReadingKind(category.kind)).flatMap((category) =>
    graph.list(category.kind).map((entity) => ({ category: category.kind, slug: entity.data.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  return entityMetadata(category, slug);
}

export default async function EntityPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  return <EntityPageBody category={category} slug={slug} />;
}
