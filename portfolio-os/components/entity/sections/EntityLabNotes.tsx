import { Disclosure } from '../Disclosure';
import { Bullets, list } from './shared';
import type { SectionProps } from './registry';

export function EntityLabNotes({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  const entries: [string, string | string[] | undefined][] = [
    ['Problem', data.problem as string | undefined],
    ['Hypothesis', data.hypothesis as string | undefined],
    ['Approach', data.approach as string | undefined],
    ['Implementation', data.implementation as string | undefined],
    ['Results', data.results as string | undefined],
    ['What did not work', list(data.failures)],
    ['What it taught me', list(data.lessons)],
    ['Next', list(data.futureWork)],
  ];
  const present = entries.filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  if (present.length === 0) return null;

  return (
    <Disclosure label="Lab notes" hint="Problem through to what it taught me" defaultOpen>
      <div style={{ display: 'grid', gap: 'var(--space-loose)' }}>
        {present.map(([title, value]) => (
          <div key={title}>
            <h4 className="label" style={{ color: 'var(--ink-faint)', marginBottom: 'var(--space-hair)' }}>{title}</h4>
            {Array.isArray(value) ? <Bullets items={value} /> : <p className="prose">{value}</p>}
          </div>
        ))}
      </div>
    </Disclosure>
  );
}
