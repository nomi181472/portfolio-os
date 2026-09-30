/**
 * components/theme/ThemeToggle.tsx
 *
 * A native `select`, on purpose. The alternative — a button with a custom popover
 * — needs focus trapping, arrow-key roving, click-outside handling and four
 * `aria` attributes to reach the accessibility a `<select>` has for free, and this
 * is a preference control, not the subject of the page. It is also the one widget
 * on the site that has to work identically on a phone, a keyboard and a switch
 * device, which is exactly what the platform control already does.
 *
 * State lives in two places that have to agree: the `data-appearance` attribute on
 * <html> (what is painted) and `localStorage` (the durable preference, read before
 * paint by the blocking script in the head). A cookie is written as well and read by
 * nothing in this codebase — see the note at the top of `lib/theme.ts`. It is here so
 * a fork that decides the first byte should carry the saved palette has one to read,
 * and so that decision costs one call instead of a migration.
 */
'use client';

import { useEffect, useId, useState } from 'react';
import {
  APPEARANCE_CHOICES,
  APPEARANCE_COOKIE,
  APPEARANCE_COOKIE_MAX_AGE,
  APPEARANCE_META,
  APPEARANCE_STORAGE_KEY,
  THEME_COLORS,
  isAppearanceChoice,
  resolveAppearance,
  type AppearanceChoice,
} from '@/lib/theme';
import styles from './ThemeToggle.module.css';

export function ThemeToggle({
  initialChoice = 'system',
  compact = false,
}: {
  /*
   * The preference the device already holds. Nothing in this codebase passes it —
   * the layout stays static — so the mount-time read below is load-bearing.
   */
  initialChoice?: AppearanceChoice;
  /** Icon-only rendering, for the collapsed rail. */
  compact?: boolean;
}) {
  const [choice, setChoice] = useState<AppearanceChoice>(initialChoice);
  const id = useId();

  /*
   * The server sees the cookie; this device may hold a preference in
   * localStorage that has not been sent yet — a second tab, or a cookie that
   * expired. The blocking script has already painted the right palette, so React
   * is synced to what the DOM ended up with rather than to what was rendered.
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (isAppearanceChoice(stored)) setChoice(stored);
      /*
       * Deliberately no seeding when storage is empty. Writing a value here (it
       * used to write `'system'`) pins the *site default* out of existence: the
       * next load would read that stored 'system' and follow the OS instead of the
       * configured palette, so the site would silently stop being what its config
       * says it is after one visit. Empty storage simply means "no opinion yet",
       * which is exactly the state the blocking script resolves the default from.
       */
    } catch {
      // Storage blocked (private mode, strict sites). The toggle still works for
      // this page load; it just cannot be remembered, and saying so out loud
      // would be noise for someone who cannot act on it.
    }
  }, []);

  const apply = (next: AppearanceChoice) => {
    setChoice(next);
    const root = document.documentElement;
    const resolved = resolveAppearance(
      next,
      window.matchMedia('(prefers-color-scheme: dark)').matches,
      window.matchMedia('(prefers-contrast: more)').matches,
    );
    root.setAttribute('data-appearance', resolved);
    root.setAttribute('data-appearance-choice', next);
    root.setAttribute('data-appearance-applied', '');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);

    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // Ignored for the reason above.
    }
    // SameSite=Lax: it is read on this site's own navigations, which is all it is
    // for. It is not HttpOnly because the client above is its only legitimate
    // writer, and making it unreadable there would break the toggle.
    document.cookie = `${APPEARANCE_COOKIE}=${next}; path=/; max-age=${APPEARANCE_COOKIE_MAX_AGE}; SameSite=Lax`;
  };

  // Follow the OS while the choice is `system`, including when it changes at dusk.
  useEffect(() => {
    if (choice !== 'system') return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const contrast = window.matchMedia('(prefers-contrast: more)');
    const sync = () => apply('system');
    dark.addEventListener('change', sync);
    contrast.addEventListener('change', sync);
    return () => {
      dark.removeEventListener('change', sync);
      contrast.removeEventListener('change', sync);
    };
    // apply is stable enough for this purpose and re-subscribing on every render
    // would leak listeners on a control that is mounted for the whole visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

  return (
    <div className={styles.wrap} data-compact={compact || undefined}>
      <label className={styles.label} htmlFor={id}>
        <svg className={styles.glyph} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle cx="12" cy="12" r="5.2" />
          <path d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.4 5.4L7 7M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" strokeLinecap="round" />
        </svg>
        <span className={compact ? styles.srOnly : undefined}>Appearance</span>
      </label>
      <select
        id={id}
        className={styles.select}
        value={choice}
        onChange={(event) => apply(event.target.value as AppearanceChoice)}
        title={APPEARANCE_META[choice].hint}
      >
        {APPEARANCE_CHOICES.map((option) => (
          <option key={option} value={option}>
            {APPEARANCE_META[option].label}
          </option>
        ))}
      </select>
    </div>
  );
}
