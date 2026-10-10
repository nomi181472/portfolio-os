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
 * Consumes the root AppearanceProvider context so all ThemeToggle instances
 * (sidebar rail, mobile drawer) and all UI components stay completely in sync.
 */
'use client';

import { useId } from 'react';
import {
  APPEARANCE_CHOICES,
  APPEARANCE_META,
  type AppearanceChoice,
} from '@/lib/theme';
import { useAppearance } from './AppearanceProvider';
import styles from './ThemeToggle.module.css';

export function ThemeToggle({
  compact = false,
}: {
  /** Legacy prop kept for backward compatibility */
  initialChoice?: AppearanceChoice;
  /** Icon-only rendering, for the collapsed rail. */
  compact?: boolean;
}) {
  const { choice, setChoice } = useAppearance();
  const id = useId();

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
        onChange={(event) => setChoice(event.target.value as AppearanceChoice)}
        title={APPEARANCE_META[choice]?.hint || 'Appearance'}
      >
        {APPEARANCE_CHOICES.map((option) => (
          <option key={option} value={option}>
            {APPEARANCE_META[option]?.label || option}
          </option>
        ))}
      </select>
    </div>
  );
}
