/**
 * app/layout.tsx — the root shell.
 *
 * Everything that must exist on every page and nothing that needn't. That is a
 * short list: the palette decision, the fonts, the rail, the command palette, the
 * footer. The editor, the search index and the analytics bundle are all absent
 * from here, which is the point.
 */
import type { Metadata, Viewport } from 'next';
import { getGraph } from '@/lib/source';
import { portfolioConfig } from '@/config/portfolio.config';
import { fontVariables } from '@/lib/fonts';
import { absoluteUrl, siteUrl } from '@/lib/seo';
import { APPEARANCE_META, configuredAppearance, type Appearance, type AppearanceChoice } from '@/lib/theme';
import { AppearanceScript } from '@/components/theme/AppearanceScript';
import { Shell } from '@/components/layout/Shell';
import { Footer } from '@/components/layout/Footer';
import { ScrollManager } from '@/components/layout/ScrollManager';
import { AnalyticsProvider } from '@/components/analytics/Provider';
import 'katex/dist/katex.min.css';
import '@/styles/tokens.css';
import '@/styles/globals.css';

/**
 * The metadata the site shares. Per-page `openGraph.images` are set per route:
 * one image referenced from every page reads as carelessness on a profile whose
 * whole argument is that the work differs from page to page.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: portfolioConfig.site.title,
    // `%s` and not a suffix: "Products — Noman Ali" reads; the alternative
    // buries the subject under the same nine words on every tab.
    template: `%s — ${portfolioConfig.site.title.split('—')[0]?.trim() || 'Portfolio OS'}`,
  },
  description: portfolioConfig.site.description,
  applicationName: 'Portfolio OS',
  /*
   * Was `['index', 'follow']`, which overrode a page's own attempt to opt out —
   * the editor can mark a draft noindex, and that flag used to be discarded here.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    siteName: portfolioConfig.site.title,
    locale: portfolioConfig.site.locale.replace('-', '_'),
    url: absoluteUrl('/'),
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { email: false, address: false, telephone: false },
  icons: { icon: '/icon' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  /*
   * The SSR fallback: browsers without JS never run the blocking script, so the
   * single theme-color must match the palette the server rendered — the configured
   * default, not the OS. When JS runs, the script rewrites this meta to the stored
   * or resolved palette before paint.
   */
  themeColor: APPEARANCE_META[configuredAppearance(portfolioConfig.theme.defaultAppearance)].themeColor,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { bundle } = await getGraph();
  const { profile } = bundle.data;

  // The palette the blocking script falls back to when storage is unavailable.
  const configured = portfolioConfig.theme.defaultAppearance;
  const fallback: Appearance = configuredAppearance(configured);
  /*
   * The choice the script seeds when storage holds nothing: the configured
   * default, or `system` when the fork configured one. A stored preference always
   * wins over it at apply time. Note this is a *choice*, not a palette — when the
   * fork configures `system`, first paint still follows the OS.
   */
  const defaultChoice: AppearanceChoice = configured === 'system' ? 'system' : fallback;

  return (
    /*
     * `data-appearance` is rendered server-side so the palette a fork configures is
     * in the first byte and not only after the script runs; the attribute is what
     * styles/tokens.css keys its non-default palettes to. The script still overwrites
     * it from storage before paint, and `suppressHydrationWarning` is here precisely
     * because that overwrite means the client's <html> legitimately differs from the
     * one React rendered.
     */
    <html
      lang={portfolioConfig.site.locale}
      className={fontVariables}
      data-appearance={fallback}
      suppressHydrationWarning
    >
      <head>
        <AppearanceScript fallback={fallback} defaultChoice={defaultChoice} />
      </head>
      <body>
        <ScrollManager />
        {portfolioConfig.features.analytics ? <AnalyticsProvider /> : null}
        <Shell
          profile={{ name: profile.name, avatar: profile.avatar }}
          startupName={bundle.data.startup?.name}
          appearance={defaultChoice}
          footer={<Footer profile={profile} source={bundle.source} />}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
