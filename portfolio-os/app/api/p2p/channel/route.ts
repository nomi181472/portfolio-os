/**
 * app/api/p2p/channel/route.ts
 *
 * Provides the public deterministic channel ID for visitors dynamically.
 * Follows universal multi-tier fallback:
 * 1. Environment variable override (P2P_HOST_EMAIL / P2P_HOST_NAME)
 * 2. SQLite portfolio database (portfolio.db -> getEntity('profile'))
 * 3. Structured content source (content/portfolio.json via getPortfolio())
 * Strict adherence to AGENTS.md: zero hardcoded names or email addresses.
 */

import { NextResponse } from 'next/server';
import { getEntity } from '@/lib/database/sqlite';
import { getPortfolio } from '@/lib/source';
import { deriveChannelId } from '@/lib/p2p/crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  let name = process.env.P2P_HOST_NAME || '';
  let email = process.env.P2P_HOST_EMAIL || '';

  // 1. Try SQLite repository if email or name is not provided in env
  if (!email || !name) {
    try {
      const profileEntity = getEntity('profile');
      if (profileEntity) {
        if (!name && profileEntity.name) {
          name = profileEntity.name;
        }
        if (!email && profileEntity.metadata_json) {
          const metadata = JSON.parse(profileEntity.metadata_json) as {
            email?: string;
          };
          if (metadata.email) {
            email = metadata.email;
          }
        }
      }
    } catch {
      // SQLite may be unavailable on immutable/serverless runtime without bundled DB
    }
  }

  // 2. Try bundled/dynamic Portfolio JSON source (always available)
  if (!email || !name) {
    try {
      const bundle = await getPortfolio();
      const profile = bundle.data.profile as unknown as {
        name?: string;
        email?: string;
        links?: Array<{ type?: string; url?: string }>;
      };

      if (!name && profile?.name) {
        name = profile.name;
      }
      if (!email && profile) {
        if (profile.email) {
          email = profile.email;
        } else if (Array.isArray(profile.links)) {
          const mailLink = profile.links.find(
            (l) => (l.url && l.url.startsWith('mailto:')) || l.type === 'contact'
          );
          if (mailLink && mailLink.url) {
            const extracted = mailLink.url.replace(/^mailto:/i, '').split('?')[0];
            if (extracted) {
              email = extracted;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[P2P Channel API] Failed to load portfolio bundle', err);
    }
  }

  // Safe universal fallbacks if profile has no name/email configured
  if (!name) name = 'Portfolio Owner';
  if (!email) email = 'owner@example.com';

  const channelId = await deriveChannelId(email);

  return NextResponse.json({
    channelId,
    ownerName: name,
    emailMasked: email.replace(/(^.{2})(.*)(@.*$)/, '$1***$3'),
  });
}
