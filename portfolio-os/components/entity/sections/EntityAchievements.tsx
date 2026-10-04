import { Disclosure } from '../Disclosure';
import { Bullets, list } from './shared';
import type { SectionProps } from './registry';

export function EntityAchievements({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  const items = list(data.achievements);
  if (!items.length) return null;
  return (
    <Disclosure label="What changed" hint="Outcomes, with their context">
      <Bullets items={items} />
    </Disclosure>
  );
}
