import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getGraph } from '@/lib/source';
import { Ruler } from '@/components/layout/Ruler';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { StatusBadge } from '@/components/entity/Badges';

export const metadata: Metadata = {
  title: 'Botonetics — Incubation',
  description: 'Botonetics: Bridging Brains, Bots, Business',
};

export default async function StartupPage() {
  const { bundle } = await getGraph();
  const startup = bundle.data.startup;
  if (!startup) notFound();

  const websiteUrl = startup.links?.find((l) => l.type === 'website')?.url || 'https://botonetics.com/';

  return (
    <div className="page">
      <Breadcrumbs trail={[{ label: 'Surface', href: '/' }, { label: startup.name }]} />
      <Ruler depth={2} label="Incubation" />

      {/* Hero Section: Logo, Name, Tagline */}
      <div
        style={{
          marginTop: 'var(--space-loose)',
          padding: 'var(--space-loose)',
          border: '1px solid var(--rule)',
          borderRadius: 'var(--radius-frame)',
          background: 'radial-gradient(120% 80% at 20% 20%, color-mix(in oklab, var(--surface-raised) 90%, transparent), transparent 80%), var(--surface-sunk)',
          display: 'grid',
          gap: 'var(--space-loose)',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-loose)', flexWrap: 'wrap' }}>
          {/* Logo */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '20px',
              background: '#091015',
              border: '1.5px solid var(--rule-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <img
              src="/media/botonetics-logo.svg"
              alt={`${startup.name} logo`}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          {/* Name & Tagline */}
          <div>
            <p className="meta" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-tight)', margin: 0, marginBottom: 'var(--space-hair)' }}>
              <MetaphorMark name="incubator" size={14} /> Upcoming Startup
            </p>
            <h1 className="heading" style={{ margin: 0, fontSize: 'clamp(2.2rem, 5vw, 3.2rem)', letterSpacing: '-0.02em' }}>
              {startup.name}
            </h1>
            {startup.vision ? (
              <p className="lead" style={{ margin: 0, marginTop: 'var(--space-tight)', color: 'var(--signal)', fontSize: '1.25rem', fontWeight: 500 }}>
                {startup.vision}
              </p>
            ) : null}
          </div>
        </div>

        {/* Action Bar: Status & Direct External Link */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space)',
            flexWrap: 'wrap',
            paddingTop: 'var(--space)',
            borderTop: '1px solid var(--rule)',
          }}
        >
          <div>
            <StatusBadge status={startup.status} />
          </div>

          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-tight)',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius)',
              background: 'var(--signal)',
              color: 'var(--surface-sunk)',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.95rem',
              transition: 'transform 0.15s ease, filter 0.15s ease',
            }}
          >
            <span>Visit botonetics.com</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17l10-10" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </div>
      </div>

      {/* Live Iframe Preview Section */}
      <section style={{ marginTop: 'var(--space-wide)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-snug)' }}>
          <h2 className="label" style={{ color: 'var(--ink-quiet)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Platform Preview
          </h2>
          <span className="meta">Interactive Preview</span>
        </div>

        <div
          style={{
            width: '100%',
            height: '620px',
            border: '1px solid var(--rule-strong)',
            borderRadius: 'var(--radius-frame)',
            overflow: 'hidden',
            background: '#091015',
            boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
          }}
        >
          <iframe
            src={websiteUrl}
            title="Botonetics Interactive Preview"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block',
            }}
          />
        </div>
      </section>
    </div>
  );
}
