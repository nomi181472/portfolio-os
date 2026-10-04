'use client';

import Link from 'next/link';
import styles from '../MobileNav.module.css';

interface MobileTopBarProps {
  onOpenSearch: () => void;
  profile: { name: string; avatar?: string };
  onToggleDrawer: () => void;
}

/**
 * Top application bar for mobile views containing the brand, avatar, search, and drawer toggle.
 */
export function MobileTopBar({ onOpenSearch, profile, onToggleDrawer }: MobileTopBarProps) {
  return (
    <header className={styles.topBar} role="banner">
      <Link href="/" className={styles.topBrand}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: '1px solid var(--rule-strong)',
            display: 'inline-flex',
          }}
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--ink-quiet)' }}>{profile.name.charAt(0)}</span>
          )}
        </span>
        {/* "PORTFOLIO OS" is the project's name, not the person's. In the one
            position on a phone screen that is always visible, it should say
            whose work this is. */}
        <span>{profile.name}</span>
      </Link>
      <div className={styles.topActions}>
        <button
          type="button"
          className={styles.topBtn}
          onClick={onOpenSearch}
          aria-label="Search"
          title="Search (Ctrl+K)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l5 5" strokeLinecap="square" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.topBtn}
          onClick={onToggleDrawer}
          aria-label="Toggle Navigation Drawer"
          title="All Sections"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="7" height="7" rx="1.5" />
            <rect x="14" y="4" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </button>
      </div>
    </header>
  );
}
