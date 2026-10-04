import { Disclosure } from '../Disclosure';
import { MediaGallery } from '@/components/media/Media';
import type { SectionProps } from './registry';

interface ArchitectureData {
  summary?: string;
  diagram?: Parameters<typeof MediaGallery>[0]['items'][number];
  layers: { name: string; detail?: string; technologies: string[] }[];
  decisions: { title: string; rationale?: string; tradeoff?: string }[];
}

function ArchitectureView({ architecture }: { architecture: ArchitectureData }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-loose)' }}>
      {architecture.summary ? <p className="prose">{architecture.summary}</p> : null}

      {architecture.layers?.length ? (
        <ol style={{ listStyle: 'none', padding: 0, display: 'grid', maxWidth: 'var(--measure)' }}>
          {architecture.layers.map((layer, index) => (
            <li
              key={layer.name}
              style={{
                display: 'grid', gridTemplateColumns: '2rem 1fr', gap: 'var(--space)',
                padding: 'var(--space-snug) 0', borderTop: index === 0 ? 0 : '1px solid var(--rule)',
              }}
            >
              <span className="meta" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p style={{ color: 'var(--ink-bright)' }}>{layer.name}</p>
                {layer.detail ? <p className="label">{layer.detail}</p> : null}
                {layer.technologies?.length ? (
                  <p className="row__tech">{layer.technologies.map((tech) => <span key={tech} className="tech">{tech}</span>)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {architecture.decisions?.length ? (
        <div>
          <h4 className="label" style={{ color: 'var(--ink-faint)' }}>Decisions and what they cost</h4>
          <dl style={{ display: 'grid', gap: 'var(--space)', marginTop: 'var(--space-tight)', maxWidth: 'var(--measure)' }}>
            {architecture.decisions.map((decision) => (
              <div key={decision.title}>
                <dt style={{ color: 'var(--ink-bright)' }}>{decision.title}</dt>
                {decision.rationale ? <dd style={{ margin: 0, color: 'var(--ink-quiet)' }}>{decision.rationale}</dd> : null}
                {decision.tradeoff ? (
                  <dd style={{ margin: 0, color: 'var(--ink-faint)', fontSize: 'var(--text-meta)' }}>Trade-off: {decision.tradeoff}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {architecture.diagram ? <MediaGallery items={[architecture.diagram]} /> : null}
    </div>
  );
}

export function EntityArchitecture({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!data.architecture) return null;
  return (
    <Disclosure label="Architecture" hint="How it is put together, and why">
      <ArchitectureView architecture={data.architecture as ArchitectureData} />
    </Disclosure>
  );
}
