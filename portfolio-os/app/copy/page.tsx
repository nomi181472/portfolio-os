import type { Metadata } from 'next';
import { getGraph } from '@/lib/source';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CopyHub } from '@/components/copy/CopyHub';

export const metadata: Metadata = {
  title: 'Copy this Portfolio OS',
  description: 'Fork, clone, or copy the content and configuration to make this portfolio your own.',
};

export default async function CopyPage() {
  const { bundle } = await getGraph();
  const rawJson = JSON.stringify(bundle.data, null, 2);

  return (
    <div className="page">
      <Breadcrumbs trail={[{ label: 'Surface', href: '/' }, { label: 'Copy this OS' }]} />
      <Ruler depth={1} label="Distribution & Forking" />

      <header style={{ marginTop: 'var(--space)', marginBottom: 'var(--space-snug)' }}>
        <h1 className="heading">Copy this Portfolio OS</h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          This entire portfolio is 100% data-driven. The interface holds no hardcoded content.
          Copy the JSON, customize the config, or clone the repository to deploy your own in minutes.
        </p>
      </header>

      <CopyHub rawJson={rawJson} />
    </div>
  );
}
