import { humanise } from '@/lib/format';
import type { Source } from '@/types/portfolio';

/** One badge component for the one status vocabulary (§100). */
export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span className="badge" data-state={status}>
      <span className="visually-hidden">Status: </span>
      {humanise(status)}
    </span>
  );
}

/**
 * Source position is always stated, including when the answer is "you cannot
 * see this" (§20, §64). Silence would read as an oversight; a stated closed
 * position reads as a decision.
 */
export function SourceBadge({ source }: { source?: Source }) {
  if (!source) return null;
  const readable: Record<string, string> = {
    'open-source': 'Open source',
    'source-available': 'Source available',
    'closed-source': 'Closed source',
    private: 'Private',
    prototype: 'Prototype',
    experimental: 'Experimental',
  };
  const label = readable[source.type] ?? humanise(source.type);
  const body = (
    <>
      {label}
      {source.license ? <span style={{ color: 'var(--ink-faint)' }}> · {source.license}</span> : null}
    </>
  );
  if (source.url && (source.type === 'open-source' || source.type === 'source-available')) {
    return <a className="badge" data-state={source.type} href={source.url} target="_blank" rel="noreferrer">{body}</a>;
  }
  return <span className="badge" data-state={source.type}>{body}</span>;
}

export function OrganisationBadge({ organisation }: { organisation?: string }) {
  if (!organisation) return null;
  const isIndependent = organisation.toLowerCase().includes('independent');

  if (isIndependent) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--text-fine)',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          padding: '2px 9px',
          borderRadius: '4px',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.45)',
          color: '#38bdf8',
          boxShadow: '0 0 10px rgba(56, 189, 248, 0.15)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
        {organisation}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-data)',
        fontSize: 'var(--text-fine)',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '2px 9px',
        borderRadius: '4px',
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid rgba(245, 158, 11, 0.5)',
        color: '#fbbf24',
        boxShadow: '0 0 10px rgba(245, 158, 11, 0.15)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px #fbbf24' }} />
      Company · {organisation}
    </span>
  );
}
