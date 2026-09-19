import type { Metadata, Viewport } from 'next';
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import '@/styles/globals.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark-dimmed.css';

import { Shell } from '@/components/layout/Shell';
import { Footer } from '@/components/layout/Footer';
import { EditorProvider } from '@/components/editor/store';
import { getGraph } from '@/lib/source';
import { buildIndex } from '@/lib/search';
import { portfolioConfig } from '@/config/portfolio.config';

/**
 * Newsreader carries display and long-form reading: it is a text serif with
 * optical sizing, which is what a technical library and a laboratory notebook
 * both want. IBM Plex Sans runs the interface — it was drawn for an engineering
 * company and reads as instrumentation rather than as a product landing page.
 * Plex Mono appears only where something genuinely is data.
 */
const display = Newsreader({ subsets: ['latin'], variable: '--font-display-loaded', display: 'swap', axes: ['opsz'] });
const ui = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ui-loaded', display: 'swap' });
const data = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-data-loaded', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { bundle } = await getGraph();
  const { profile } = bundle.data;
  const title = profile.name || portfolioConfig.site.title;
  const description = profile.positioning ?? portfolioConfig.site.description;

  return {
    metadataBase: new URL(portfolioConfig.site.url),
    title: { default: title, template: `%s — ${title}` },
    description,
    openGraph: {
      title,
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
    { media: '(prefers-color-scheme: dark)', color: '#0e1a1f' },
    { media: '(prefers-color-scheme: light)', color: '#f2f5f5' },
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
        <EditorProvider canonical={bundle.data}>
          <Shell index={index}>
            {children}
            <div className="page" style={{ paddingTop: 0 }}>
              <Footer profile={bundle.data.profile} source={bundle.source} />
            </div>
          </Shell>
        </EditorProvider>
      </body>
    </html>
  );
}
