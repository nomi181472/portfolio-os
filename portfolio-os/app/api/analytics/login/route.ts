/**
 * app/api/analytics/login/route.ts
 *
 * Server-side authentication endpoint for the private analytics dashboard (§29).
 * Verifies credentials in constant time, issues HMAC-signed HttpOnly cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminCookieName,
  verifyCredentials,
  issueSessionToken,
  adminLoginEnabled,
} from '@/lib/analytics/auth';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!adminLoginEnabled()) {
    return NextResponse.json(
      { error: 'Admin authentication is not configured on this instance.' },
      { status: 403 }
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password format.' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const ok = verifyCredentials(email, password);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const { token, expiresAt } = issueSessionToken(email);
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: adminCookieName,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    path: '/',
  });

  return response;
}
