import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';

import { adminCookieName, verifySessionToken } from '@/lib/analytics/auth';
import { getAnalyticsManager } from '@/lib/analytics/singleton';
import { AnalyticsDashboard } from '@/components/analytics/Dashboard';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Ruler } from '@/components/layout/Ruler';

export const metadata: Metadata = {
  title: 'Analytics Dashboard',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const jar = await cookies();
  const token = jar.get(adminCookieName)?.value;
  const email = verifySessionToken(token);

  if (!email) {
    redirect('/analytics/login');
  }

  const manager = getAnalyticsManager();
  const deployments = manager.getDeployments();
  const currentDep = deployments[0]?.id;

  const initialSummary = manager.getSummary({ deploymentId: currentDep });
  const initialTimeseries = manager.getTimeseries({
    deploymentId: currentDep,
    granularity: 'day',
  });
  const initialHourlyTimeseries = manager.getTimeseries({
    deploymentId: currentDep,
    granularity: 'hour',
  });

  return (
    <div className="page" style={{ maxWidth: '1100px' }}>
      <Breadcrumbs
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Private System' },
          { label: 'Analytics' },
        ]}
      />
      <Ruler depth={1} label="Telemetry & Performance" />

      <header
        style={{
          marginTop: 'var(--space-loose)',
          marginBottom: 'var(--space-loose)',
        }}
      >
        <h1
          className="heading"
          style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)' }}
        >
          Analytics & System Telemetry
        </h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          Private, zero-cookie first-party observability. Fixed-memory bounded
          summaries computed strictly in-process with zero external trackers.
        </p>
      </header>

      <AnalyticsDashboard
        initialSummary={initialSummary}
        initialTimeseries={initialTimeseries}
        initialHourlyTimeseries={initialHourlyTimeseries}
        deployments={deployments}
        adminEmail={email}
      />
    </div>
  );
}
