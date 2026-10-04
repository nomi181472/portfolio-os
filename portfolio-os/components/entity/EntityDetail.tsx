/**
 * components/entity/EntityDetail.tsx
 *
 * One detail renderer for every category. Which sections appear, and in what
 * order, comes from the category registry; whether a section appears at all
 * comes from whether the data is there. So a product with no architecture
 * simply has no architecture section — there is no empty state to design, and
 * no per-category page to maintain (§42, §106).
 *
 * Depth is enforced here: \`description\` and the category's headline sections
 * render open, everything heavier sits behind a disclosure.
 */

import { CATEGORIES } from '@/lib/categories';
import { SECTION_REGISTRY } from './sections/registry';
import { EntityHeader } from './sections/EntityHeader';
import type { ResolvedEntity } from '@/types/portfolio';

export function EntityDetail({ entity }: { entity: ResolvedEntity }) {
  const category = CATEGORIES[entity.kind];

  return (
    <div>
      <EntityHeader entity={entity} />

      {category.sections.map((sectionKey) => {
        const SectionComponent = SECTION_REGISTRY[sectionKey];
        if (!SectionComponent) return null;
        return <SectionComponent key={sectionKey} entity={entity} />;
      })}

      {entity.danglingRefs.length ? (
        <p className="notice" style={{ marginTop: 'var(--space-loose)' }}>
          <strong>Unresolved references.</strong> This entry points at {entity.danglingRefs.join(', ')}, which does not
          exist in the content file. The links are hidden rather than broken.
        </p>
      ) : null}
    </div>
  );
}
