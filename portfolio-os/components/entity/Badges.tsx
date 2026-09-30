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
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          padding: '2px 8px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          color: 'var(--ink-quiet)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-quiet)' }} />
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
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: '4px',
        background: 'var(--fill)',
        border: '1px solid var(--line-strong)',
        color: 'var(--ink-bright)',
        boxShadow: '0 0 10px var(--fill-faint)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--signal)', boxShadow: '0 0 6px var(--glow)' }} />
      Company · {organisation}
    </span>
  );
}
