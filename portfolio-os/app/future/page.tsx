import type { Metadata } from 'next';
import Link from 'next/link';
import { getGraph } from '@/lib/source';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { humanise } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Trajectory',
  description: 'Where the work is heading, separated by how certain each direction is.',
};

const HORIZONS = ['current', 'exploring', 'planned', 'long-term'] as const;

const HORIZON_NOTE: Record<(typeof HORIZONS)[number], string> = {
  current: 'Happening now, with work already on the record.',
  exploring: 'Being investigated. No commitment, and no results yet.',
  planned: 'Intended, with a rough shape but nothing built.',
  'long-term': 'A direction, not a plan. Stated so the rest is not misread.',
};

/**
 * Trajectory (§17). The whole design problem here is honesty: ambition must
 * never be able to read as achievement. So directions are grouped by certainty,
 * each group states plainly what that certainty means, and the visual weight
 * decreases as the certainty does.
 */
export default async function FuturePage() {
  const { bundle, graph } = await getGraph();
  const future = bundle.data.future;

  return (
    <div className="page">
      <Breadcrumbs trail={[{ label: 'Surface', href: '/' }, { label: 'Trajectory' }]} />
      <Ruler depth={1} label="Trajectory" />

      <header style={{ marginTop: 'var(--space)', marginBottom: 'var(--space-wide)' }}>
        <h1 className="heading" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space)' }}>
          <MetaphorMark name="trajectory" size={30} labelled />
          Trajectory
        </h1>
        {future?.statement ? <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>{future.statement}</p> : null}
      </header>

      {HORIZONS.map((horizon, index) => {
        const directions = (future?.directions ?? []).filter((direction) => direction.horizon === horizon);
        if (directions.length === 0) return null;
        return (
          <section key={horizon} className="section" style={{ opacity: 1 - index * 0.11 }}>
            <div className="section__head">
              <h2 className="heading" style={{ fontSize: 'var(--text-title)' }}>{humanise(horizon)}</h2>
              <p className="section__note">{HORIZON_NOTE[horizon]}</p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid' }}>
              {directions.map((direction) => {
                const related = [
                  ...direction.relatedSkills.map((id) => graph.get('skills', id)),
                  ...direction.relatedResearch.map((id) => graph.get('research', id)),
                ].filter(Boolean);
                return (
                  <li key={direction.id} style={{ borderTop: '1px solid var(--rule)', padding: 'var(--space-loose) 0' }}>
                    <p className="title">{direction.label}</p>
                    {direction.detail ? <p className="prose" style={{ marginTop: 'var(--space-tight)' }}>{direction.detail}</p> : null}
                    {related.length ? (
                      <p style={{ marginTop: 'var(--space-snug)', display: 'flex', gap: 'var(--space)', flexWrap: 'wrap' }}>
                        {related.map((entity) => (
                          <Link key={entity!.data.id} href={entity!.href} className="tech">{entity!.data.name}</Link>
                        ))}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {!future?.directions.length ? (
        <p className="notice">No directions recorded yet. Add a <code>future.directions</code> array to the content file.</p>
      ) : null}
    </div>
  );
}
