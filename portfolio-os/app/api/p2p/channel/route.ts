/**
 * app/api/p2p/channel/route.ts
 *
 * Provides the public deterministic channel ID for visitors dynamically
 * based on the SQLite portfolio database (`portfolio.db`).
 * Strict adherence to AGENTS.md: zero hardcoded names or email addresses.
 */

import { NextResponse } from 'next/server';
import { getEntity } from '@/lib/database/sqlite';
import { deriveChannelId } from '@/lib/p2p/crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  let name = 'Architect';
  let email = 'contact@example.com';

  try {
    const profileEntity = getEntity('profile');
    if (profileEntity) {
      if (profileEntity.name) {
        name = profileEntity.name;
      }
      if (profileEntity.metadata_json) {
        const metadata = JSON.parse(profileEntity.metadata_json) as {
          email?: string;
        };
        if (metadata.email) {
          email = metadata.email;
        }
      }
    }
  } catch (err) {
    console.warn('[P2P Channel API] Failed to read profile from SQLite, using defaults', err);
  }

  const channelId = await deriveChannelId(email);

  return NextResponse.json({
    channelId,
    ownerName: name,
    emailMasked: email.replace(/(^.{2})(.*)(@.*$)/, '$1***$3'),
  });
}
