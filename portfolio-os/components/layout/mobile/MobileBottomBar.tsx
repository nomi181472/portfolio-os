'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import type { MetaphorMark as MarkName } from '@/lib/categories';
import { useRipple } from '@/hooks/useRipple';
import styles from '../MobileNav.module.css';

interface PrimaryDestination {
  href: string;
  label: string;
  mark: MarkName;
}

interface MobileBottomBarProps {
  destinations: PrimaryDestination[];
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

/**
 * Bottom tab bar navigation for mobile views.
 */
export function MobileBottomBar({ destinations, drawerOpen, onToggleDrawer }: MobileBottomBarProps) {
  const pathname = usePathname();
  const { ripples, triggerRipple } = useRipple();

  const isCurrent = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className={styles.bottomBar} aria-label="Mobile application navigation">
      {destinations.map((tab) => {
        const active = isCurrent(tab.href);
        const tabRipples = ripples.filter((r) => r.id.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tabItem}
            data-active={active}
            aria-current={active ? 'page' : undefined}
            onTouchStart={(e) => triggerRipple(tab.href, e)}
          >
            {tabRipples.map((r) => (
              <span key={r.id} className={styles.tabRipple} style={{ left: r.x, top: r.y }} />
            ))}
            <span className={styles.tabIcon}>
              <MetaphorMark name={tab.mark} size={18} />
            </span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}

      {/* 5th Tab: Menu Drawer Toggle */}
      <button
        type="button"
        className={styles.tabItem}
        data-active={drawerOpen}
        onClick={onToggleDrawer}
        onTouchStart={(e) => triggerRipple('menu-tab', e)}
        aria-label="Open App Menu"
      >
        {ripples.filter((r) => r.id.startsWith('menu-tab')).map((r) => (
          <span key={r.id} className={styles.tabRipple} style={{ left: r.x, top: r.y }} />
        ))}
        <span className={styles.tabIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
            <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
            <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
          </svg>
        </span>
        <span className={styles.tabLabel}>Menu</span>
      </button>
    </nav>
  );
}
