import type { MetadataRoute } from 'next';
import { portfolioConfig } from '@/config/portfolio.config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/edit' },
    sitemap: `${portfolioConfig.site.url}/sitemap.xml`,
  };
}
