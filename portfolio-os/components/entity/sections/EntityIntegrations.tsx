import type { SectionProps } from './registry';

export function EntityIntegrations({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!Array.isArray(data.integrations) || !data.integrations.length) return null;
  return (
    <section style={{ marginTop: 'var(--space-loose)', marginBottom: 'var(--space-loose)', padding: 'var(--space)', border: '1px solid var(--rule-strong)', borderRadius: '10px', background: 'var(--surface-raised)' }}>
      <h3 className="label" style={{ color: 'var(--ink-bright)', marginBottom: 'var(--space-snug)', display: 'flex', alignItems: 'center', gap: 'var(--space-tight)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal)', boxShadow: '0 0 6px var(--glow)' }} />
        <span>External Ecosystem & Market Integrations</span>
      </h3>
      <p className="meta" style={{ marginBottom: 'var(--space)', color: 'var(--ink-quiet)' }}>
        High-availability connectivity with external partner ecosystems, live exchanges, and enterprise gateways.
      </p>
      <div style={{ display: 'grid', gap: 'var(--space-snug)' }}>
        {(data.integrations as Array<{ name: string; type: string; status?: string; detail: string; url?: string }>).map((item) => (
          <div
            key={item.name}
            style={{
              padding: 'var(--space)',
              border: '1px solid var(--rule)',
              borderRadius: '8px',
              background: 'var(--surface-raised)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-snug)' }}>
              <span className="title" style={{ fontSize: 'var(--text-lead)', color: 'var(--ink-bright)' }}>{item.name}</span>
              <span
                className="badge"
                style={{
                  fontFamily: 'var(--font-data)',
                  background: 'var(--fill-faint)',
                  border: '1px solid var(--fill-strong)',
                  color: 'var(--ink-bright)',
                  fontSize: 'var(--text-fine)',
                }}
              >
                {item.status || 'Active Integration'}
              </span>
            </div>
            <p className="meta" style={{ marginTop: 'var(--space-hair)', color: 'var(--ink-quiet)' }}>
              {item.type}
            </p>
            <p style={{ marginTop: 'var(--space-tight)', fontSize: 'var(--text-body)', color: 'var(--ink)' }}>
              {item.detail}
            </p>
            {item.url ? (
              <p style={{ marginTop: 'var(--space-tight)' }}>
                <a href={item.url} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 'var(--text-fine)' }}>
                  External Gateway Reference ↗
                </a>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
