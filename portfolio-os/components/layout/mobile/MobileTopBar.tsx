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
        <a
          href="https://github.com/nomi181472/portfolio-os"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.topBtn}
          aria-label="GitHub Repository"
          title="GitHub (nomi181472/portfolio-os)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
        </a>
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
