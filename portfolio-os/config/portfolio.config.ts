/**
 * config/portfolio.config.ts
 *
 * Configuration, not content (§71, §72). Everything here describes the
 * *instance* — where data comes from, what the site is called, which features
 * are on, what the two brand colours are. Nothing about the person lives here;
 * that is portfolio.json.
 *
 * A fork should need to edit this file and portfolio.json, and nothing else.
 */

export interface PortfolioConfig {
  site: {
    /** Used for canonical URLs, sitemap, and Open Graph. No trailing slash. */
    url: string;
    /** Browser tab and social card prefix. Usually the person's name. */
    title: string;
    description: string;
    locale: string;
  };
  dataSource:
    | { type: 'local' }
    | { type: 'remote'; url: string };
  theme: {
    /**
     * Two colours. Everything else in the interface is derived from these by
     * luminance, transparency and compositing — no third brand hue exists.
     * Replace these two values and the whole system re-skins coherently.
     *
     * primary   the substrate: surfaces, text ramp, rules, depth
     * secondary the signal: state, focus, current position, annotation
     */
    primary: string;
    secondary: string;
    defaultAppearance: 'dark' | 'light' | 'system' | 'contrast' | 'sepia';
  };
  features: {
    editMode: boolean;
    search: boolean;
    graph: boolean;
    analytics: boolean;
    /** The portfolio chat. Answers from the content file; no model required. */
    agent: boolean;
    /** Show the banner explaining that shipped content is a sample. */
    exampleNotice: boolean;
  };
  navigation: {
    /** Order of the rail. Any category id, plus 'explore' | 'startup' | 'future'. */
    primary: string[];
    secondary: string[];
  };
}

import portfolioData from '@/content/portfolio.json';

const profileName = portfolioData.profile?.name ?? 'Portfolio OS';
const profileDiscipline = portfolioData.profile?.discipline;
const profilePositioning = portfolioData.profile?.positioning;
const livePortfolioLink = portfolioData.profile?.links?.find(
  (l: { label?: string; url?: string }) => l.label?.toLowerCase().includes('live portfolio')
)?.url;

export const portfolioConfig: PortfolioConfig = {
  site: {
    url: process.env.NEXT_PUBLIC_SITE_URL || livePortfolioLink || 'https://example.com',
    title: profileDiscipline ? `${profileName} — ${profileDiscipline}` : profileName,
    description:
      profilePositioning ||
      'Portfolio OS — A forkable, data-driven personal technology operating system.',
    locale: 'en',
  },

  // Switch to { type: 'remote', url: 'https://raw.githubusercontent.com/…' }
  // to serve content from a public JSON file you control.
  dataSource: { type: 'local' },

  theme: {
    // Obsidian substrate. Deep, architectural black tone.
    primary: 'oklch(0.12 0.005 260)',
    // Crisp Silver / Luminescent White. Clear, high-contrast signal.
    secondary: 'oklch(0.98 0.002 260)',
    // Warm reading surface first: new visitors land on sepia, not obsidian.
    defaultAppearance: 'sepia',
  },

  features: {
    editMode: true,
    search: true,
    graph: true,
    analytics: true,
    agent: true,
    exampleNotice: false,
  },

  navigation: {
    primary: ['experience', 'products', 'projects', 'startup', 'research', 'skills', 'awards'],
    secondary: ['publications', 'education', 'leadership', 'certifications', 'volunteering', 'languages'],
  },
};
