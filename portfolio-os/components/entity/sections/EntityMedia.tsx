import { MediaGallery } from '@/components/media/Media';
import type { SectionProps } from './registry';

export function EntityMedia({ entity }: SectionProps) {
  if (!entity.data.media.length) return null;
  return (
    <div style={{ marginTop: 'var(--space-wide)' }}>
      <MediaGallery items={entity.data.media} />
    </div>
  );
}
