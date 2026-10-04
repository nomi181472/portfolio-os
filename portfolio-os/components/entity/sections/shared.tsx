export function list(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]).filter(Boolean) : [];
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: '1.1em', display: 'grid', gap: 'var(--space-tight)', maxWidth: 'var(--measure)' }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'var(--space-loose)' }}>
      <h3 className="label" style={{ color: 'var(--ink-faint)', marginBottom: 'var(--space-tight)' }}>{title}</h3>
      {children}
    </div>
  );
}
