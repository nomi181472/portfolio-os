import Link from 'next/link';
import type { Profile, DataSourceState } from '@/types/portfolio';
import { adminLoginEnabled } from '@/lib/analytics/auth';
import styles from './Footer.module.css';

function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.27 1.64 1.64 0 0 0 0 3.27m1.4 9.74V10.13H5.06v8.37z" />
    </svg>
  );
}

function ScholarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-24L0 9.5l4.838 3.94A8 8 0 0 1 12 9a8 8 0 0 1 7.162 4.44L24 9.5z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7M17 7H7M17 7V17" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function RadioIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function getLinkIcon(url: string, label: string) {
  const u = url.toLowerCase();
  const l = label.toLowerCase();
  if (u.includes('github.com')) return <GitHubIcon />;
  if (u.includes('linkedin.com')) return <LinkedInIcon />;
  if (u.includes('scholar.google') || l.includes('scholar')) return <ScholarIcon />;
  if (u.startsWith('mailto:') || l.includes('email') || l.includes('mail')) return <MailIcon />;
  return <ExternalIcon />;
}

/** Quiet by design (§113). Contact, provenance, and the way out. */
export function Footer({ profile, source }: { profile: Profile; source: DataSourceState }) {
  const provenance =
    source.status === 'remote'
      ? 'Content loaded from a public JSON file'
      : source.status === 'fallback'
        ? 'Remote content unavailable — showing bundled copy'
        : 'Content loaded from this repository';

  const emailUrl = profile.email ? `mailto:${profile.email}` : null;
  const visibleLinks = profile.links.filter((link) => {
    if (link.visibility && link.visibility !== 'public') return false;
    if (emailUrl) {
      const norm = link.url.trim().toLowerCase();
      if (norm === emailUrl.toLowerCase() || norm === `mailto:${profile.email?.trim().toLowerCase()}`) {
        return false;
      }
    }
    return true;
  });

  const initials =
    profile.name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'OS';

  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer} data-analytics-section="footer">
      <div className={styles.container}>
        <div className={styles.mainGrid}>
          {/* Column 1: Brand / Identity */}
          <div className={styles.brandCol}>
            <div className={styles.brandHeader}>
              {profile.avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatar} alt={profile.name} className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}>{initials}</div>
              )}
              <div className={styles.brandTitles}>
                <h2 className={styles.brandName}>{profile.name}</h2>
                {profile.discipline ? (
                  <p className={styles.brandDiscipline}>{profile.discipline}</p>
                ) : null}
              </div>
            </div>

            {profile.positioning ? (
              <p className={styles.brandPositioning}>{profile.positioning}</p>
            ) : null}

            <div className={styles.statusPill}>
              <span className={styles.statusDot} />
              <span>Direct P2P & Systems Active</span>
            </div>
          </div>

          {/* Column 2: Channels & Connect */}
          <div className={styles.channelsCol}>
            <div className={styles.colHeading}>Channels & Connect</div>
            <ul className={styles.linksList}>
              {profile.email ? (
                <li className={styles.linkItem}>
                  <a
                    className={styles.linkPill}
                    href={`mailto:${profile.email}`}
                    data-analytics-id="contact:email"
                    data-analytics-type="contact"
                    data-analytics-namespace="contact"
                  >
                    <span className={styles.linkIcon}>
                      <MailIcon />
                    </span>
                    <span className={styles.linkLabel}>{profile.email}</span>
                  </a>
                </li>
              ) : null}

              {visibleLinks.map((link) => (
                <li key={link.url} className={styles.linkItem}>
                  <a
                    className={styles.linkPill}
                    href={link.url}
                    rel="me noreferrer"
                    target="_blank"
                    data-analytics-id={`contact:${link.label.toLowerCase()}`}
                    data-analytics-type="external"
                    data-analytics-namespace="contact"
                  >
                    <span className={styles.linkIcon}>
                      {getLinkIcon(link.url, link.label)}
                    </span>
                    <span className={styles.linkLabel}>{link.label}</span>
                    <span className={styles.linkArrow}>
                      <ExternalIcon />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: System & Platform Architecture */}
          <div className={styles.systemCol}>
            <div className={styles.colHeading}>Architecture & Direct</div>
            <ul className={styles.systemNav}>
              <li>
                <Link href="/colophon" className={styles.systemNavLink}>
                  <span className={styles.systemNavIcon}>
                    <BookIcon />
                  </span>
                  <span>How this site is built</span>
                </Link>
              </li>
              <li>
                <Link href="/direct" className={styles.systemNavLink}>
                  <span className={styles.systemNavIcon}>
                    <RadioIcon />
                  </span>
                  <span>Host Mode (/direct)</span>
                </Link>
              </li>
              {adminLoginEnabled() ? (
                <li>
                  <Link href="/analytics" className={styles.systemNavLink}>
                    <span className={styles.systemNavIcon}>
                      <ChartIcon />
                    </span>
                    <span>Telemetry & Analytics</span>
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href="/copy" className={styles.systemNavLink}>
                  <span className={styles.systemNavIcon}>
                    <TerminalIcon />
                  </span>
                  <span>Copy this OS</span>
                </Link>
              </li>
            </ul>

            <div className={styles.provenanceBox}>
              <div className={styles.provenanceTitle}>
                <span className={styles.statusDot} style={{ width: 5, height: 5 }} />
                <span>System Provenance</span>
              </div>
              <div>{provenance}</div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright, Colophon, and Back to Top */}
        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            © {currentYear} {profile.name}. All rights reserved.
          </p>

          <div className={styles.bottomActions}>
            <Link href="/colophon" className={styles.colophonLink}>
              Engineered with Portfolio OS
            </Link>
            <a href="#main" className={styles.backToTop} aria-label="Back to top of page">
              <span>Top</span>
              <ChevronUpIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
