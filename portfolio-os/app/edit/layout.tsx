/**
 * app/edit/layout.tsx — the editor's own segment.
 *
 * EditorProvider used to wrap the entire site from the root layout. That made
 * every visitor on every page mount a context whose first act is a synchronous
 * `localStorage` read on the first render pass, and whose second is a reducer
 * holding a draft of the whole content file — for a route roughly nobody opens.
 * Here it wraps one route, which is the only place `useEditor` can be reached.
 *
 * This is also why the route has a layout at all: `page.tsx` is a client
 * component, and a client module cannot export `metadata`. The segment layout is
 * the only place that flag can live.
 */
import type { Metadata } from 'next';
import { getGraph } from '@/lib/source';
import { EditorProvider } from '@/components/editor/store';
import { EditBar } from '@/components/editor/EditBar';

export const metadata: Metadata = {
  title: 'Editor',
  /*
   * The editor renders the same collections as the site, at a URL nobody is
   * searching for. Without this it competes with the real pages for the same
   * queries — and robots.txt alone does not prevent it, because a disallowed URL
   * can still be indexed without a description. `follow: false` also stops the
   * editor's preview links from handing link equity to entity pages that already
   * have canonicals.
   */
  robots: { index: false, follow: false },
};

export default async function EditLayout({ children }: { children: React.ReactNode }) {
  /*
   * The editor is a draft layered over canonical content (§52, §88), so the
   * provider needs the pristine portfolio from the server. This used to arrive via
   * the root layout, which meant every page on the site fetched and held a copy of
   * the whole content file in a context nobody outside `/edit` could read.
   */
  const { bundle } = await getGraph();

  return (
    <EditorProvider canonical={bundle.data}>
      {children}
      <EditBar />
    </EditorProvider>
  );
}
