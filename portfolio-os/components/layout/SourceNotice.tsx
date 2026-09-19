import type { DataSourceState } from '@/types/portfolio';
import { portfolioConfig } from '@/config/portfolio.config';

/**
 * Provenance, stated once and quietly. A failed remote fetch is a fact about
 * the content, not a catastrophe, so it reads as a note rather than an error.
 */
export function SourceNotice({ source, exampleContent }: { source: DataSourceState; exampleContent: boolean }) {
  const showExample = exampleContent && portfolioConfig.features.exampleNotice;
  if (source.status !== 'fallback' && !showExample) return null;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-snug)', marginBottom: 'var(--space-loose)' }}>
      {source.status === 'fallback' ? (
        <p className="notice">
          <strong>Showing bundled content.</strong> The configured source at {source.url} could not be used: {source.reason}.
          Everything below is the copy committed to this repository.
        </p>
      ) : null}
      {showExample ? (
        <p className="notice">
          <strong>This is example content.</strong> It is written to be realistic so the design can be judged, but the
          person, products and findings are invented. Replace <code>content/portfolio.json</code> with your own, or point
          the data source at a JSON file you control.
        </p>
      ) : null}
    </div>
  );
}
