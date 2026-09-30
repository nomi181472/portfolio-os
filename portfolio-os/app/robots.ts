import type { MetadataRoute } from 'next';
import { portfolioConfig } from '@/config/portfolio.config';

/**
 * Two rules were missing, and both leak in the same way.
 *
 * `/edit` was disallowed, which keeps the crawler out but leaves every preview
 * route reachable through the editor's own links. `/admin` and `/analytics` were
 * not mentioned at all: an authenticated view of your own traffic stats has no
 * business being in an index, and the login page sitting there with a form on it
 * is precisely what a crawler reports as a thin page.
 *
 * `/api` is disallowed for the same reason in miniature — the search endpoint
 * returns a JSON blob that is a duplicate of every page on the site.
 *
 * The editor's noindex in its own segment layout remains the belt to these
 * braces: a meta flag survives a robots.txt that gets edited by accident.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/edit', '/admin', '/analytics', '/api/'],
      },
    ],
    sitemap: `${portfolioConfig.site.url.replace(/\/$/, '')}/sitemap.xml`,
    host: portfolioConfig.site.url.replace(/\/$/, ''),
  };
}
