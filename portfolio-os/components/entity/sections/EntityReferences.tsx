import { Disclosure } from '../Disclosure';
import type { SectionProps } from './registry';

export function EntityReferences({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!Array.isArray(data.references) || !data.references.length) return null;
  return (
    <Disclosure label="References">
      <ol style={{ display: 'grid', gap: 'var(--space-tight)', paddingLeft: '1.2em', maxWidth: 'var(--measure)' }}>
        {(data.references as { citation: string; url?: string }[]).map((reference) => (
          <li key={reference.citation} className="label">
            {reference.url ? <a className="link" href={reference.url} target="_blank" rel="noreferrer">{reference.citation}</a> : reference.citation}
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}
