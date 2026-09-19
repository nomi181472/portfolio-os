import type { Metadata } from 'next';
import Link from 'next/link';
import { getGraph } from '@/lib/source';
import { portfolioConfig } from '@/config/portfolio.config';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Colophon',
  description: 'How this site is built, what the content source is, and how to fork it.',
};

/** Provenance in full, for the visitor who wants to take the thing apart. */
export default async function ColophonPage() {
  const { bundle } = await getGraph();

  // Stated precisely, because this is the page someone reads when the content
  // they published is not the content they can see.
  const contentSource =
    bundle.source.status === 'remote'
      ? `Public JSON at ${bundle.source.url}, fetched ${bundle.source.fetchedAt}`
      : bundle.source.status === 'fallback'
        ? `portfolio.json in this repository. The configured source at ${bundle.source.url} was not used: ${bundle.source.reason}`
        : 'portfolio.json in this repository';

  const rows: [string, React.ReactNode][] = [
    ['Content', contentSource],
    ['Schema', `Version ${bundle.data.schemaVersion}, validated with Zod on every load`],
    ['Rendering', 'Next.js App Router. Entity pages are statically generated; only search, editing and media controls run on the client'],
    ['Type', 'Newsreader for display and reading, IBM Plex Sans for the interface, IBM Plex Mono for data'],
    ['Colour', `Two values: ${portfolioConfig.theme.primary} and ${portfolioConfig.theme.secondary}. Everything else is derived from them`],
    ['Motion', 'One page-load sequence on the map. Everything else responds to an action, and all of it respects reduced-motion'],
  ];

  return (
    <div className="page">
      <Breadcrumbs trail={[{ label: 'Surface', href: '/' }, { label: 'Colophon' }]} />
      <Ruler depth={1} label="Colophon" />

      <header style={{ marginTop: 'var(--space)', marginBottom: 'var(--space-wide)' }}>
        <h1 className="heading">How this is built</h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          The interface holds no content. Everything you have read came from one JSON file, validated on load and
          resolved into a graph. Replace the file and this becomes your portfolio.
        </p>
      </header>

      <dl style={{ display: 'grid' }}>
        {rows.map(([term, detail]) => (
          <div key={term} style={{ display: 'grid', gridTemplateColumns: '9rem 1fr', gap: 'var(--space)', padding: 'var(--space) 0', borderTop: '1px solid var(--rule)' }}>
            <dt className="meta">{term}</dt>
            <dd style={{ margin: 0 }}>{detail}</dd>
          </div>
        ))}
      </dl>

      <p style={{ marginTop: 'var(--space-wide)' }}>
        <Link href="/edit" className="control">Open the editor and export your own JSON</Link>
      </p>
    </div>
  );
}
