import { Disclosure } from '../Disclosure';
import { PeriodPulse } from '../PeriodPulse';
import { pulseStagger } from '@/lib/pulse';
import type { SectionProps } from './registry';

export function EntityFindings({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!Array.isArray(data.findings) || !data.findings.length) return null;
  return (
    <Disclosure label="Findings" hint="Dated, with confidence stated" defaultOpen>
      <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-loose)', maxWidth: 'var(--measure)' }}>
        {(data.findings as { date: string; observation: string; evidence?: string; confidence: string; supersededBy?: string }[]).map(
          (finding, index) => (
            <li key={`${finding.date}-${finding.observation.slice(0, 16)}`} style={{ borderLeft: '1px solid var(--rule-strong)', paddingLeft: 'var(--space)' }}>
              <p className="meta">
                <PeriodPulse text={finding.date} stagger={pulseStagger(index)} /> · confidence {finding.confidence}
                {finding.supersededBy ? ' · superseded' : ''}
              </p>
              <p style={{ marginTop: 'var(--space-hair)' }}>{finding.observation}</p>
              {finding.evidence ? <p className="label" style={{ marginTop: 'var(--space-hair)' }}>{finding.evidence}</p> : null}
            </li>
          ),
        )}
      </ol>
    </Disclosure>
  );
}
