import { Disclosure } from '../Disclosure';
import { Bullets, list } from './shared';
import type { SectionProps } from './registry';

export function EntitySystems({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  const items = list(data.systems);
  if (!items.length) return null;
  return (
    <Disclosure label="Systems worked on">
      <Bullets items={items} />
    </Disclosure>
  );
}
