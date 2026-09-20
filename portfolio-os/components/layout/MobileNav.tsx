'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { CATEGORIES } from '@/lib/categories';
import type { MetaphorMark as MarkName } from '@/lib/categories';
import styles from './MobileNav.module.css';

interface MobileNavProps {
  onOpenSearch: () => void;
  profile: { name: string; avatar?: string };
  startupName?: string;
}

interface Ripple {
  id: string;
  x: number;
  y: number;
}

export function MobileNav({ onOpenSearch, profile, startupName }: MobileNavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const currentDeltaY = useRef<number>(0);
  const drawerBodyRef = useRef<HTMLDivElement>(null);

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
    setDragOffsetY(0);
    setIsDragging(false);
  }, [pathname]);

  // Touch gesture handlers for dragging sheet down
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    currentDeltaY.current = 0;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const currentY = touch.clientY;
    const delta = currentY - touchStartY.current;
    if (delta > 0) {
      currentDeltaY.current = delta;
      setDragOffsetY(delta);
    } else {
      // Rubber-band resistance when pulling up
      const resisted = delta * 0.2;
      currentDeltaY.current = resisted;
      setDragOffsetY(resisted);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const delta = currentDeltaY.current;
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = delta / elapsed; // px per ms

    if (delta > 80 || velocity > 0.45) {
      // Dismiss threshold met
      setDrawerOpen(false);
    }
    setDragOffsetY(0);
    currentDeltaY.current = 0;
  }, []);

  // Ripple feedback for tab touches
  const triggerRipple = useCallback((id: string, e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    setRipples((prev) => [...prev, { id: `${id}-${Date.now()}`, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, 450);
  }, []);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const isCurrent = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const primaryDestinations = [
    { href: '/', label: 'Surface', mark: 'artifact' as MarkName },
    { href: '/experience', label: 'Experience', mark: 'route' as MarkName },
    { href: '/products', label: 'Products', mark: 'artifact' as MarkName },
    { href: '/projects', label: 'Projects', mark: 'experiment' as MarkName },
  ];

  const coreSections = [
    { href: '/experience', label: 'Experience', desc: 'Engineering route', mark: 'route' as MarkName },
    { href: '/products', label: 'Products', desc: 'Artifact vault', mark: 'artifact' as MarkName },
    { href: '/projects', label: 'Projects', desc: 'Lab experiments', mark: 'experiment' as MarkName },
    ...(startupName ? [{ href: '/startup', label: startupName, desc: 'Incubator', mark: 'incubator' as MarkName }] : []),
    { href: '/research', label: 'Research', desc: 'Open enquiries', mark: 'notebook' as MarkName },
    { href: '/skills', label: 'Skills', desc: 'Technical matrix', mark: 'instrument' as MarkName },
    { href: '/awards', label: 'Awards', desc: 'Honors & recognition', mark: 'milestone' as MarkName },
    { href: '/publications', label: 'Publications', desc: 'Citable papers', mark: 'library' as MarkName },
    { href: '/education', label: 'Education', desc: 'Foundations', mark: 'foundation' as MarkName },
    { href: '/future', label: 'Trajectory', desc: 'Roadmap & horizons', mark: 'trajectory' as MarkName },
  ];

  const toolSections = [
    { href: '/copy', label: 'Copy this OS', desc: 'Fork & duplicate', mark: 'copy' as MarkName },
    { href: '/edit', label: 'Visual Editor', desc: 'Local in-browser draft', mark: 'instrument' as MarkName },
    { href: '/explore', label: 'Explore Mode', desc: 'Question-driven map', mark: 'network' as MarkName },
    { href: '/colophon', label: 'Colophon', desc: 'System provenance', mark: 'seal' as MarkName },
  ];

  return (
    <>
      {/* Native Mobile Top Bar */}
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
          <span>PORTFOLIO OS</span>
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
            onClick={() => setDrawerOpen((v) => !v)}
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

      {/* Native Mobile Bottom Tab Bar */}
      <nav className={styles.bottomBar} aria-label="Mobile application navigation">
        {primaryDestinations.map((tab) => {
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
          onClick={() => setDrawerOpen((v) => !v)}
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

      {/* Backdrop */}
      <div
        className={styles.backdrop}
        data-open={drawerOpen}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />

      {/* Slide-up App Drawer Sheet with Touch Gesture Drag-to-Dismiss */}
      <div
        className={styles.drawer}
        data-open={drawerOpen}
        data-dragging={isDragging}
        style={{
          transform: drawerOpen
            ? dragOffsetY !== 0
              ? `translateY(${Math.max(0, dragOffsetY)}px)`
              : undefined
            : undefined,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="App Navigation"
      >
        <div
          className={styles.handleContainer}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className={styles.handleBar} />
        </div>
        <div
          className={styles.drawerHeader}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <span className={styles.drawerTitle}>All Sections & Tools</span>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        <div className={styles.drawerBody} ref={drawerBodyRef}>
          <button
            type="button"
            className={styles.searchLauncher}
            onClick={() => {
              setDrawerOpen(false);
              onOpenSearch();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10.5" cy="10.5" r="6" />
              <path d="M15 15l5 5" strokeLinecap="square" />
            </svg>
            <span>Search anything in portfolio... (Ctrl+K)</span>
          </button>

          <div>
            <div className={styles.categoryGroupTitle}>Collections</div>
            <div className={styles.gridLinks}>
              {coreSections.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.gridCard}
                  data-current={isCurrent(item.href)}
                  onClick={() => setDrawerOpen(false)}
                >
                  <MetaphorMark name={item.mark} size={18} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-dim)' }}>{item.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.categoryGroupTitle}>System & Tools</div>
            <div className={styles.gridLinks}>
              {toolSections.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.gridCard}
                  data-current={isCurrent(item.href)}
                  onClick={() => setDrawerOpen(false)}
                >
                  <MetaphorMark name={item.mark} size={18} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-dim)' }}>{item.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
