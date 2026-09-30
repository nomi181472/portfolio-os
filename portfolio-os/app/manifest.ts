/**
 * app/manifest.ts — the web app manifest.
 *
 * There was none, which cost the site two things: `display` falls back to
 * `browser`, so an added-to-home-screen shortcut opens with a URL bar over the
 * rail, and Android has no icon to install. The theme colours are the ones in
 * styles/tokens.css, repeated here because a manifest is read by a process that
 * cannot see the stylesheet.
 */
import type { MetadataRoute } from 'next';
import { portfolioConfig } from '@/config/portfolio.config';
import { APPEARANCE_META, configuredAppearance } from '@/lib/theme';

export default function manifest(): MetadataRoute.Manifest {
  // The splash-screen palette an installed shortcut opens with: the configured
  // default, so it matches the first paint rather than a hard-coded dark.
  const themeColor = APPEARANCE_META[configuredAppearance(portfolioConfig.theme.defaultAppearance)].themeColor;
  return {
    name: portfolioConfig.site.title,
    short_name: portfolioConfig.site.title.split('—')[0]?.trim() || 'Portfolio OS',
    description: portfolioConfig.site.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: themeColor,
    theme_color: themeColor,
    lang: portfolioConfig.site.locale,
    categories: ['portfolio', 'productivity', 'utilities'],
    // The SVG icon covers everything modern; the PNG sizes are for clients that
    // still refuse SVG in a manifest (older Samsung Internet, some launchers).
    icons: [
      { src: '/icon', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
