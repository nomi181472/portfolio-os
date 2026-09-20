import Link from 'next/link';
import type { Profile, DataSourceState } from '@/types/portfolio';
import { portfolioConfig } from '@/config/portfolio.config';
import { adminLoginEnabled } from '@/lib/analytics/auth';

/** Quiet by design (§113). Contact, provenance, and the way out. */
export function Footer({ profile, source }: { profile: Profile; source: DataSourceState }) {
  const provenance =
    source.status === 'remote'
      ? 'Content loaded from a public JSON file'
      : source.status === 'fallback'
        ? 'Remote content unavailable — showing the bundled copy'
        : 'Content loaded from this repository';

  return (
    <footer className="section" data-analytics-section="footer" style={{ paddingBottom: 'var(--space-wide)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-loose)', justifyContent: 'space-between' }}>
        <div>
          <p className="label">{profile.name}</p>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space)', listStyle: 'none', padding: 0, marginTop: 'var(--space-tight)' }}>
            {profile.email ? (
              <li>
                <a
                  className="link"
                  href={`mailto:${profile.email}`}
                  data-analytics-id="contact:email"
                  data-analytics-type="contact"
                  data-analytics-namespace="contact"
                >
                  {profile.email}
                </a>
              </li>
            ) : null}
            {profile.links.filter((link) => link.visibility === 'public').map((link) => (
              <li key={link.url}>
                <a
                  className="link"
                  href={link.url}
                  rel="me noreferrer"
                  target="_blank"
                  data-analytics-id={`contact:${link.label.toLowerCase()}`}
                  data-analytics-type="external"
                  data-analytics-namespace="contact"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="meta">{provenance}</p>
          <p className="meta" style={{ marginTop: 'var(--space-hair)' }}>
            <Link href="/colophon" className="link" style={{ borderBottom: 0 }}>How this site is built</Link>
          </p>
          {adminLoginEnabled() ? (
            <p className="meta" style={{ marginTop: 'var(--space-hair)' }}>
              <Link href="/analytics" className="link" style={{ borderBottom: 0 }}>Analytics</Link>
            </p>
          ) : null}
          <p className="meta" style={{ marginTop: 'var(--space-hair)' }}>{profile.discipline ? `${profile.name} — ${profile.discipline}` : profile.name}</p>
        </div>
      </div>
    </footer>
  );
}
