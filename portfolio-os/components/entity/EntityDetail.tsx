/**
 * components/entity/EntityDetail.tsx
 *
 * One detail renderer for every category. Which sections appear, and in what
 * order, comes from the category registry; whether a section appears at all
 * comes from whether the data is there. So a product with no architecture
 * simply has no architecture section — there is no empty state to design, and
 * no per-category page to maintain (§42, §106).
 *
 * Depth is enforced here: `description` and the category's headline sections
 * render open, everything heavier sits behind a disclosure.
 */

import Link from 'next/link';
import { Disclosure } from './Disclosure';
import { StatusBadge, SourceBadge, OrganisationBadge } from './Badges';
import { MediaGallery } from '@/components/media/Media';
import { formatPeriod, formatDuration, formatDate, humanise } from '@/lib/format';
import { CATEGORIES, type DetailSection } from '@/lib/categories';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { CopyEntityButton } from './CopyEntityButton';
import type { ResolvedEntity } from '@/types/portfolio';

type Loose = Record<string, unknown>;

function list(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]).filter(Boolean) : [];
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: '1.1em', display: 'grid', gap: 'var(--space-tight)', maxWidth: 'var(--measure)' }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'var(--space-loose)' }}>
      <h3 className="label" style={{ color: 'var(--ink-faint)', marginBottom: 'var(--space-tight)' }}>{title}</h3>
      {children}
    </div>
  );
}

export function EntityDetail({ entity }: { entity: ResolvedEntity }) {
  const data = entity.data as unknown as Loose;
  const category = CATEGORIES[entity.kind];
  const period = formatPeriod(entity.data.period);
  const duration = formatDuration(entity.data.period);
  const sections: Record<DetailSection, React.ReactNode> = {
    description: (entity.data.description || ('reason' in data && data.reason)) ? (
      <div style={{ display: 'grid', gap: 'var(--space-loose)' }}>
        {'reason' in data && data.reason ? (
          <blockquote
            style={{
              margin: 0,
              padding: 'var(--space) var(--space-loose)',
              borderLeft: '3px solid var(--signal)',
              background: 'var(--surface-raised)',
              borderRadius: '0 8px 8px 0',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lead)',
              lineHeight: 1.6,
              color: 'var(--ink-bright)',
            }}
          >
            “{String(data.reason)}”
          </blockquote>
        ) : null}
        {entity.data.description ? (
          <div className="prose lead">
            {entity.data.description.split('\n\n').map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
          </div>
        ) : null}
      </div>
    ) : null,

    impact: data.impact ? (
      <p className="lead" style={{ color: 'var(--ink-bright)', fontFamily: 'var(--font-display)' }}>{String(data.impact)}</p>
    ) : null,

    responsibilities: list(data.responsibilities).length ? (
      <Disclosure label="What I owned" hint={`${list(data.responsibilities).length} areas`}>
        <Bullets items={list(data.responsibilities)} />
      </Disclosure>
    ) : null,

    systems: list(data.systems).length ? (
      <Disclosure label="Systems worked on">
        <Bullets items={list(data.systems)} />
      </Disclosure>
    ) : null,

    achievements: list(data.achievements).length ? (
      <Disclosure label="What changed" hint="Outcomes, with their context">
        <Bullets items={list(data.achievements)} />
      </Disclosure>
    ) : null,

    features: Array.isArray(data.features) && data.features.length ? (
      <Disclosure label="Capabilities" hint={`${(data.features as unknown[]).length} listed`}>
        <dl style={{ display: 'grid', gap: 'var(--space)', maxWidth: 'var(--measure)' }}>
          {(data.features as { name: string; detail?: string }[]).map((feature) => (
            <div key={feature.name}>
              <dt style={{ color: 'var(--ink-bright)' }}>{feature.name}</dt>
              {feature.detail ? <dd style={{ margin: 0, color: 'var(--ink-quiet)' }}>{feature.detail}</dd> : null}
            </div>
          ))}
        </dl>
      </Disclosure>
    ) : null,

    architecture: data.architecture ? (
      <Disclosure label="Architecture" hint="How it is put together, and why">
        <ArchitectureView architecture={data.architecture as ArchitectureData} />
      </Disclosure>
    ) : null,

    metrics: Array.isArray(data.metrics) && data.metrics.length ? (
      <Block title="Measured">
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-wide)' }}>
          {(data.metrics as { label: string; value: string; note?: string }[]).map((metric) => (
            <div key={metric.label}>
              <dd className="title" style={{ margin: 0 }}>{metric.value}</dd>
              <dt className="meta">{metric.label}</dt>
              {metric.note ? <dd className="meta" style={{ margin: 0, color: 'var(--ink-faint)' }}>{metric.note}</dd> : null}
            </div>
          ))}
        </dl>
      </Block>
    ) : null,

    'lab-notes': (
      <LabNotes data={data} />
    ),

    findings: Array.isArray(data.findings) && data.findings.length ? (
      <Disclosure label="Findings" hint="Dated, with confidence stated" defaultOpen>
        <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-loose)', maxWidth: 'var(--measure)' }}>
          {(data.findings as { date: string; observation: string; evidence?: string; confidence: string; supersededBy?: string }[]).map(
            (finding) => (
              <li key={`${finding.date}-${finding.observation.slice(0, 16)}`} style={{ borderLeft: '1px solid var(--rule-strong)', paddingLeft: 'var(--space)' }}>
                <p className="meta">
                  {finding.date} · confidence {finding.confidence}
                  {finding.supersededBy ? ' · superseded' : ''}
                </p>
                <p style={{ marginTop: 'var(--space-hair)' }}>{finding.observation}</p>
                {finding.evidence ? <p className="label" style={{ marginTop: 'var(--space-hair)' }}>{finding.evidence}</p> : null}
              </li>
            ),
          )}
        </ol>
      </Disclosure>
    ) : null,

    abstract: data.abstract ? (
      <div className="prose lead">{String(data.abstract)}</div>
    ) : null,

    references: Array.isArray(data.references) && data.references.length ? (
      <Disclosure label="References">
        <ol style={{ display: 'grid', gap: 'var(--space-tight)', paddingLeft: '1.2em', maxWidth: 'var(--measure)' }}>
          {(data.references as { citation: string; url?: string }[]).map((reference) => (
            <li key={reference.citation} className="label">
              {reference.url ? <a className="link" href={reference.url} target="_blank" rel="noreferrer">{reference.citation}</a> : reference.citation}
            </li>
          ))}
        </ol>
      </Disclosure>
    ) : null,

    datasets: Array.isArray(data.datasets) && data.datasets.length ? (
      <Disclosure label="Datasets">
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-tight)' }}>
          {(data.datasets as { name: string; url?: string; note?: string }[]).map((dataset) => (
            <li key={dataset.name}>
              {dataset.url ? <a className="link" href={dataset.url} target="_blank" rel="noreferrer">{dataset.name}</a> : dataset.name}
              {dataset.note ? <span className="label"> — {dataset.note}</span> : null}
            </li>
          ))}
        </ul>
      </Disclosure>
    ) : null,

    subjects: list(data.subjects).length ? (
      <Block title="Studied">
        <p style={{ maxWidth: 'var(--measure)' }}>{list(data.subjects).join(' · ')}</p>
      </Block>
    ) : null,

    credential: data.credentialId || data.verificationUrl || data.issuer ? (
      <Block title="Credential">
        <dl className="meta" style={{ display: 'grid', gap: 'var(--space-hair)' }}>
          {data.issuer ? <div>Issued by {String(data.issuer)}</div> : null}
          {data.credentialId ? <div>ID {String(data.credentialId)}</div> : null}
          {data.expires ? <div>Expires {String(data.expires)}</div> : null}
        </dl>
        {data.verificationUrl ? (
          <a className="control" style={{ marginTop: 'var(--space-snug)' }} href={String(data.verificationUrl)} target="_blank" rel="noreferrer">
            Verify this credential
          </a>
        ) : null}
      </Block>
    ) : null,

    teams: Array.isArray(data.teams) && data.teams.length ? (
      <Disclosure label="Teams">
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-tight)' }}>
          {(data.teams as { name: string; size?: number; focus?: string }[]).map((team) => (
            <li key={team.name}>
              <span style={{ color: 'var(--ink-bright)' }}>{team.name}</span>
              {team.size ? <span className="meta"> · {team.size} engineers</span> : null}
              {team.focus ? <span className="label"> — {team.focus}</span> : null}
            </li>
          ))}
        </ul>
      </Disclosure>
    ) : null,

    body: null, // handled by the research reader, which needs markdown

    media: entity.data.media.length ? (
      <div style={{ marginTop: 'var(--space-wide)' }}>
        <MediaGallery items={entity.data.media} />
      </div>
    ) : null,

    evidence: entity.data.evidence.length ? (
      <Disclosure label="Evidence" hint="Each claim, and what backs it">
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space)', maxWidth: 'var(--measure)' }}>
          {entity.data.evidence.map((item) => (
            <li key={item.claim} style={{ borderLeft: '1px solid var(--signal-quiet)', paddingLeft: 'var(--space)' }}>
              <p style={{ color: 'var(--ink-bright)' }}>{item.claim}</p>
              {item.note ? <p className="label">{item.note}</p> : null}
              {item.links.length ? (
                <p style={{ marginTop: 'var(--space-hair)', display: 'flex', gap: 'var(--space)', flexWrap: 'wrap' }}>
                  {item.links.map((link) => (
                    <a key={link.url} className="link" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                  ))}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Disclosure>
    ) : null,

    timeline: entity.data.timeline.length ? (
      <Disclosure label="Timeline">
        <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-snug)' }}>
          {entity.data.timeline.map((event) => (
            <li key={`${event.date}-${event.label}`} style={{ display: 'grid', gridTemplateColumns: '7rem 1fr', gap: 'var(--space)' }}>
              <span className="meta">{event.date}</span>
              <span>
                {event.label}
                {event.detail ? <span className="label" style={{ display: 'block' }}>{event.detail}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </Disclosure>
    ) : null,

    links: entity.data.links.length > 0 ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-snug)', marginTop: 'var(--space-wide)' }}>
        {entity.data.links
          .filter((link) => link.visibility !== 'disabled')
          .map((link) =>
            link.visibility === 'coming-soon' ? (
              <span key={link.url} className="control" aria-disabled="true" style={{ opacity: 0.5 }}>{link.label} — not yet</span>
            ) : link.visibility === 'private' ? (
              <span key={link.url} className="control" aria-disabled="true" style={{ opacity: 0.5 }}>{link.label} — restricted</span>
            ) : (
              <a key={link.url} className="control" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
            ),
          )}
      </div>
    ) : null,
  };

  return (
    <div>
      <header style={{ marginBottom: 'var(--space-wide)' }}>
        <p className="meta" style={{ marginBottom: 'var(--space-tight)' }}>{category.singular}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-snug)', flexWrap: 'wrap' }}>
          {entity.data.media?.find((m) => m.url.includes('logo')) ? (
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: '#091015',
              border: '1px solid var(--rule-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              flexShrink: 0,
            }}>
              <img
                src={entity.data.media.find((m) => m.url.includes('logo'))!.url}
                alt={`${entity.data.name} logo`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : null}
          <h1 className="heading" style={{ margin: 0 }}>{entity.data.name}</h1>
        </div>
        {('organisation' in data && data.organisation) ||
        ('institution' in data && data.institution) ||
        ('venue' in data && data.venue) ||
        ('context' in data && data.context) ? (
          <p className="label" style={{ marginTop: 'var(--space-snug)', color: 'var(--ink-quiet)' }}>
            {[
              'organisation' in data && data.organisation ? String(data.organisation) : null,
              'institution' in data && data.institution ? String(data.institution) : null,
              'venue' in data && data.venue ? String(data.venue) : null,
              'context' in data && data.context ? String(data.context) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
        {'authors' in data && Array.isArray(data.authors) && data.authors.length ? (
          <p className="meta" style={{ marginTop: 'var(--space-hair)', color: 'var(--ink-faint)' }}>
            {(data.authors as string[]).join(' · ')}
          </p>
        ) : null}
        {'citation' in data && data.citation ? (
          <p className="meta" style={{ marginTop: 'var(--space-tight)', fontFamily: 'var(--font-data)' }}>
            {String(data.citation)}
          </p>
        ) : null}
        {'tagline' in data && data.tagline ? (
          <p className="lead" style={{ marginTop: 'var(--space-tight)' }}>{String(data.tagline)}</p>
        ) : entity.data.summary ? (
          <p className="lead" style={{ marginTop: 'var(--space-tight)' }}>{entity.data.summary}</p>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-loose)', marginTop: 'var(--space-loose)', alignItems: 'center' }}>
          <StatusBadge status={entity.data.status} />
          {'organisation' in data && data.organisation && (entity.kind === 'products' || entity.kind === 'projects') ? (
            <OrganisationBadge organisation={String(data.organisation)} />
          ) : null}
          {'state' in data && data.state ? <span className="badge" data-state={String(data.state)}>{humanise(String(data.state))}</span> : null}
          <SourceBadge source={data.source as never} />
          {period || ('date' in data && data.date) || ('issued' in data && data.issued) ? (
            <span className="meta">
              {period || ('date' in data && data.date ? formatDate(String(data.date)) : formatDate(String(data.issued)))}
              {duration ? ` · ${duration}` : ''}
            </span>
          ) : null}
          {'design' in data && data.design && 'support' in data && data.support ? (
            <span
              className="badge"
              style={{
                fontFamily: 'var(--font-data)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontWeight: 600,
                display: 'inline-flex',
                gap: 6,
              }}
            >
              <span>Design: {String(data.design)}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Support: {String(data.support)}</span>
            </span>
          ) : 'agentic' in data && data.agentic && 'aiAssisted' in data && data.aiAssisted && 'independent' in data && data.independent ? (
            <span
              className="badge"
              style={{
                fontFamily: 'var(--font-data)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontWeight: 600,
                display: 'inline-flex',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span>Agentic Development: {String(data.agentic)}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>AI-Assisted Development: {String(data.aiAssisted)}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Independent Development: {String(data.independent)}</span>
            </span>
          ) : 'reading' in data && data.reading && 'writing' in data && data.writing ? (
            <span
              className="badge"
              style={{
                fontFamily: 'var(--font-data)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontWeight: 600,
                display: 'inline-flex',
                gap: 6,
              }}
            >
              <span>Reading: {String(data.reading)}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>Writing: {String(data.writing)}</span>
            </span>
          ) : 'handling' in data && data.handling ? (
            <span
              className="badge"
              style={{
                fontFamily: 'var(--font-data)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontWeight: 600,
              }}
            >
              Handling: {String(data.handling)}
            </span>
          ) : 'proficiency' in data && data.proficiency ? (
            <span
              className="badge"
              style={{
                fontFamily: 'var(--font-data)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontWeight: 600,
              }}
            >
              Proficiency: {String(data.proficiency)}
            </span>
          ) : 'level' in data && data.level ? (
            <span
              className="badge"
              style={{
                fontFamily: 'var(--font-data)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontWeight: 600,
              }}
            >
              Level: {String(data.level)}
            </span>
          ) : null}
          <CopyEntityButton entityData={data} name={entity.data.name} />
        </div>

        {entity.data.technologies.length ? (
          <p className="row__tech" style={{ marginTop: 'var(--space-loose)' }}>
            {entity.data.technologies.map((tech) => <span key={tech} className="tech">{tech}</span>)}
          </p>
        ) : null}
      </header>

      {entity.kind === 'experience' && entity.relations.some((r) => r.kind === 'products' || r.kind === 'projects') ? (
        <section style={{ marginBottom: 'var(--space-wide)', padding: 'var(--space)', border: '1px solid var(--rule-strong)', borderRadius: '10px', background: 'var(--surface-raised)' }}>
          <h3 className="label" style={{ color: 'var(--signal)', marginBottom: 'var(--space-snug)', display: 'flex', alignItems: 'center', gap: 'var(--space-tight)' }}>
            <span>Master Deliverables (Products & Projects)</span>
          </h3>
          <div style={{ display: 'grid', gap: 'var(--space-snug)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
            {entity.relations
              .filter((r) => r.kind === 'products' || r.kind === 'projects')
              .map((item) => {
                const itemCat = CATEGORIES[item.kind];
                return (
                  <Link
                    key={`${item.kind}:${item.id}`}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-snug)',
                      padding: 'var(--space-snug) var(--space)',
                      border: '1px solid var(--rule)',
                      borderRadius: '6px',
                      background: 'var(--surface-base)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ color: 'var(--signal)', display: 'flex', alignItems: 'center' }}>
                      <MetaphorMark name={itemCat.mark} size={20} />
                    </span>
                    <div>
                      <span className="title" style={{ fontSize: 'var(--text-body)', color: 'var(--ink-bright)', display: 'block' }}>
                        {(item.name.split('—')[0] ?? item.name).trim()}
                      </span>
                      <span className="meta" style={{ fontSize: 'var(--text-fine)', color: 'var(--ink-faint)' }}>
                        {itemCat.singular} · View technical record →
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      ) : null}

      {category.sections.map((section) => (
        <div key={section}>{sections[section]}</div>
      ))}

      {entity.danglingRefs.length ? (
        <p className="notice" style={{ marginTop: 'var(--space-loose)' }}>
          <strong>Unresolved references.</strong> This entry points at {entity.danglingRefs.join(', ')}, which does not
          exist in the content file. The links are hidden rather than broken.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- sub-views */

interface ArchitectureData {
  summary?: string;
  diagram?: Parameters<typeof MediaGallery>[0]['items'][number];
  layers: { name: string; detail?: string; technologies: string[] }[];
  decisions: { title: string; rationale?: string; tradeoff?: string }[];
}

function ArchitectureView({ architecture }: { architecture: ArchitectureData }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-loose)' }}>
      {architecture.summary ? <p className="prose">{architecture.summary}</p> : null}

      {architecture.layers?.length ? (
        <ol style={{ listStyle: 'none', padding: 0, display: 'grid', maxWidth: 'var(--measure)' }}>
          {architecture.layers.map((layer, index) => (
            <li
              key={layer.name}
              style={{
                display: 'grid', gridTemplateColumns: '2rem 1fr', gap: 'var(--space)',
                padding: 'var(--space-snug) 0', borderTop: index === 0 ? 0 : '1px solid var(--rule)',
              }}
            >
              <span className="meta" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p style={{ color: 'var(--ink-bright)' }}>{layer.name}</p>
                {layer.detail ? <p className="label">{layer.detail}</p> : null}
                {layer.technologies?.length ? (
                  <p className="row__tech">{layer.technologies.map((tech) => <span key={tech} className="tech">{tech}</span>)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {architecture.decisions?.length ? (
        <div>
          <h4 className="label" style={{ color: 'var(--ink-faint)' }}>Decisions and what they cost</h4>
          <dl style={{ display: 'grid', gap: 'var(--space)', marginTop: 'var(--space-tight)', maxWidth: 'var(--measure)' }}>
            {architecture.decisions.map((decision) => (
              <div key={decision.title}>
                <dt style={{ color: 'var(--ink-bright)' }}>{decision.title}</dt>
                {decision.rationale ? <dd style={{ margin: 0, color: 'var(--ink-quiet)' }}>{decision.rationale}</dd> : null}
                {decision.tradeoff ? (
                  <dd style={{ margin: 0, color: 'var(--ink-faint)', fontSize: 'var(--text-meta)' }}>Trade-off: {decision.tradeoff}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {architecture.diagram ? <MediaGallery items={[architecture.diagram]} /> : null}
    </div>
  );
}

/** Projects carry the full experimental record, failures included (§22). */
function LabNotes({ data }: { data: Loose }) {
  const entries: [string, string | string[] | undefined][] = [
    ['Problem', data.problem as string | undefined],
    ['Hypothesis', data.hypothesis as string | undefined],
    ['Approach', data.approach as string | undefined],
    ['Implementation', data.implementation as string | undefined],
    ['Results', data.results as string | undefined],
    ['What did not work', list(data.failures)],
    ['What it taught me', list(data.lessons)],
    ['Next', list(data.futureWork)],
  ];
  const present = entries.filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  if (present.length === 0) return null;

  return (
    <Disclosure label="Lab notes" hint="Problem through to what it taught me" defaultOpen>
      <div style={{ display: 'grid', gap: 'var(--space-loose)' }}>
        {present.map(([title, value]) => (
          <div key={title}>
            <h4 className="label" style={{ color: 'var(--ink-faint)', marginBottom: 'var(--space-hair)' }}>{title}</h4>
            {Array.isArray(value) ? <Bullets items={value} /> : <p className="prose">{value}</p>}
          </div>
        ))}
      </div>
    </Disclosure>
  );
}
