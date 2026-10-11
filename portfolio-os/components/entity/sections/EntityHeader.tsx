import Link from 'next/link';
import { StatusBadge, SourceBadge, OrganisationBadge, DepthBadge } from '../Badges';
import { SkillLensGauge } from '@/components/skills/SkillLensGauge';
import { PeriodPulse } from '../PeriodPulse';
import { formatPeriod, formatDuration, formatDate, humanise } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { CopyEntityButton } from '../CopyEntityButton';
import type { ResolvedEntity } from '@/types/portfolio';

export function EntityHeader({ entity }: { entity: ResolvedEntity }) {
  const data = entity.data as Record<string, unknown>;
  const category = CATEGORIES[entity.kind];
  const period = formatPeriod(entity.data.period);
  const duration = formatDuration(entity.data.period);
  const stamped =
    period ||
    ('date' in data && data.date ? formatDate(String(data.date)) : '') ||
    ('issued' in data && data.issued ? formatDate(String(data.issued)) : '');
  const periodLine = stamped ? `${stamped}${duration ? ` · ${duration}` : ''}` : '';

  return (
    <header style={{ marginBottom: 'var(--space-wide)' }}>
      <p className="meta" style={{ marginBottom: 'var(--space-tight)' }}>{category.singular}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-snug)', flexWrap: 'wrap' }}>
        {entity.data.media?.find((m) => m.url.includes('logo')) ? (
          <div style={{
            width: 'clamp(36px, 8vw, 48px)',
            height: 'clamp(36px, 8vw, 48px)',
            borderRadius: '12px',
            background: 'var(--surface-sunk)',
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
        {entity.kind === 'skills' && 'depth' in data && data.depth ? (
          <DepthBadge depth={String(data.depth)} />
        ) : null}
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
        {entity.data.primaryAction ? (
          <a
            href={entity.data.primaryAction.url}
            target="_blank"
            rel="noreferrer"
            className="control"
            style={{ textDecoration: 'none' }}
          >
            {entity.data.primaryAction.label}
          </a>
        ) : null}
        {'organisation' in data && data.organisation && (entity.kind === 'products' || entity.kind === 'projects') ? (
          <OrganisationBadge organisation={String(data.organisation)} />
        ) : null}
        {'state' in data && data.state ? <span className="badge" data-state={String(data.state)}>{humanise(String(data.state))}</span> : null}
        <SourceBadge source={data.source as never} />
        {periodLine ? <PeriodPulse text={periodLine} className="meta" repeat /> : null}
        {entity.kind === 'skills' ? <SkillLensGauge data={data} /> : null}
        <CopyEntityButton entityData={data} name={entity.data.name} />
      </div>

      {entity.data.technologies.length ? (
        <p className="row__tech" style={{ marginTop: 'var(--space-loose)' }}>
          {entity.data.technologies.map((tech) => <span key={tech} className="tech">{tech}</span>)}
        </p>
      ) : null}
      
      {entity.kind === 'experience' && entity.relations.some((r) => r.kind === 'products' || r.kind === 'projects') ? (
        <section style={{ marginTop: 'var(--space-loose)', marginBottom: 'var(--space-wide)', padding: 'var(--space)', border: '1px solid var(--rule-strong)', borderRadius: '10px', background: 'var(--surface-raised)' }}>
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
                      background: 'var(--surface-raised)',
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
    </header>
  );
}
