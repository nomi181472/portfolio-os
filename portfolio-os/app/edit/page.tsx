'use client';

import Link from 'next/link';
import { Workbench } from '@/components/editor/Workbench';
import { useEditor } from '@/components/editor/store';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

/**
 * Edit mode (§47–§57). Local, honest, and reversible. There is no server here,
 * no credential, and no pretence of one: what this gives you is a live preview
 * of changes and a valid file at the end of it.
 */
export default function EditPage() {
  const editor = useEditor();

  return (
    <div className="page">
      <Breadcrumbs trail={[{ label: 'Surface', href: '/' }, { label: 'Edit' }]} />
      <Ruler depth={2} label="Local draft" />

      <header style={{ marginTop: 'var(--space)', marginBottom: 'var(--space-loose)' }}>
        <h1 className="heading">Edit</h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          Changes live in this browser only. Nothing is written to a repository, and the published content is untouched
          until you export a file and commit it yourself.
        </p>
        <p className="meta" style={{ marginTop: 'var(--space-snug)' }}>
          {editor.dirty ? editor.changeSummary : 'No changes'} · <Link className="link" href="/">preview the site</Link>
        </p>
      </header>

      {editor.pendingRestore ? (
        <div className="notice" style={{ marginBottom: 'var(--space-loose)' }}>
          <strong>A draft from a previous session is stored in this browser.</strong>
          <span style={{ display: 'flex', gap: 'var(--space-snug)', marginTop: 'var(--space-snug)' }}>
            <button type="button" className="control" data-emphasis="signal" onClick={editor.acceptRestore}>Restore it</button>
            <button type="button" className="control" onClick={editor.discardRestore}>Discard it</button>
          </span>
        </div>
      ) : null}

      <Workbench />
    </div>
  );
}
