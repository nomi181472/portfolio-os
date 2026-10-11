import Link from 'next/link';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { CATEGORIES } from '@/lib/categories';
import type { RelationEdge, ResolvedEntity } from '@/types/portfolio';
import styles from './PrevNext.module.css';

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

  const categoryPrev = previous ? CATEGORIES[previous.kind] : undefined;
  const categoryNext = next ? CATEGORIES[next.kind] : undefined;

  return (
    <nav aria-label="Adjacent entries" className={styles.nav}>
      {previous ? (
        <Link
          href={previous.href}
          scroll={true}
          className={styles.prevNextCard}
          data-direction="prev"
        >
          <div className={styles.prevNextMeta}>
            <span className={styles.arrowIcon}>
              <MetaphorMark name="arrow-back" size={16} />
            </span>
            <span className={styles.metaLabel}>
              Previous{categoryPrev ? ` · ${categoryPrev.singular}` : ''}
            </span>
          </div>
          <div className={styles.prevNextTitleWrap}>
            <span className={styles.prevNextTitle}>{previous.data.name}</span>
          </div>
        </Link>
      ) : (
        <div className={styles.spacer} aria-hidden="true" />
      )}

      {next ? (
        <Link
          href={next.href}
          scroll={true}
          className={styles.prevNextCard}
          data-direction="next"
        >
          <div className={styles.prevNextMeta} style={{ justifyContent: 'flex-end' }}>
            <span className={styles.metaLabel}>
              Next{categoryNext ? ` · ${categoryNext.singular}` : ''}
            </span>
            <span className={styles.arrowIcon}>
              <MetaphorMark name="arrow-next" size={16} />
            </span>
          </div>
          <div className={styles.prevNextTitleWrap} style={{ textAlign: 'right' }}>
            <span className={styles.prevNextTitle}>{next.data.name}</span>
          </div>
        </Link>
      ) : null}
    </nav>
  );
}
