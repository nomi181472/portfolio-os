import Link from 'next/link';

export interface Crumb { label: string; href?: string }

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="meta" style={{ marginBottom: 'var(--space-loose)' }}>
      <ol style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-tight)', listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.6 }}>
        {trail.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-tight)' }}>
            {index > 0 ? <span aria-hidden="true" style={{ color: 'var(--rule-strong)' }}>/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="link" style={{ borderBottom: 0, wordBreak: 'break-word' }}>{crumb.label}</Link>
            ) : (
              <span style={{ color: 'var(--ink-quiet)', wordBreak: 'break-word' }}>{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
