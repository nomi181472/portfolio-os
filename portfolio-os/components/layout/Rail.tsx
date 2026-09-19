'use client';

/**
 * The instrument rail (§12). Always present, never scrolls away, and wide
 * enough for a mark but not for a nav label until you ask for one. Expanding it
 * is an action you take, so it never moves on its own while you are reading.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CATEGORIES } from '@/lib/categories';
import { portfolioConfig } from '@/config/portfolio.config';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { MobileNav } from './MobileNav';
import type { MetaphorMark as MarkName } from '@/lib/categories';
import styles from './Rail.module.css';

interface RailItem { href: string; label: string; mark: MarkName }

function itemsFor(ids: string[], startupName?: string): RailItem[] {
  return ids.flatMap((id) => {
    if (id === 'copy') return [{ href: '/copy', label: 'Copy this OS', mark: 'copy' as MarkName }];
    if (id === 'future') return [{ href: '/future', label: 'Trajectory', mark: 'trajectory' as MarkName }];
    if (id === 'startup') return [{ href: '/startup', label: startupName || 'Startup', mark: 'incubator' as MarkName }];
    const category = CATEGORIES[id as keyof typeof CATEGORIES];
    if (!category) return [];
    return [{ href: `/${category.kind}`, label: category.label, mark: category.mark }];
  });
}

export function Rail({ onOpenSearch, profile, startupName }: { onOpenSearch: () => void; profile: { name: string; avatar?: string }; startupName?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('portfolio-os:sidebar-open');
      if (saved !== null) {
        setOpen(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggle = () => {
    setOpen((value) => {
      const next = !value;
      try {
        localStorage.setItem('portfolio-os:sidebar-open', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const primary = itemsFor(portfolioConfig.navigation.primary, startupName);
  const secondary = itemsFor(
    [...portfolioConfig.navigation.secondary, 'startup', 'future', 'copy'].filter(
      (id) => !portfolioConfig.navigation.primary.includes(id),
    ),
    startupName,
  );

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
    <nav className={styles.rail} data-open={open} aria-label="Sections">
      <Link href="/" className={styles.home} aria-label="Surface" aria-current={pathname === '/' ? 'page' : undefined}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: pathname === '/' ? '2px solid var(--signal)' : '1px solid var(--rule-strong)',
            display: 'inline-flex',
          }}
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--ink-quiet)' }}>{profile.name.charAt(0)}</span>
          )}
        </span>
        <span className={styles.itemLabel}>Surface</span>
      </Link>

      <button type="button" className={styles.item} onClick={onOpenSearch} aria-keyshortcuts="Meta+K Control+K">
        <span className={styles.itemMark} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l5 5" strokeLinecap="square" />
          </svg>
        </span>
        <span className={styles.itemLabel}>Find anything</span>
      </button>

      <ul className={styles.group}>
        {primary.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={styles.item} data-current={isCurrent(item.href)} aria-current={isCurrent(item.href) ? 'page' : undefined}>
              <span className={styles.itemMark}><MetaphorMark name={item.mark} /></span>
              <span className={styles.itemLabel}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className={styles.group} data-tier="secondary">
        {secondary.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={styles.item} data-current={isCurrent(item.href)} aria-current={isCurrent(item.href) ? 'page' : undefined}>
              <span className={styles.itemMark}><MetaphorMark name={item.mark} /></span>
              <span className={styles.itemLabel}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <button type="button" className={styles.expand} onClick={handleToggle} aria-expanded={open}>
        <span className={styles.itemMark} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
            <path d={open ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6'} strokeLinecap="square" />
          </svg>
        </span>
        <span className={styles.itemLabel}>{open ? 'Collapse' : 'Show names'}</span>
      </button>
    </nav>
    <MobileNav onOpenSearch={onOpenSearch} profile={profile} startupName={startupName} />
    </>
  );
}
