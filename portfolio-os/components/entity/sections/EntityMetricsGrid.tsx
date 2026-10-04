import { Block } from './shared';
import type { SectionProps } from './registry';

export function EntityMetricsGrid({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!Array.isArray(data.metrics) || !data.metrics.length) return null;
  return (
    <Block title="Measured">
      <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-wide)' }}>
        {(data.metrics as { label: string; value: string; note?: string }[]).map((metric) => (
          <div key={metric.label}>
            <dd className="title" style={{ margin: 0 }}>{metric.value}</dd>
            <dt className="meta">{metric.label}</dt>
            {metric.note ? <dd className="meta" style={{ margin: 0, color: 'var(--ink-faint)' }}>{metric.note}</dd> : null}
          </div>
        ))}
      </dl>
    </Block>
  );
}
