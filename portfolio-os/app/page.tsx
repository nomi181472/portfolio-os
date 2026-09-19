/**
 * app/page.tsx — the surface (depth 0).
 *
 * The first screen answers three questions and stops: who this is, what they
 * work on, and where to go next. Everything else on the page is an invitation
 * to go deeper, not a summary of what is deeper (§10, §107).
 */

import Link from 'next/link';
import { getGraph } from '@/lib/source';
import { Schematic } from '@/components/home/Schematic';
import { SourceNotice } from '@/components/layout/SourceNotice';
import { Ruler } from '@/components/layout/Ruler';
import { Disclosure } from '@/components/entity/Disclosure';
import { Row } from '@/components/entity/Row';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { EXPLORE_ROUTES, CATEGORIES } from '@/lib/categories';

export default async function SurfacePage() {
  const { bundle, graph } = await getGraph();
  const { profile, future } = bundle.data;
  const briefing = profile.briefing;

  // Featured work is authored, not scored: the person decides what leads.
  const featured = [...graph.list('products'), ...graph.list('projects'), ...graph.list('research')]
    .filter((entity) => entity.data.featured)
    .slice(0, 4);

  const featuredAwards = graph.list('awards').filter((entity) => entity.data.featured);

  const openLines = graph
    .list('research')
    .filter((entity) => ['hypothesis', 'experiment', 'testing', 'observation'].includes(String((entity.data as { state?: string }).state)));

  return (
    <div className="page">
      <SourceNotice source={bundle.source} exampleContent={bundle.data.exampleContent} />

      <section className="enter">
        <Ruler depth={0} label="Surface" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-loose)', marginTop: 'var(--space)', flexWrap: 'wrap' }}>
          {profile.avatar ? (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid var(--rule-strong)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                flexShrink: 0,
                background: 'var(--surface-raised)',
              }}
            >
              <img
                src={profile.avatar}
                alt={profile.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : null}
          <div>
            <h1 className="display" style={{ margin: 0 }}>{profile.name}</h1>
            {profile.discipline ? (
              <p className="lead" style={{ marginTop: 'var(--space-hair)', color: 'var(--ink-quiet)' }}>{profile.discipline}</p>
            ) : null}
          </div>
        </div>
        {profile.positioning ? (
          <p className="lead" style={{ marginTop: 'var(--space-loose)', maxWidth: '52ch' }}>{profile.positioning}</p>
        ) : null}
      </section>

      <section style={{ marginTop: 'var(--space-wide)' }} aria-labelledby="map-heading">
        <h2 id="map-heading" className="visually-hidden">Map of this portfolio</h2>
        <Schematic graph={graph} name={profile.name} />
        <p className="meta" style={{ marginTop: 'var(--space-snug)' }}>
          Node size is the number of entries. Line weight is the number of real connections between them. Select a node
          to enter that collection.
        </p>
      </section>

      {/* Mission briefing — layered, per §14. The first layer is four facts. */}
      <section className="section" aria-labelledby="briefing-heading">
        <div className="section__head">
          <h2 id="briefing-heading" className="heading" style={{ fontSize: 'var(--text-title)' }}>Briefing</h2>
          <p className="section__note">Opened in layers. The first is enough to decide whether to keep reading.</p>
        </div>

        <dl style={{ display: 'grid', gap: 'var(--space-loose)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))' }}>
          {briefing.yearsActive ? (
            <div><dt className="meta">Practising</dt><dd className="title" style={{ margin: 0 }}>{briefing.yearsActive} years</dd></div>
          ) : null}
          {briefing.focus ? (
            <div><dt className="meta">Current focus</dt><dd className="title" style={{ margin: 0 }}>{briefing.focus}</dd></div>
          ) : null}
          {briefing.domains.length ? (
            <div><dt className="meta">Domains</dt><dd style={{ margin: 0 }}>{briefing.domains.join(' · ')}</dd></div>
          ) : null}
          {profile.location ? (
            <div><dt className="meta">Based</dt><dd style={{ margin: 0 }}>{profile.location}</dd></div>
          ) : null}
        </dl>

        <div style={{ marginTop: 'var(--space-wide)' }}>
          {briefing.philosophy ? (
            <Disclosure label="How I work" hint="Engineering position, stated plainly">
              <p className="prose">{briefing.philosophy}</p>
            </Disclosure>
          ) : null}
          {briefing.specialisation ? (
            <Disclosure label="Where I go deep">
              <p className="prose">{briefing.specialisation}</p>
            </Disclosure>
          ) : null}
          {briefing.leadership ? (
            <Disclosure label="How I lead">
              <p className="prose">{briefing.leadership}</p>
            </Disclosure>
          ) : null}
          {briefing.industries.length ? (
            <Disclosure label="Industries worked in">
              <p className="prose">{briefing.industries.join(' · ')}</p>
            </Disclosure>
          ) : null}
        </div>
      </section>

      {featured.length ? (
        <section className="section" aria-labelledby="featured-heading">
          <div className="section__head">
            <h2 id="featured-heading" className="heading" style={{ fontSize: 'var(--text-title)' }}>Start here</h2>
            <p className="section__note">Four entries that show the range. Everything else is reachable from the map above.</p>
          </div>
          <div className="rows">
            {featured.map((entity) => <Row key={`${entity.kind}:${entity.data.id}`} entity={entity} />)}
          </div>
        </section>
      ) : null}

      {featuredAwards.length ? (
        <section className="section" aria-labelledby="awards-heading">
          <div className="section__head">
            <h2 id="awards-heading" className="heading" style={{ fontSize: 'var(--text-title)' }}>Recognition</h2>
            <p className="section__note">Leadership awards and technical achievements.</p>
          </div>
          <div className="rows">
            {featuredAwards.map((entity) => <Row key={`${entity.kind}:${entity.data.id}`} entity={entity} />)}
          </div>
        </section>
      ) : null}

      {openLines.length ? (
        <section className="section" aria-labelledby="open-heading">
          <div className="section__head">
            <h2 id="open-heading" className="heading" style={{ fontSize: 'var(--text-title)' }}>Open right now</h2>
            <p className="section__note">
              Questions currently under investigation. Each is labelled with how far it has actually got — a hypothesis
              is not a result.
            </p>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-snug)' }}>
            {openLines.slice(0, 4).map((entity) => (
              <li key={entity.data.id} style={{ display: 'flex', gap: 'var(--space)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="badge" data-state={String((entity.data as { state?: string }).state)}>
                  {String((entity.data as { state?: string }).state)}
                </span>
                <Link href={entity.href} className="link">{entity.data.name}</Link>
                {entity.data.summary ? <span className="label" style={{ color: 'var(--ink-faint)' }}>{entity.data.summary}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section" aria-labelledby="explore-heading">
        <div className="section__head">
          <h2 id="explore-heading" className="heading" style={{ fontSize: 'var(--text-title)' }}>Or start from a question</h2>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid' }}>
          {EXPLORE_ROUTES.map((route) => {
            const count = route.kind ? graph.list(route.kind).length : (future?.directions.length ?? 0);
            const mark = route.kind ? CATEGORIES[route.kind].mark : 'trajectory';
            return (
              <li key={route.href}>
                <Link
                  href={route.href}
                  style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 'var(--space)', padding: 'var(--space) 0', borderTop: '1px solid var(--rule)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-snug)' }}>
                    <MetaphorMark name={mark} size={18} />
                    <span className="title" style={{ fontSize: 'var(--text-lead)' }}>{route.question}</span>
                  </span>
                  <span className="meta">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
