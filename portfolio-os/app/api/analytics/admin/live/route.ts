/**
 * app/api/analytics/admin/live/route.ts
 *
 * Authenticated real-time presence endpoint (§28, §29).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName, verifySessionToken } from '@/lib/analytics/auth';
import { getAnalyticsManager } from '@/lib/analytics/singleton';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(adminCookieName)?.value;
  const authed = verifySessionToken(token);
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const manager = getAnalyticsManager();
  const live = manager.getLive();

  return NextResponse.json(live);
}
