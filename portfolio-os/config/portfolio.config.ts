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
    /** 'dark' | 'light' | 'system' */
    defaultAppearance: 'dark' | 'light' | 'system';
  };
  features: {
    editMode: boolean;
    search: boolean;
    graph: boolean;
    analytics: boolean;
    /** Show the banner explaining that shipped content is a sample. */
    exampleNotice: boolean;
  };
  navigation: {
    /** Order of the rail. Any category id, plus 'explore' | 'startup' | 'future'. */
    primary: string[];
    secondary: string[];
  };
}

export const portfolioConfig: PortfolioConfig = {
  site: {
    url: 'https://nomanali.online',
    title: 'Noman Ali — Solutions Architecture & Distributed Systems',
    description: 'Software Engineer & Solutions Architect with 5+ years of experience engineering high-throughput, low-latency distributed systems, polyglot microservices, and cloud-native platforms.',
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
    defaultAppearance: 'dark',
  },

  features: {
    editMode: true,
    search: true,
    graph: true,
    analytics: true,
    exampleNotice: false,
  },

  navigation: {
    primary: ['experience', 'products', 'projects', 'startup', 'research', 'skills', 'awards'],
    secondary: ['publications', 'education', 'leadership', 'certifications', 'volunteering', 'languages'],
  },
};
