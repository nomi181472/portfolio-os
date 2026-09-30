/**
 * components/seo/JsonLd.tsx
 *
 * Renders schema.org as an inline `application/ld+json` block. Server component
 * only — the graph never reaches the client, and `JSON.stringify` runs at render
 * time on the server where the payload becomes part of the static HTML.
 *
 * `@graph` is used so several top-level nodes can reference each other by `@id`
 * instead of being duplicated: the Person is one node, the site points at it, and
 * each page points at the site.
 */
import { breadcrumbEntity, entityPageEntity, itemListEntity, personEntity, websiteEntity } from '@/lib/seo';
import type { CategoryDefinition } from '@/lib/categories';
import type { ResolvedEntity, Portfolio, Profile } from '@/types/portfolio';

type Json = Record<string, unknown>;

export function JsonLd({ nodes, label }: { nodes: Json[]; label?: string }) {
  if (nodes.length === 0) return null;
  const payload = nodes.length === 1 ? nodes[0] : { '@context': 'https://schema.org', '@graph': nodes };
  const graph = nodes.length === 1 ? { ...payload, '@context': 'https://schema.org' } : payload;
  return (
    <script
      type="application/ld+json"
      data-label={label}
      // dangerouslySetInnerHTML is the only correct way to emit LD+JSON: the
      // content must be raw, and React would escape quotation marks in prose.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }}
    />
  );
}

/** Home page: the person and the site, as one connected graph. */
export function ProfileJsonLd({ profile, portfolio }: { profile: Parameters<typeof personEntity>[0]; portfolio: Parameters<typeof personEntity>[1] }) {
  return <JsonLd label="profile" nodes={[personEntity(profile, portfolio), websiteEntity(profile, portfolio)]} />;
}

/** A hub page: the collection, plus the trail that leads to it. */
export function HubJsonLd({ definition, entities, trail }: { definition: Parameters<typeof itemListEntity>[0]; entities: Parameters<typeof itemListEntity>[1]; trail: { label: string; href?: string }[] }) {
  return <JsonLd label="hub" nodes={[itemListEntity(definition, entities), breadcrumbEntity(trail)]} />;
}

/** An entity page: the thing itself, plus its place in the site. */
export function EntityJsonLd({ entity, definition, profile, trail }: { entity: Parameters<typeof entityPageEntity>[0]; definition: Parameters<typeof entityPageEntity>[1]; profile: Parameters<typeof entityPageEntity>[2]; trail: { label: string; href?: string }[] }) {
  return <JsonLd label="entity" nodes={[entityPageEntity(entity, definition, profile), breadcrumbEntity(trail)]} />;
}

/** Any other page: just the trail, so it is still connected to the graph. */
export function BreadcrumbJsonLd({ trail }: { trail: { label: string; href?: string }[] }) {
  return <JsonLd label="breadcrumbs" nodes={[breadcrumbEntity(trail)]} />;
}
