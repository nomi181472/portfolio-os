/**
 * app/api/analytics/admin/timeseries/route.ts
 *
 * Authenticated timeseries endpoint for dashboard graphs (§29, §33).
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

  const searchParams = request.nextUrl.searchParams;
  const deploymentId = searchParams.get('deploymentId') || undefined;
  const granularity = (searchParams.get('granularity') as 'hour' | 'day') || 'day';
  const from = searchParams.get('from') ? Number(searchParams.get('from')) : undefined;
  const to = searchParams.get('to') ? Number(searchParams.get('to')) : undefined;

  const manager = getAnalyticsManager();
  const timeseries = manager.getTimeseries({
    deploymentId,
    granularity,
    from,
    to,
  });

  return NextResponse.json({ timeseries });
}
