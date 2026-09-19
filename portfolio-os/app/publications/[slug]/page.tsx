/**
 * app/publications/[slug]/page.tsx — reading depth (depth 5).
 *
 * Identical to the generic entity route except that it mounts the reader. It
 * exists as its own segment purely so the markdown, maths and highlighting
 * dependencies are scoped to the pages that actually have prose (§78) instead
 * of being loaded by every skill and award page.
 *
 * The reader is a client component but renders on the server, so the article
 * itself is in the HTML for crawlers and for reading without JavaScript (§85).
 */

import type { Metadata } from 'next';
import { getGraph } from '@/lib/source';
import { EntityPageBody, entityMetadata } from '@/components/entity/EntityPageBody';
import { Reader } from '@/components/research/Reader';
import { extractHeadings } from '@/lib/headings';

const KIND = 'publications' as const;

export async function generateStaticParams() {
  const { graph } = await getGraph();
  return graph.list(KIND).map((entity) => ({ slug: entity.data.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return entityMetadata(KIND, slug);
}

export default async function ReadingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <EntityPageBody
      category={KIND}
      slug={slug}
      renderBody={(body) => <Reader markdown={body} headings={extractHeadings(body)} />}
    />
  );
}
