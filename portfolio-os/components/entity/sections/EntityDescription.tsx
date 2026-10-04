import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SectionProps } from './registry';

export function EntityDescription({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!entity.data.description && !data.reason) return null;
  
  return (
    <div style={{ display: 'grid', gap: 'var(--space-loose)' }}>
      {data.reason ? (
        <blockquote
          style={{
            margin: 0,
            padding: 'var(--space) var(--space-loose)',
            borderLeft: '3px solid var(--signal)',
            background: 'var(--surface-raised)',
            borderRadius: '0 8px 8px 0',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lead)',
            lineHeight: 1.6,
            color: 'var(--ink-bright)',
          }}
        >
          “{String(data.reason)}”
        </blockquote>
      ) : null}
      {entity.data.description ? (
        <div className="prose lead">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {entity.data.description}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
