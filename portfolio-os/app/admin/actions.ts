'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import {
  adminCredentials,
  adminCookieName,
  issueSessionToken,
  verifyCredentials,
} from '@/lib/analytics/auth';

export type LoginState =
  | { status: 'idle' }
  | { status: 'needs-credentials'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'success';
  message: string };

export async function loginAction(
  prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const creds = adminCredentials();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!creds) {
    return {
      status: 'needs-credentials',
      message: 'Admin credentials are not configured (ANALYTICS_ADMIN_EMAIL / ANALYTICS_ADMIN_PASSWORD).',
    };
  }

  if (!verifyCredentials(email, password)) {
    return { status: 'invalid', message: 'Invalid email or password.' };
  }

  const { token } = issueSessionToken(email);
  const secure = process.env.NODE_ENV === 'production';
  const jar = await cookies();
  jar.set(adminCookieName, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  redirect('/admin/dashboard');
}

export async function logoutAction(): Promise<void> {
  const secure = process.env.NODE_ENV === 'production';
  const jar = await cookies();
  jar.delete(adminCookieName);
  redirect('/admin');
}
