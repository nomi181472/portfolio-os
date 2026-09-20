/**
 * app/api/analytics/admin/summary/route.ts
 *
 * Authenticated summary endpoint for dashboard data (§29, §32).
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
  const from = searchParams.get('from') ? Number(searchParams.get('from')) : undefined;
  const to = searchParams.get('to') ? Number(searchParams.get('to')) : undefined;
  const section = searchParams.get('section') || undefined;

  const manager = getAnalyticsManager();
  const summary = manager.getSummary({
    deploymentId,
    from,
    to,
    section,
  });

  const deployments = manager.getDeployments();

  return NextResponse.json({ summary, deployments });
}
