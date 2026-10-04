import type { SectionProps } from './registry';

export function EntityLinks({ entity }: SectionProps) {
  if (entity.data.links.length === 0) return null;
  return (
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
  );
}
