import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';

import { adminCookieName, verifySessionToken } from '@/lib/analytics/auth';
import { LoginForm } from '@/components/analytics/LoginForm';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Ruler } from '@/components/layout/Ruler';

export const metadata: Metadata = {
  title: 'Sign In — Analytics',
  robots: { index: false, follow: false },
};

export default async function AnalyticsLoginPage() {
  const jar = await cookies();
  const email = verifySessionToken(jar.get(adminCookieName)?.value);
  if (email) {
    redirect('/analytics');
  }

  return (
    <div className="page">
      <Breadcrumbs
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Analytics' },
          { label: 'Sign in' },
        ]}
      />
      <Ruler depth={1} label="Authentication" />

      <header
        style={{
          marginTop: 'var(--space-loose)',
          marginBottom: 'var(--space-loose)',
        }}
      >
        <h1
          className="heading"
          style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)' }}
        >
          Analytics Dashboard
        </h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          Private, first-party portfolio telemetry. Credentials are authenticated
          in constant time and never exposed or logged.
        </p>
      </header>

      <LoginForm />
    </div>
  );
}
