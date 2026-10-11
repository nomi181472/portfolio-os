import { Block, list } from './shared';
import type { SectionProps } from './registry';

export function EntitySubjects({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  const items = list(data.subjects);
  if (!items.length) return null;
  const isEducation = entity.kind === 'education';

  return (
    <Block title={isEducation ? 'Curriculum & Core Subjects' : 'Studied'}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-tight)',
          maxWidth: 'var(--measure)',
          marginTop: 'var(--space-tight)',
        }}
      >
        {items.map((subject) => (
          <span
            key={subject}
            className="tech"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--rule-strong)',
              color: 'var(--ink-bright)',
              fontSize: 'var(--text-small)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--signal)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {subject}
          </span>
        ))}
      </div>
    </Block>
  );
}
