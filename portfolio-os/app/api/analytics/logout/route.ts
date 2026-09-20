/**
 * app/api/analytics/logout/route.ts
 *
 * Clears the admin session cookie and redirects to login (§29).
 */
import { NextResponse } from 'next/server';
import { adminCookieName } from '@/lib/analytics/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete({
    name: adminCookieName,
    path: '/',
  });
  return response;
}
