import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <h1 className="heading">This route does not resolve</h1>
      <p className="lead" style={{ marginTop: 'var(--space)' }}>
        Either the entry was renamed in the content file, or the link predates a change to it. Both are recoverable.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-snug)', marginTop: 'var(--space-loose)' }}>
        <Link className="control" href="/">Back to the surface</Link>
        <Link className="control" href="/explore">Browse by question</Link>
      </div>
    </div>
  );
}
