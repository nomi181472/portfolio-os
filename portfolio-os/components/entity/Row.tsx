import Link from 'next/link';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { StatusBadge, OrganisationBadge, DepthBadge } from './Badges';
import { SkillLensGauge } from '@/components/skills/SkillLensGauge';
import { PeriodPulse } from './PeriodPulse';
import { formatDate, formatPeriod } from '@/lib/format';
import { pulseStagger } from '@/lib/pulse';
import { CATEGORIES } from '@/lib/categories';
import type { ResolvedEntity } from '@/types/portfolio';

/**
 * Preview depth (§2, depth 2). A row states four things and stops: what it is,
 * what it does, when, and what state it is in. Everything else is one click
 * away, and the row is the click target.
 */
export function Row({ entity, showPeriod = true, index = 0 }: { entity: ResolvedEntity; showPeriod?: boolean; index?: number }) {
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
          {kind === 'skills' && 'depth' in data && data.depth ? (
            <DepthBadge depth={String(data.depth)} />
          ) : null}
        </div>
        {context ? (
          <p className="label" style={{ marginTop: 4 }}>{context}</p>
        ) : null}
        {kind === 'skills' ? (
          <div style={{ marginTop: 'var(--space-hair)', marginBottom: 'var(--space-hair)' }}>
            <SkillLensGauge data={data as Record<string, unknown>} />
          </div>
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
        {kind === 'skills' && 'firstUsed' in data && data.firstUsed ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 'var(--text-fine)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--ink-quiet)',
              whiteSpace: 'nowrap',
            }}
          >
            Since {String(data.firstUsed)}
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
        {period ? (
          <PeriodPulse text={period} className="meta" stagger={pulseStagger(index)} />
        ) : null}
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
      {entities.map((entity, index) => (
        <Row key={`${entity.kind}:${entity.data.id}`} entity={entity} showPeriod={showPeriod} index={index} />
      ))}
    </div>
  );
}
