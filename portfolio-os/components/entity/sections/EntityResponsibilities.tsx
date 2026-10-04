import { Disclosure } from '../Disclosure';
import { Bullets, list } from './shared';
import type { SectionProps } from './registry';

export function EntityResponsibilities({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  const items = list(data.responsibilities);
  if (!items.length) return null;
  return (
    <Disclosure label="Responsibilities" defaultOpen>
      <Bullets items={items} />
    </Disclosure>
  );
}
