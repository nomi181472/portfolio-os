/**
 * components/theme/AppearanceProvider.tsx
 *
 * Root state management provider for appearance (themes).
 * Guarantees that any appearance change instantly updates all subscribed components,
 * all ThemeToggle instances across desktop and mobile, document attributes, meta tags,
 * and localStorage, keeping all states completely synchronized.
 */
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  APPEARANCE_COOKIE,
  APPEARANCE_COOKIE_MAX_AGE,
  APPEARANCE_STORAGE_KEY,
  THEME_COLORS,
  isAppearanceChoice,
  resolveAppearance,
  type Appearance,
  type AppearanceChoice,
} from '@/lib/theme';

export interface AppearanceContextValue {
  choice: AppearanceChoice;
  appearance: Appearance;
  setChoice: (choice: AppearanceChoice) => void;
  setAppearance: (choice: AppearanceChoice) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

export function AppearanceProvider({
  children,
  defaultChoice = 'system',
  fallback = 'dark',
}: {
  children: React.ReactNode;
  defaultChoice?: AppearanceChoice;
  fallback?: Appearance;
}) {
  const [choice, setChoiceState] = useState<AppearanceChoice>(defaultChoice);
  const [appearance, setAppearanceState] = useState<Appearance>(fallback);

  // Synchronize on mount and apply listeners
  useEffect(() => {
    let activeChoice = defaultChoice;
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (isAppearanceChoice(stored)) {
        activeChoice = stored;
      } else {
        const domChoice = document.documentElement.getAttribute('data-appearance-choice');
        if (isAppearanceChoice(domChoice)) {
          activeChoice = domChoice;
        }
      }
    } catch {
      // Storage unavailable
    }

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isMoreContrast = window.matchMedia('(prefers-contrast: more)').matches;
    const resolved = resolveAppearance(activeChoice, isDark, isMoreContrast);

    setChoiceState(activeChoice);
    setAppearanceState(resolved);

    // Apply to DOM in case it wasn't stamped yet
    const root = document.documentElement;
    root.setAttribute('data-appearance', resolved);
    root.setAttribute('data-appearance-choice', activeChoice);
    root.setAttribute('data-appearance-applied', '');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
  }, [defaultChoice, fallback]);

  // Handler to apply changes across DOM, storage, cookie, and state
  const setChoice = useCallback((next: AppearanceChoice) => {
    setChoiceState(next);

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isMoreContrast = window.matchMedia('(prefers-contrast: more)').matches;
    const resolved = resolveAppearance(next, isDark, isMoreContrast);

    setAppearanceState(resolved);

    const root = document.documentElement;
    root.setAttribute('data-appearance', resolved);
    root.setAttribute('data-appearance-choice', next);
    root.setAttribute('data-appearance-applied', '');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);

    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // Storage blocked
    }

    document.cookie = `${APPEARANCE_COOKIE}=${next}; path=/; max-age=${APPEARANCE_COOKIE_MAX_AGE}; SameSite=Lax`;

    // Dispatch custom event for any listeners outside React
    window.dispatchEvent(
      new CustomEvent('portfolio-appearance-change', {
        detail: { choice: next, resolved },
      })
    );
  }, []);

  // Sync across tabs via window storage event
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY && isAppearanceChoice(event.newValue)) {
        setChoice(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setChoice]);

  // Follow the OS while choice is `system` (including when day turns to dusk)
  useEffect(() => {
    if (choice !== 'system') return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const contrast = window.matchMedia('(prefers-contrast: more)');
    const sync = () => setChoice('system');
    dark.addEventListener('change', sync);
    contrast.addEventListener('change', sync);
    return () => {
      dark.removeEventListener('change', sync);
      contrast.removeEventListener('change', sync);
    };
  }, [choice, setChoice]);

  const value = useMemo(
    () => ({
      choice,
      appearance,
      setChoice,
      setAppearance: setChoice,
    }),
    [choice, appearance, setChoice]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    return {
      choice: 'system',
      appearance: 'dark',
      setChoice: () => {},
      setAppearance: () => {},
    };
  }
  return context;
}
