'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { AppearanceChoice } from '@/lib/theme';
import type { MetaphorMark as MarkName } from '@/lib/categories';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { MobileTopBar } from './mobile/MobileTopBar';
import { MobileBottomBar } from './mobile/MobileBottomBar';
import { MobileDrawer } from './mobile/MobileDrawer';

interface MobileNavProps {
  onOpenSearch: () => void;
  profile: { name: string; avatar?: string };
  startupName?: string;
  appearance?: AppearanceChoice;
}

export function MobileNav({ onOpenSearch, profile, startupName, appearance = 'system' }: MobileNavProps) {
  const pathname = usePathname();
  const { sheetTranslateY, isDragging, isOpen, toggle, close, touchHandlers } = useSwipeGesture();

  // Close drawer on navigation
  useEffect(() => {
    close();
  }, [pathname, close]);

  /*
   * The nav used the site's own vocabulary — "Surface", "Artifact vault",
   * "Incubator", "Technical matrix", "Question-driven map". None of it is
   * self-explanatory, and a nav label has to be. The metaphor survives where it is
   * *explained* (each section page opens by defining it); it is dropped here,
   * where someone is only trying to decide what to tap. Plain words also happen to
   * be the words a person would type into a search engine.
   */
  const primaryDestinations = [
    { href: '/', label: 'About', mark: 'artifact' as MarkName },
    { href: '/experience', label: 'Experience', mark: 'route' as MarkName },
    { href: '/products', label: 'Products', mark: 'artifact' as MarkName },
    { href: '/projects', label: 'Projects', mark: 'experiment' as MarkName },
  ];

  const coreSections = [
    { href: '/experience', label: 'Experience', desc: 'Where I worked, and what changed', mark: 'route' as MarkName },
    { href: '/products', label: 'Products', desc: 'Products built and shipped', mark: 'artifact' as MarkName },
    { href: '/projects', label: 'Projects', desc: 'Things built to find something out', mark: 'experiment' as MarkName },
    ...(startupName ? [{ href: '/startup', label: startupName, desc: 'The company being built now', mark: 'incubator' as MarkName }] : []),
    { href: '/research', label: 'Research', desc: 'Open questions under investigation', mark: 'notebook' as MarkName },
    { href: '/skills', label: 'Skills', desc: 'Technologies, with evidence of use', mark: 'instrument' as MarkName },
    { href: '/awards', label: 'Awards', desc: 'Honours and recognition', mark: 'milestone' as MarkName },
    { href: '/publications', label: 'Publications', desc: 'Papers and citable writing', mark: 'library' as MarkName },
    { href: '/education', label: 'Education', desc: 'Degrees and formal study', mark: 'foundation' as MarkName },
    { href: '/future', label: 'Trajectory', desc: 'What happens next, by how certain it is', mark: 'trajectory' as MarkName },
  ];

  const toolSections = [
    { href: '/explore', label: 'Browse by question', desc: 'Start from what you want to know', mark: 'network' as MarkName },
    { href: '/edit', label: 'Edit this portfolio', desc: 'Draft in your browser, then export', mark: 'instrument' as MarkName },
    { href: '/copy', label: 'Copy this site', desc: 'Fork it and make it your own', mark: 'copy' as MarkName },
    { href: '/colophon', label: 'Colophon', desc: 'How this site is built', mark: 'seal' as MarkName },
  ];

  return (
    <>
      <MobileTopBar 
        profile={profile}
        onOpenSearch={onOpenSearch}
        onToggleDrawer={toggle}
      />
      
      <MobileBottomBar
        destinations={primaryDestinations}
        drawerOpen={isOpen}
        onToggleDrawer={toggle}
      />
      
      <MobileDrawer
        isOpen={isOpen}
        isDragging={isDragging}
        sheetTranslateY={sheetTranslateY}
        onClose={close}
        onOpenSearch={onOpenSearch}
        appearance={appearance}
        coreSections={coreSections}
        toolSections={toolSections}
        touchHandlers={touchHandlers}
      />
    </>
  );
}
