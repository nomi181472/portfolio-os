/**
 * lib/analytics/geo.ts
 *
 * IP-derived country, without storing the IP (§20, §21, §45). Resolution is
 * header-driven so it costs nothing and stays lightweight:
 *
 *   x-country-code    (self-hosted proxies: set it yourself)
 *   x-vercel-ip-country (Vercel edge)
 *   cf-ipcountry      (Cloudflare)
 *
 * The result is always coerced to a 2-letter code by normalizeCountry; a VPN,
 * proxy or carrier can only degrade it to another — or unknown — code, which is
 * expected and fine. Country is approximate by design.
 */
import { normalizeCountry } from './registry';

const HEADER_ORDER = ['x-country-code', 'x-vercel-ip-country', 'cf-ipcountry'] as const;

/**
 * Resolve a country code from request headers. Zero network calls, zero memory
 * allocation beyond the header string itself.
 */
export function countryFromHeaders(headers: Headers): string {
  for (const header of HEADER_ORDER) {
    const value = headers.get(header);
    if (value) {
      const resolved = normalizeCountry(value);
      if (resolved !== 'XX') return resolved;
    }
  }
  return 'XX';
}

/** Same-origin host (hostname only, no scheme) used to suppress self-referrers. */
export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}