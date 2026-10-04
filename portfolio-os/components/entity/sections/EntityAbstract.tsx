import type { SectionProps } from './registry';

export function EntityAbstract({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!data.abstract) return null;
  return (
    <div className="prose lead">{String(data.abstract)}</div>
  );
}
