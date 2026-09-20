import Link from 'next/link';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { CATEGORIES } from '@/lib/categories';
import type { RelationEdge, ResolvedEntity } from '@/types/portfolio';

/**
 * Relationships are the navigation (§35). Edges are grouped by what they
 * connect to rather than by whether the author wrote them or the graph derived
 * them, because from a reader's side that difference does not exist.
 */
export function Related({ edges, title = 'Connected work' }: { edges: RelationEdge[]; title?: string }) {
  if (edges.length === 0) return null;
  const grouped = edges.reduce<Record<string, RelationEdge[]>>((acc, edge) => {
    (acc[edge.kind] ??= []).push(edge);
    return acc;
  }, {});

  return (
    <section className="section">
      <h2 className="heading" style={{ fontSize: 'var(--text-title)', marginBottom: 'var(--space-loose)' }}>{title}</h2>
      <div style={{ display: 'grid', gap: 'var(--space-loose)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
        {Object.entries(grouped).map(([kind, group]) => {
          const category = CATEGORIES[kind as keyof typeof CATEGORIES];
          return (
            <div key={kind}>
              <p className="label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-tight)', color: 'var(--ink-faint)' }}>
                <MetaphorMark name={category.mark} size={16} />
                {category.label}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--space-tight)', display: 'grid', gap: 'var(--space-hair)' }}>
                {group.map((edge) => (
                  <li key={`${edge.kind}:${edge.id}`}>
                    <Link href={edge.href} scroll={true} className="link">{edge.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Never leave a reader at a dead end (§12). */
export function PrevNext({ previous, next }: { previous?: ResolvedEntity; next?: ResolvedEntity }) {
  if (!previous && !next) return null;
  return (
    <nav
      aria-label="Adjacent entries"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))',
        gap: 'var(--space)',
        paddingTop: 'var(--space-loose)',
        borderTop: '1px solid var(--rule)',
      }}
    >
      <div>
        {previous ? (
          <Link href={previous.href} scroll={true} style={{ display: 'block', minHeight: '44px' }}>
            <span className="meta">Previous</span>
            <span className="title" style={{ display: 'block', fontSize: 'var(--text-lead)', wordBreak: 'break-word' }}>{previous.data.name}</span>
          </Link>
        ) : null}
      </div>
      <div style={{ textAlign: next ? 'right' : 'left' }}>
        {next ? (
          <Link href={next.href} scroll={true} style={{ display: 'block', minHeight: '44px' }}>
            <span className="meta">Next</span>
            <span className="title" style={{ display: 'block', fontSize: 'var(--text-lead)', wordBreak: 'break-word' }}>{next.data.name}</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
