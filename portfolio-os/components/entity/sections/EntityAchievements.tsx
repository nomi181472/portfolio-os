import { Disclosure } from '../Disclosure';
import { Bullets, list } from './shared';
import type { SectionProps } from './registry';

export function EntityAchievements({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  const items = list(data.achievements);
  if (!items.length) return null;

  const isEducation = entity.kind === 'education';
  const label = isEducation ? 'Academic Highlights & Outcomes' : 'What changed';
  const hint = isEducation
    ? 'Key research breakthroughs, honors, and verified outcomes'
    : 'Outcomes, with their context';

  return (
    <Disclosure label={label} hint={hint} defaultOpen={isEducation}>
      <Bullets items={items} />
    </Disclosure>
  );
}
