import { Disclosure } from '../Disclosure';
import type { SectionProps } from './registry';

export function EntityDatasets({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!Array.isArray(data.datasets) || !data.datasets.length) return null;
  return (
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
  );
}
