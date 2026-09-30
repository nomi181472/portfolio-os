/**
 * app/opengraph-image.tsx — the fallback social card.
 *
 * Previously there was none, so every share of every page rendered the browser's
 * idea of a preview: a bare hostname, or nothing. This is the card for routes that
 * have no image of their own; an entity page that carries public media overrides
 * it, because a shared project should show the project.
 *
 * Deterministic by design. It renders at build time from the config, not from a
 * request, so the same URL always produces the same bytes and the card is
 * cacheable by a CDN. The palette is the dark one deliberately: a social card is
 * displayed inside someone else's chrome, and dark survives both of theirs.
 */
import { ImageResponse } from 'next/og';
import { portfolioConfig } from '@/config/portfolio.config';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${portfolioConfig.site.title} — portfolio`;

export default function OpengraphImage() {
  const name = portfolioConfig.site.title.split('—')[0]?.trim() || portfolioConfig.site.title;
  const discipline = portfolioConfig.site.title.includes('—')
    ? portfolioConfig.site.title.split('—').slice(1).join('—').trim()
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '84px 88px',
          background: '#090a0d',
          color: '#f5f7fa',
          fontFamily: 'sans-serif',
        }}
      >
        {/* The instrument rail, drawn rather than described: one vertical rule at
            the same relative position it holds in the live layout. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 14, height: 14, background: '#f5f7fa' }} />
          <div style={{ fontSize: 26, letterSpacing: 6, textTransform: 'uppercase', color: '#8b93a1' }}>
            Portfolio OS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', fontSize: 104, fontWeight: 700, lineHeight: 1.02 }}>
            {name}
          </div>
          {discipline ? (
            <div style={{ display: 'flex', fontSize: 40, color: '#aab2bf', lineHeight: 1.25 }}>
              {discipline}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: '2px solid rgba(255,255,255,0.14)',
            paddingTop: 28,
            fontSize: 26,
            color: '#8b93a1',
          }}
        >
          <div style={{ display: 'flex', gap: 28 }}>
            {['Experience', 'Products', 'Research', 'Skills'].map((label) => (
              <div key={label} style={{ display: 'flex' }}>
                {label}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex' }}>
            {portfolioConfig.site.url.replace(/^https?:\/\//, '')}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
