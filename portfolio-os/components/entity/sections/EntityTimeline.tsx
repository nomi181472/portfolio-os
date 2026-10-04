import { Disclosure } from '../Disclosure';
import { PeriodPulse } from '../PeriodPulse';
import { pulseStagger } from '@/lib/pulse';
import type { SectionProps } from './registry';

export function EntityTimeline({ entity }: SectionProps) {
  if (!entity.data.timeline.length) return null;
  return (
    <Disclosure label="Timeline">
      <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-snug)' }}>
        {entity.data.timeline.map((event, index) => (
          <li key={`${event.date}-${event.label}`} style={{ display: 'grid', gridTemplateColumns: '7rem 1fr', gap: 'var(--space)' }}>
            <PeriodPulse text={event.date} className="meta" stagger={pulseStagger(index)} />
            <span>
              {event.label}
              {event.detail ? <span className="label" style={{ display: 'block' }}>{event.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}
