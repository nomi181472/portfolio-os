/**
 * app/admin/dashboard/page.tsx
 *
 * Private analytics dashboard (§3-§15, §29, §50-51). A server component: it
 * re-verifies the HttpOnly session cookie on every render, so presence is never
 * trusted from the client. It reads the same bounded aggregates the SSR
 * singleton already keeps for the deployment row and the live online set  - 
 * memory only, no disk, no network, no store write on read.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { adminCookieName, verifySessionToken } from '@/lib/analytics/auth';
import { getAnalyticsManager } from '@/lib/analytics/singleton';
import type { Summary, LiveSnapshot } from '@/lib/analytics/singleton';
import { logoutAction } from '../actions';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

import { Ruler } from '@/components/layout/Ruler';

/** Short human duration, e.g. 72000 -> "1m 12s". No locale, no units table. */
function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}



export default async function DashboardPage() {
  const jar = await cookies();
  const email = verifySessionToken(jar.get(adminCookieName)?.value);
  if (!email) redirect('/admin/login');

  const manager = getAnalyticsManager();
  const summary: Summary = manager.getSummary({ deploymentId: 'dev' });
  const live: LiveSnapshot = manager.getLive();
  const deployments = manager.getDeployments();

  const kpis = summary.kpis;
  const rows: [string, string][] = [
    ['Page views', String(kpis.pageViews)],
    ['Unique visitors', String(kpis.uniqueVisitors)],
    ['Sessions', String(kpis.sessions)],
    ['New sessions', String(kpis.newSessions)],
    ['Returning sessions', String(kpis.returningSessions)],
    ['Clicks', String(kpis.clicks)],
    ['Section views', String(kpis.sectionViews)],
    ['Resume downloads', String(kpis.resumeDownloads)],
    ['Avg session', formatDuration(kpis.avgSessionDurationMs)],
  ];

  return (
    <div className="page">
      <Breadcrumbs
        trail={[
          { label: 'Admin', href: '/admin/login' },
          { label: 'Dashboard' },
        ]}
      />
      <Ruler depth={1} label="Analytics" />

      <header style={{ marginTop: 'var(--space-loose)', marginBottom: 'var(--space-loose)' }}>
        <h1 className="heading" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>
          Analytics
        </h1>
        <p className="lead" style={{ marginTop: 'var(--space-snug)' }}>
          Bounded aggregates for the <span className="link">dev</span> deployment  - 
          drawn from the same SSR singleton a Next route imports. Memory only.
        </p>
        <p className="meta" style={{ marginTop: 'var(--space-snug)' }}>
          Signed in as {email}
        </p>
      </header>

      <section aria-label="Live" style={{ marginBottom: 'var(--space-loose)' }}>
        <h2 className="heading" style={{ fontSize: '1.1rem' }}>
          Live now
        </h2>
        <p className="meta" style={{ marginTop: 'var(--space-snug)' }}>
          {live.online} online
          {live.activeSections.length > 0
            ? ` - ${live.activeSections.map((s) => `${s.section} (${s.count})`).join(', ')}`
            : ''}
        </p>
      </section>

      <section aria-label="Key performance indicators">
        <h2 className="heading" style={{ fontSize: '1.1rem', marginBottom: 'var(--space-snug)' }}>
          Summary
        </h2>
        <dl className="rows" style={{ maxWidth: 'var(--measure)' }}>
          {rows.map(([label, value]) => (
            <div className="row" key={label}>
              <dt>{label}</dt>
              <dd className="meta">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Deployments" style={{ marginTop: 'var(--space-loose)' }}>
        <h2 className="heading" style={{ fontSize: '1.1rem', marginBottom: 'var(--space-snug)' }}>
          Deployments
        </h2>
        {deployments.length === 0 ? (
          <p className="meta">No deployments recorded yet.</p>
        ) : (
          <ul className="rows" style={{ maxWidth: 'var(--measure)' }}>
            {deployments.map((d) => (
              <li className="row" key={d.id}>
                <MetaphorMark name="trajectory" size={16} />
                <span>
                  {d.id}
                  <span className="meta" style={{ marginLeft: 'var(--space-snug)' }}>
                    first seen {new Date(d.firstSeenAt).toISOString().slice(0, 10)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={logoutAction} style={{ marginTop: 'var(--space-loose)' }}>
        <button className="control" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
