import Link from 'next/link';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { StatusBadge, OrganisationBadge } from './Badges';
import { formatDate, formatPeriod } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';
import type { ResolvedEntity } from '@/types/portfolio';

/**
 * Preview depth (§2, depth 2). A row states four things and stops: what it is,
 * what it does, when, and what state it is in. Everything else is one click
 * away, and the row is the click target.
 */
export function Row({ entity, showPeriod = true }: { entity: ResolvedEntity; showPeriod?: boolean }) {
  const { data, kind, href } = entity;
  const category = CATEGORIES[kind];
  const rawPeriod = 'period' in data && data.period
    ? formatPeriod(data.period)
    : ('date' in data && data.date
        ? formatDate(String(data.date))
        : ('issued' in data && data.issued ? formatDate(String(data.issued)) : ''));
  const period = showPeriod ? rawPeriod : '';
  const org = 'organisation' in data
    ? (data as { organisation?: string }).organisation
    : ('institution' in data
        ? (data as { institution?: string }).institution
        : ('venue' in data ? (data as { venue?: string }).venue : undefined));
  const subContext = 'context' in data ? (data as { context?: string }).context : undefined;
  const role = 'role' in data ? (data as { role?: string }).role : undefined;
  const isDeliverable = kind === 'projects' || kind === 'products';
  const context = [role, isDeliverable ? undefined : org, subContext].filter(Boolean).join(' · ');

  const masterDeliverables =
    kind === 'experience'
      ? entity.relations.filter((edge) => edge.kind === 'products' || edge.kind === 'projects')
      : [];

  return (
    <article className="row" id={data.id}>
      <span className="row__mark"><MetaphorMark name={category.mark} /></span>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 className="row__name" style={{ margin: 0 }}>
            <Link
              href={href}
              scroll={true}
              data-analytics-id={data.id}
              data-analytics-type={kind}
              data-analytics-namespace="entity"
            >
              {data.name}
            </Link>
          </h3>
          {isDeliverable && org ? <OrganisationBadge organisation={org} /> : null}
        </div>
        {context ? (
          <p className="label" style={{ marginTop: 4 }}>{context}</p>
        ) : null}
        {data.summary ? <p className="row__summary">{data.summary}</p> : null}
        {data.technologies.length > 0 ? (
          <p className="row__tech">
            {data.technologies.slice(0, 6).map((tech) => (
              <span key={tech} className="tech">{tech}</span>
            ))}
            {data.technologies.length > 6 ? (
              <span className="tech" style={{ borderColor: 'transparent' }}>+{data.technologies.length - 6}</span>
            ) : null}
          </p>
        ) : null}
        {masterDeliverables.length > 0 ? (
          <div style={{ marginTop: 'var(--space-snug)', display: 'flex', alignItems: 'center', gap: 'var(--space-tight)', flexWrap: 'wrap' }}>
            <span className="meta" style={{ color: 'var(--signal)', fontSize: 'var(--text-fine)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Master Deliverables:
            </span>
            {masterDeliverables.map((del) => (
              <Link
                key={`${del.kind}:${del.id}`}
                href={del.href}
                className="tech"
                style={{
                  color: 'var(--ink-bright)',
                  borderColor: 'var(--rule-strong)',
                  background: 'var(--surface-raised)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--text-fine)',
                  textDecoration: 'none',
                }}
              >
                <MetaphorMark name={CATEGORIES[del.kind].mark} size={12} />
                <span>{(del.name.split('—')[0] ?? del.name).trim()}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="row__aside">
        {'design' in data && data.design && 'support' in data && data.support ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: 'var(--ink-bright)',
              flexWrap: 'wrap',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            <span>Design: {String(data.design)}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Support: {String(data.support)}</span>
          </span>
        ) : 'agentic' in data && data.agentic && 'aiAssisted' in data && data.aiAssisted && 'independent' in data && data.independent ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: 'var(--ink-bright)',
              flexWrap: 'wrap',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            <span>Agentic: {String(data.agentic)}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>AI: {String(data.aiAssisted)}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Independent: {String(data.independent)}</span>
          </span>
        ) : 'reading' in data && data.reading && 'writing' in data && data.writing ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: 'var(--ink-bright)',
              flexWrap: 'wrap',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            <span>Reading: {String(data.reading)}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Writing: {String(data.writing)}</span>
          </span>
        ) : 'handling' in data && data.handling ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: 'var(--ink-bright)',
              flexWrap: 'wrap',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            Handling: {String(data.handling)}
          </span>
        ) : 'proficiency' in data && data.proficiency ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: 'var(--ink-bright)',
              flexWrap: 'wrap',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            Proficiency: {String(data.proficiency)}
          </span>
        ) : 'level' in data && data.level ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: 'var(--ink-bright)',
              flexWrap: 'wrap',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            Level: {String(data.level)}
          </span>
        ) : null}
        {org && (kind === 'products' || kind === 'projects') ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '3px 8px',
              borderRadius: '4px',
              background: org.toLowerCase().includes('independent') ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${org.toLowerCase().includes('independent') ? 'var(--rule)' : 'var(--rule-strong)'}`,
              color: org.toLowerCase().includes('independent') ? 'var(--ink-quiet)' : 'var(--ink-bright)',
              flexWrap: 'wrap',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1.4,
            }}
          >
            {org}
          </span>
        ) : null}
        <StatusBadge status={data.status} />
        {period ? <span className="meta">{period}</span> : null}
      </div>
    </article>
  );
}

export function Rows({ entities, showPeriod }: { entities: ResolvedEntity[]; showPeriod?: boolean }) {
  if (entities.length === 0) {
    return (
      <p className="notice">
        Nothing here yet. Add an entry to this collection in <code>portfolio.json</code> and it will appear.
      </p>
    );
  }
  return (
    <div className="rows">
      {entities.map((entity) => (
        <Row key={`${entity.kind}:${entity.data.id}`} entity={entity} showPeriod={showPeriod} />
      ))}
    </div>
  );
}
