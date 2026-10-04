import { Disclosure } from '../Disclosure';
import type { SectionProps } from './registry';

export function EntityEvidence({ entity }: SectionProps) {
  if (!entity.data.evidence.length) return null;
  return (
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
  );
}
