import type { Metadata, Viewport } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import '@/styles/globals.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark-dimmed.css';

import { Shell } from '@/components/layout/Shell';
import { Footer } from '@/components/layout/Footer';
import { AdminCorner } from '@/components/layout/AdminCorner';
import { AnalyticsProvider } from '@/components/analytics/Provider';
import { ScrollManager } from '@/components/layout/ScrollManager';
import { EditorProvider } from '@/components/editor/store';
import { getGraph } from '@/lib/source';
import { buildIndex } from '@/lib/search';
import { portfolioConfig } from '@/config/portfolio.config';

/**
 * Inter provides ultra-clean, architectural modern typography across display
 * headings and UI controls. IBM Plex Mono carries technical metadata and telemetry.
 */
const display = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display-loaded', display: 'swap' });
const ui = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ui-loaded', display: 'swap' });
const data = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-data-loaded', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { bundle } = await getGraph();
  const { profile } = bundle.data;
  const fullTitle = profile.discipline ? `${profile.name} — ${profile.discipline}` : (profile.name || portfolioConfig.site.title);
  const title = profile.name || portfolioConfig.site.title;
  const description = profile.positioning ?? portfolioConfig.site.description;

  return {
    metadataBase: new URL(portfolioConfig.site.url),
    title: { default: fullTitle, template: `%s — ${title}` },
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: 'website',
      locale: portfolioConfig.site.locale,
      siteName: title,
      images: profile.avatar ? [{ url: profile.avatar }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: profile.avatar ? [profile.avatar] : undefined,
    },
    alternates: { canonical: '/' },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: title,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#090a0d' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { bundle } = await getGraph();
  const index = buildIndex(bundle.data);

  // The two brand colours are injected from configuration, which is what makes
  // a fork a one-line re-skin rather than a search across stylesheets.
  const brand = `:root{--brand-primary:${portfolioConfig.theme.primary};--brand-secondary:${portfolioConfig.theme.secondary};}`;

  return (
    <html
      lang={portfolioConfig.site.locale}
      data-appearance={portfolioConfig.theme.defaultAppearance === 'system' ? undefined : portfolioConfig.theme.defaultAppearance}
      className={`${display.variable} ${ui.variable} ${data.variable}`}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: brand }} />
      </head>
      <body>
        <ScrollManager />
        <AnalyticsProvider />
        <EditorProvider canonical={bundle.data}>
          <Shell index={index} profile={{ name: bundle.data.profile.name, avatar: bundle.data.profile.avatar }} startupName={bundle.data.startup?.name}>
            {children}
            <div className="page" style={{ paddingTop: 0 }}>
              <Footer profile={bundle.data.profile} source={bundle.source} />
            </div>
          </Shell>
        </EditorProvider>
        <AdminCorner />
      </body>
    </html>
  );
}
