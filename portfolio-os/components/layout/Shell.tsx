'use client';

/**
 * The shell wires the rail and the command menu together. It is the only client
 * boundary in the layout — pages below it stay server-rendered so their content is
 * in the HTML for crawlers and slow connections.
 *
 * Two things used to live here and no longer do:
 *
 * - The whole search index, passed down from the layout as a prop. That put ~90 kB
 *   of JSON into the initial payload of every page so that a dialog, opened by a
 *   fraction of visitors, would have something to read. It now fetches from
 *   /api/search when it opens.
 * - EditBar, and with it EditorProvider. The editor is one route; wrapping the
 *   entire site in its context meant every visitor parsed localStorage and
 *   carried an isEditing reducer for a feature they would never open.
 *
 * The menu is code-split and mounted only after the first Ctrl+K, and latched
 * rather than derived: once loaded its chunk stays, so the second press is instant.
 */
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { AppearanceChoice } from '@/lib/theme';
import { portfolioConfig } from '@/config/portfolio.config';
import { Rail } from './Rail';
import { GitHubBadge } from './GitHubBadge';

const CommandMenu = dynamic(
  () => import('@/components/search/CommandMenu').then((mod) => mod.CommandMenu),
  { ssr: false },
);

// Code-split and client-only, like the search menu — but mounted as soon as the
// page is, unlike it. The launcher is the affordance that invites the first
// question, so it has to be on screen to be pressed; latching it the way search is
// latched would mean the button that opens the widget only exists once the widget
// is already open. The expensive part is deferred separately: the knowledge
// payload is fetched on first open, not on page load.
const AgentWidget = dynamic(
  () => import('@/components/agent/AgentWidget').then((mod) => mod.AgentWidget),
  { ssr: false },
);

interface ShellProps {
  children: React.ReactNode;
  /** Rendered after `</main>` rather than inside it: a footer is not content. */
  footer?: React.ReactNode;
  profile: { name: string; avatar?: string };
  startupName?: string;
  repoUrl?: string;
  /**
   * The configured default choice (not a cookie: reading one in the root layout
   * opts every route out of static generation). It seeds ThemeToggle's select so a
   * first-time visitor sees "Sepia" selected rather than a "System" that does not
   * describe what is painted. The blocking script already set the palette, and
   * ThemeToggle then syncs itself to `localStorage` if a real preference exists.
   */
  appearance?: AppearanceChoice;
}

export function Shell({ children, footer, profile, startupName, appearance, repoUrl }: ShellProps) {
  const pathname = usePathname();
  const isDirectPage = pathname === '/direct' || pathname.startsWith('/direct');

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const openSearch = useCallback(() => {
    setSearchMounted(true);
    setSearchOpen(true);
  }, []);

  const openAgent = useCallback(() => setAgentOpen(true), []);

  // Close agent widget automatically on route change
  useEffect(() => {
    setAgentOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!portfolioConfig.features.search) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchMounted(true);
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <GitHubBadge repoUrl={repoUrl} />
      <Rail onOpenSearch={openSearch} profile={profile} startupName={startupName} appearance={appearance} repoUrl={repoUrl} />
      <div className="shell__main">
        <main id="main">{children}</main>
        {!isDirectPage && footer}
      </div>
      {portfolioConfig.features.search && searchMounted ? (
        <CommandMenu open={searchOpen} onClose={() => setSearchOpen(false)} />
      ) : null}
      {portfolioConfig.features.agent && !isDirectPage ? (
        <AgentWidget
          open={agentOpen}
          onOpen={openAgent}
          onClose={() => setAgentOpen(false)}
        />
      ) : null}
    </div>
  );
}
