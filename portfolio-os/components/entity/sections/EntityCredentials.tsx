import { Block } from './shared';
import type { SectionProps } from './registry';

export function EntityCredentials({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!data.credentialId && !data.verificationUrl && !data.issuer) return null;
  return (
    <Block title="Credential">
      <dl className="meta" style={{ display: 'grid', gap: 'var(--space-hair)' }}>
        {data.issuer ? <div>Issued by {String(data.issuer)}</div> : null}
        {data.credentialId ? <div>ID {String(data.credentialId)}</div> : null}
        {data.expires ? <div>Expires {String(data.expires)}</div> : null}
      </dl>
      {data.verificationUrl ? (
        <a className="control" style={{ marginTop: 'var(--space-snug)' }} href={String(data.verificationUrl)} target="_blank" rel="noreferrer">
          Verify this credential
        </a>
      ) : null}
    </Block>
  );
}
