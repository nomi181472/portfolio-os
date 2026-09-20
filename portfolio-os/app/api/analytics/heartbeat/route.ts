/**
 * app/api/analytics/heartbeat/route.ts
 *
 * Lightweight presence ping (§28). Keeps online visitor counts and active
 * sections accurate. Never throws; returns 204 No Content.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeEvent } from '@/lib/analytics/events';
import { getAnalyticsManager } from '@/lib/analytics/singleton';
import { deploymentId } from '@/lib/analytics/deployment';
import { UUID_RE, sanitizeKey } from '@/lib/analytics/shared';

const HeartbeatSchema = z.object({
  v: z.string().regex(UUID_RE),
  s: z.string().regex(UUID_RE),
  sec: z.string().max(80).optional(),
  p: z.string().max(240).optional(),
  d: z.string().max(64).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    const parsed = HeartbeatSchema.safeParse(raw);
    if (parsed.success) {
      const data = parsed.data;
      const manager = getAnalyticsManager();
      manager.track(
        normalizeEvent(
          {
            v: data.v,
            s: data.s,
            d: data.d ? sanitizeKey(data.d, 40) : deploymentId(),
            t: 'heartbeat',
            ts: Date.now(),
            p: data.p ?? '/',
            sec: data.sec,
          },
          {
            deploymentId: data.d ? sanitizeKey(data.d, 40) : deploymentId(),
            country: 'XX',
            browser: 'other',
            os: 'other',
            device: 'desktop',
          }
        )
      );
    }
  } catch {
    /* non-blocking */
  }
  return new NextResponse(null, { status: 204 });
}
