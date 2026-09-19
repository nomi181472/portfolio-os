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
    url: 'https://example.com',
    title: 'Noman Ali — Solutions Architect & Technical Lead',
    description:
      'Solutions Architect with 5+ years of experience designing and engineering high-throughput, low-latency distributed systems using polyglot microservices (Go, C#, Python) and cloud-native Kubernetes platforms. Skilled at decomposing legacy monoliths into scalable, multi-tenant architectures and modernizing enterprise systems for demanding real-time workloads, with a focus on reliability, performance, and scalability.',
    locale: 'en',
  },

  // Switch to { type: 'remote', url: 'https://raw.githubusercontent.com/…' }
  // to serve content from a public JSON file you control.
  dataSource: { type: 'local' },

  theme: {
    // Petrol ink. Reads as instrument housing and deep water rather than "dark mode".
    primary: 'oklch(0.205 0.034 218)',
    // Brass. An instrument marking, not a highlighter. Used sparingly, on purpose.
    secondary: 'oklch(0.765 0.108 78)',
    defaultAppearance: 'dark',
  },

  features: {
    editMode: true,
    search: true,
    graph: true,
    exampleNotice: false,
  },

  navigation: {
    primary: ['experience', 'products', 'projects', 'startup', 'research', 'skills', 'awards'],
    secondary: ['publications', 'education', 'leadership', 'certifications', 'volunteering', 'languages'],
  },
};
