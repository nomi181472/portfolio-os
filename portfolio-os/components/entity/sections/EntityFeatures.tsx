import { Disclosure } from '../Disclosure';
import type { SectionProps } from './registry';

export function EntityFeatures({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!Array.isArray(data.features) || !data.features.length) return null;
  return (
    <Disclosure label="Capabilities" hint={`${(data.features).length} listed`}>
      <dl style={{ display: 'grid', gap: 'var(--space)', maxWidth: 'var(--measure)' }}>
        {(data.features as { name: string; detail?: string }[]).map((feature) => (
          <div key={feature.name}>
            <dt style={{ color: 'var(--ink-bright)' }}>{feature.name}</dt>
            {feature.detail ? <dd style={{ margin: 0, color: 'var(--ink-quiet)' }}>{feature.detail}</dd> : null}
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}
