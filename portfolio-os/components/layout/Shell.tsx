'use client';

/**
 * The shell wires the rail, the command menu and the editor together. It is the
 * only client boundary in the layout — pages below it stay server-rendered so
 * their content is in the HTML for crawlers and slow connections (§85, §116).
 */
import { useCallback, useEffect, useState } from 'react';
import { Rail } from './Rail';
import { CommandMenu } from '@/components/search/CommandMenu';
import { EditBar } from '@/components/editor/EditBar';
import { portfolioConfig } from '@/config/portfolio.config';
import type { SearchRecord } from '@/lib/search';

interface ShellProps {
  index: SearchRecord[];
  children: React.ReactNode;
  profile: { name: string; avatar?: string };
  startupName?: string;
}

export function Shell({ index, children, profile, startupName }: ShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    if (!portfolioConfig.features.search) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <Rail onOpenSearch={openSearch} profile={profile} startupName={startupName} />
      <div className="shell__main">
        <main id="main">{children}</main>
      </div>
      {portfolioConfig.features.search ? (
        <CommandMenu index={index} open={searchOpen} onClose={() => setSearchOpen(false)} />
      ) : null}
      {portfolioConfig.features.editMode ? <EditBar /> : null}
    </div>
  );
}
