import type { Metadata } from 'next';
import Link from 'next/link';
import { getGraph } from '@/lib/source';
import { CATEGORIES, EXPLORE_ROUTES } from '@/lib/categories';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Enter this portfolio from a question rather than from a section name.',
};

/**
 * Explore mode (§13). The same content, entered from intent instead of
 * structure. Someone hiring reads "what I build"; someone collaborating reads
 * "what I research". Both resolve into the same collections.
 */
export default async function ExplorePage() {
  const { graph, bundle } = await getGraph();

  return (
    <div className="page">
      <Breadcrumbs trail={[{ label: 'Surface', href: '/' }, { label: 'Explore' }]} />
      <Ruler depth={1} label="Explore" />

      <header style={{ marginTop: 'var(--space)', marginBottom: 'var(--space-wide)' }}>
        <h1 className="heading">What do you want to know?</h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          Every route below lands in the same content the map does. This one is organised by what you came for.
        </p>
      </header>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid' }}>
        {EXPLORE_ROUTES.map((route) => {
          const category = route.kind ? CATEGORIES[route.kind] : undefined;
          const items = route.kind ? graph.list(route.kind) : [];
          const sample = items.slice(0, 3).map((entity) => entity.data.name);
          const count = route.kind ? items.length : (bundle.data.future?.directions.length ?? 0);

          return (
            <li key={route.href} style={{ borderTop: '1px solid var(--rule)' }}>
              <Link href={route.href} style={{ display: 'grid', gridTemplateColumns: '2rem 1fr auto', gap: 'var(--space)', padding: 'var(--space-loose) 0', alignItems: 'start' }}>
                <MetaphorMark name={category?.mark ?? 'trajectory'} size={22} />
                <span>
                  <span className="title" style={{ display: 'block' }}>{route.question}</span>
                  <span className="label" style={{ display: 'block', marginTop: 2 }}>
                    {category?.note ?? 'Directions, labelled by how certain they are.'}
                  </span>
                  {sample.length ? (
                    <span className="meta" style={{ display: 'block', marginTop: 'var(--space-tight)' }}>
                      {sample.join(' · ')}{items.length > 3 ? ` · +${items.length - 3}` : ''}
                    </span>
                  ) : null}
                </span>
                <span className="meta">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
