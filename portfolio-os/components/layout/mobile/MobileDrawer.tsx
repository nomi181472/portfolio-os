'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import type { AppearanceChoice } from '@/lib/theme';
import type { MetaphorMark as MarkName } from '@/lib/categories';
import styles from '../MobileNav.module.css';

interface DrawerSection {
  href: string;
  label: string;
  desc: string;
  mark: MarkName;
}

interface MobileDrawerProps {
  isOpen: boolean;
  isDragging: boolean;
  sheetTranslateY: number;
  onClose: () => void;
  onOpenSearch: () => void;
  appearance: AppearanceChoice;
  coreSections: DrawerSection[];
  toolSections: DrawerSection[];
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

/**
 * A slide-up drawer for mobile views displaying secondary navigation and tools.
 */
export function MobileDrawer({
  isOpen,
  isDragging,
  sheetTranslateY,
  onClose,
  onOpenSearch,
  appearance,
  coreSections,
  toolSections,
  touchHandlers,
}: MobileDrawerProps) {
  const pathname = usePathname();
  const drawerBodyRef = useRef<HTMLDivElement>(null);

  const isCurrent = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={styles.backdrop}
        data-open={isOpen}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Slide-up App Drawer Sheet with Touch Gesture Drag-to-Dismiss */}
      <div
        className={styles.drawer}
        data-open={isOpen}
        data-dragging={isDragging}
        style={{
          transform: isOpen
            ? sheetTranslateY !== 0
              ? `translateY(${sheetTranslateY}px)`
              : undefined
            : undefined,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="App Navigation"
      >
        <div
          className={styles.handleContainer}
          {...touchHandlers}
        >
          <div className={styles.handleBar} />
        </div>
        
        <div
          className={styles.drawerHeader}
          {...touchHandlers}
        >
          <span className={styles.drawerTitle}>All Sections & Tools</span>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={onClose}
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
              onClose();
              onOpenSearch();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10.5" cy="10.5" r="6" />
              <path d="M15 15l5 5" strokeLinecap="square" />
            </svg>
            <span>Search anything in portfolio... (Ctrl+K)</span>
          </button>

          {/* Appearance lives in the drawer rather than the top bar */}
          <div className={styles.appearanceRow}>
            <ThemeToggle initialChoice={appearance} />
          </div>

          <div>
            <div className={styles.categoryGroupTitle}>Collections</div>
            <div className={styles.gridLinks}>
              {coreSections.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.gridCard}
                  data-current={isCurrent(item.href)}
                  onClick={onClose}
                >
                  <MetaphorMark name={item.mark} size={18} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>{item.desc}</div>
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
                  onClick={onClose}
                >
                  <MetaphorMark name={item.mark} size={18} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>{item.desc}</div>
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
