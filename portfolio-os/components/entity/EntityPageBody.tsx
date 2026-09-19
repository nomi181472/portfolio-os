/**
 * components/entity/EntityPageBody.tsx
 *
 * One entity page, used by every entity route. It exists so that the reading
 * apparatus can be split off without duplicating the page.
 *
 * The markdown, maths and syntax-highlighting stack is roughly 320 kB of client
 * JavaScript. Only two categories declare a `body` section — research and
 * publications — so it would be indefensible to ship it to someone reading a
 * skill page (§78). Rather than importing the reader here, this component takes
 * a `renderBody` slot: the generic route passes nothing and never references the
 * reader, and the reading routes pass it in. Both are server components, so the
 * prose is still in the HTML (§85).
 */

import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getGraph } from '@/lib/source';
import { categoryFor } from '@/lib/categories';
import { evidenceForSkill } from '@/lib/graph';
import { portfolioConfig } from '@/config/portfolio.config';
import { EntityDetail } from '@/components/entity/EntityDetail';
import { Related, PrevNext } from '@/components/entity/Related';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import type { EntityKind } from '@/types/portfolio';

/** Shared by every entity route so social cards never drift between them. */
export async function entityMetadata(category: string, slug: string): Promise<Metadata> {
  const definition = categoryFor(category);
  if (!definition) return {};

  const { graph } = await getGraph();
  const entity = graph.get(definition.kind as EntityKind, slug);
  if (!entity) return {};

  const description = entity.data.summary ?? entity.data.description?.slice(0, 160) ?? definition.note;
  const image = entity.data.media.find((item) => item.type === 'image' && item.visibility === 'public')?.url;

  return {
    title: entity.data.name,
    description,
    alternates: { canonical: entity.href },
    openGraph: {
      title: `${entity.data.name} — ${definition.singular}`,
      description,
      type: 'article',
      url: `${portfolioConfig.site.url}${entity.href}`,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

interface EntityPageBodyProps {
  category: string;
  slug: string;
  /** Supplied only by routes that carry the reader. */
  renderBody?: (body: string) => ReactNode;
}

export async function EntityPageBody({ category, slug, renderBody }: EntityPageBodyProps) {
  const definition = categoryFor(category);
  if (!definition) notFound();

  const { graph } = await getGraph();
  const entity = graph.get(definition.kind as EntityKind, slug);
  if (!entity) notFound();

  const { previous, next } = graph.siblings(entity);

  // A skill's connections are one-directional by nature: the interesting
  // question is what used it, not what it links to (§24, §36).
  const edges = definition.kind === 'skills' ? evidenceForSkill(graph, entity.data.id) : graph.neighbours(entity);

  const body = entity.data.body;
  const reading = Boolean(body && renderBody);

  return (
    <div className="page">
      <Breadcrumbs
        trail={[
          { label: 'Surface', href: '/' },
          { label: definition.label, href: `/${definition.kind}` },
          { label: entity.data.name },
        ]}
      />
      <Ruler depth={reading ? 5 : 3} label={reading ? 'Full technical record' : definition.singular} />

      <EntityDetail entity={entity} />

      {reading ? <section className="section">{renderBody!(body!)}</section> : null}

      <Related
        edges={edges}
        title={definition.kind === 'skills' ? 'Where this has actually been used' : 'Connected work'}
      />

      <PrevNext previous={previous} next={next} />
    </div>
  );
}
