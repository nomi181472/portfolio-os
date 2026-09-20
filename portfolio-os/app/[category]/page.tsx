/**
 * app/[category]/page.tsx — category depth (depth 1).
 *
 * One route serves every collection. The category registry supplies the
 * heading, the metaphor and the note; the graph supplies the entries. Adding a
 * collection therefore adds a page for free, which is the difference between a
 * framework and a site with seventeen hand-built sections.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGraph } from '@/lib/source';
import { CATEGORIES, CATEGORY_LIST, categoryFor } from '@/lib/categories';
import { Rows } from '@/components/entity/Row';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import type { EntityKind } from '@/types/portfolio';

export function generateStaticParams() {
  return CATEGORY_LIST.map((category) => ({ category: category.kind }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const definition = categoryFor(category);
  if (!definition) return {};
  return {
    title: definition.label,
    description: definition.note,
    alternates: { canonical: `/${definition.kind}` },
    openGraph: { title: definition.label, description: definition.note },
  };
}

import { SkillSectionGraph, type GraphSkillNode } from '@/components/skills/SkillSectionGraph';

const SKILL_CATEGORY_ORDER: string[] = [
  'Programming Languages',
  'Frameworks',
  'AI & Deep Learning Frameworks',
  'Databases & Storage',
  'Message Brokers & Event Handlers',
  'DevOps & Cloud',
  'Streaming & Media',
  'Testing & Quality',
  'Architecture',
  'APIs & Interfaces',
  'API & Interface',
  'Security',
  'Leadership & Soft Skills',
];

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const definition = categoryFor(category);
  if (!definition) notFound();

  const { graph } = await getGraph();
  const entities = graph.list(definition.kind as EntityKind);

  // Skills group by category rather than listing flat: a bench, not a wall.
  const grouped =
    definition.kind === 'skills'
      ? entities.reduce<Record<string, typeof entities>>((acc, entity) => {
          const key = String((entity.data as { category?: string }).category ?? 'Other');
          (acc[key] ??= []).push(entity);
          return acc;
        }, {})
      : null;

  const sortedGroups = grouped
    ? Object.entries(grouped).sort(([a], [b]) => {
        const idxA = SKILL_CATEGORY_ORDER.indexOf(a);
        const idxB = SKILL_CATEGORY_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      })
    : [];

  return (
    <div className="page">
      <Breadcrumbs trail={[{ label: 'Surface', href: '/' }, { label: definition.label }]} />
      <Ruler depth={1} label={definition.label} />

      <header style={{ marginTop: 'var(--space)', marginBottom: 'var(--space-wide)' }}>
        <h1 className="heading" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space)' }}>
          <MetaphorMark name={definition.mark} size={30} labelled />
          {definition.label}
        </h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)', color: 'var(--ink-quiet)' }}>{definition.metaphor}</p>
        <p className="label" style={{ marginTop: 'var(--space-snug)', maxWidth: 'var(--measure)' }}>{definition.note}</p>
        <p className="meta" style={{ marginTop: 'var(--space-snug)' }}>{entities.length} {entities.length === 1 ? 'entry' : 'entries'}</p>
      </header>

      {grouped ? (
        sortedGroups.map(([group, items]) => {
          const skillsForGraph: GraphSkillNode[] = items.map((item) => {
            const neighbours = graph.neighbours(item);
            const targets = neighbours
              .filter((n) => n.kind === 'products' || n.kind === 'projects')
              .map((t) => ({
                id: t.id,
                name: t.name,
                kind: t.kind as 'products' | 'projects',
                href: t.href,
              }));
            return {
              id: item.data.id,
              name: item.data.name,
              slug: item.data.slug,
              href: item.href,
              targets,
            };
          });

          return (
            <section key={group} style={{ marginBottom: 'var(--space-wide)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-tight)' }}>
                <h2 className="title" style={{ fontSize: 'var(--text-lead)', margin: 0 }}>{group}</h2>
                <span className="meta">{items.length} {items.length === 1 ? 'skill' : 'skills'}</span>
              </div>
              <SkillSectionGraph sectionTitle={group} skills={skillsForGraph} />
              <Rows entities={items} showPeriod={false} />
            </section>
          );
        })
      ) : (
        <Rows entities={entities} />
      )}
    </div>
  );
}
