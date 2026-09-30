/**
 * lib/fonts.ts
 *
 * The font declarations used to sit in `app/layout.tsx`, so any route that
 * imported the layout — or any dependency that pulled it in — paid for the whole
 * type system. They live here so a layout picks the faces it actually renders.
 *
 * Two families, matching the contract in styles/tokens.css: `--font-ui-loaded` and
 * `--font-display-loaded` are the same Inter at different optical weights, and
 * `--font-data-loaded` is IBM Plex Mono. The names carry the `-loaded` suffix
 * because the token layer falls back to a system stack when next/font has not run
 * (during a build with no network, or in a test renderer), and a silently missing
 * webfont should degrade rather than block.
 *
 * `display: 'swap'` keeps text visible during the swap; the weights are pinned to
 * the four actually used so the subset stays small.
 */
import { IBM_Plex_Mono, Inter } from 'next/font/google';

/** Interface: navigation, labels, controls, running text. */
export const ui = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ui-loaded',
});

/*
 * Display is a second Inter instance rather than a shared one because the token
 * layer keeps display and UI as separate slots — a fork that swaps the display
 * face for a serif should change one line, and it should not have to know which
 * component classes the UI face is reused by.
 */
export const display = Inter({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-display-loaded',
});

/** Data: dates, counts, coordinates, telemetry, fine print. */
export const data = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-data-loaded',
});

/** Applied to <html> so all three custom properties are in scope. */
export const fontVariables = `${ui.variable} ${display.variable} ${data.variable}`;
