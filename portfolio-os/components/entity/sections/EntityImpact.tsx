import { Block } from './shared';
import type { SectionProps } from './registry';

export function EntityImpact({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!data.impact) return null;
  return (
    <Block title="Impact">
      <p className="lead" style={{ color: 'var(--ink-bright)' }}>{String(data.impact)}</p>
    </Block>
  );
}
