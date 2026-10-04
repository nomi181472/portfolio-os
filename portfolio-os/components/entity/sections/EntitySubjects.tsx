import { Block, list } from './shared';
import type { SectionProps } from './registry';

export function EntitySubjects({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  const items = list(data.subjects);
  if (!items.length) return null;
  return (
    <Block title="Studied">
      <p style={{ maxWidth: 'var(--measure)' }}>{items.join(' · ')}</p>
    </Block>
  );
}
