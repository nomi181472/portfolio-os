'use client';

/**
 * components/media/Media.tsx
 *
 * One renderer, driven by the media object's `type` (§21, §65). Pages never
 * decide how to display something; the data does. That is what makes a new
 * product with a video and an embedded demo a content change rather than a
 * code change.
 *
 * Every embed: lazy, titled, sandboxed, and independently failable. A dead
 * iframe collapses to a link. It does not take the page down with it.
 */

import { useState } from 'react';
import NextImage from 'next/image';
import type { Media, OverlayBox } from '@/types/portfolio';

const RATIO_DEFAULT = 16 / 9;

function BoundingBoxOverlay({ box }: { box: OverlayBox }) {
  let left = box.left;
  let top = box.top;
  let width = box.width;
  let height = box.height;

  // Convert pixel coordinates to percentages if imgWidth/imgHeight provided
  if (box.imgWidth && box.imgHeight) {
    left = (left / box.imgWidth) * 100;
    top = (top / box.imgHeight) * 100;
    width = (width / box.imgWidth) * 100;
    height = (height / box.imgHeight) * 100;
  }

  const color = box.color || '#00f2fe';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
        border: `2px solid ${color}`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {box.label ? (
        <span
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '4px',
            background: color,
            color: '#000',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          {box.label}
        </span>
      ) : null}
    </div>
  );
}

/** Embeds run sandboxed. `allow-same-origin` is deliberately absent unless the
 *  embed is a known video host that needs it for playback controls. */
const VIDEO_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com'];

function isVideoHost(url: string): boolean {
  try {
    return VIDEO_HOSTS.some((host) => new URL(url).hostname.endsWith(host));
  } catch {
    return false;
  }
}

function Frame({ item, children }: { item: Media; children: React.ReactNode }) {
  const isPortrait = item.ratio && item.ratio < 1;
  const isIframe = item.type === 'iframe' || item.type === 'embed';
  return (
    <figure className="vitrine" style={isPortrait ? { maxWidth: '440px', margin: '0 auto' } : undefined}>
      <div className="vitrine__body" style={{ aspectRatio: item.ratio ?? RATIO_DEFAULT, minHeight: isIframe ? 'clamp(240px, 46vh, 480px)' : undefined }}>{children}</div>
      {item.title || item.caption ? (
        <figcaption className="vitrine__caption">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>{item.title}</span>
            {isIframe ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="link"
                style={{ fontSize: 'var(--text-fine)', whiteSpace: 'nowrap' }}
              >
                Open directly ↗
              </a>
            ) : null}
          </span>
          {item.caption ? <span style={{ color: 'var(--ink-faint)' }}>{item.caption}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

function IframeWithLoader({
  url,
  title,
  sandbox,
  allow,
  onError,
}: {
  url: string;
  title: string;
  sandbox: string;
  allow: string;
  onError: () => void;
}) {
  const [loading, setLoading] = useState(true);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-sunk)',
            color: 'var(--ink-faint)',
            gap: 8,
            fontSize: 'var(--text-fine)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              border: '2px solid var(--rule-strong)',
              borderTopColor: 'var(--signal)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>Connecting embed...</span>
        </div>
      ) : null}
      <iframe
        src={url}
        title={title}
        loading="lazy"
        allow={allow}
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox={sandbox}
        style={{ width: '100%', height: '100%', border: 0, background: 'var(--surface-sunk)', display: 'block' }}
        onLoad={() => setLoading(false)}
        onError={onError}
      />
    </div>
  );
}

function Unavailable({ item, reason }: { item: Media; reason: string }) {
  return (
    <div className="vitrine__fallback">
      <p className="label">{reason}</p>
      {item.visibility === 'public' ? (
        <a className="link" href={item.url} target="_blank" rel="noreferrer">Open directly</a>
      ) : null}
    </div>
  );
}

export function MediaRenderer({ item }: { item: Media }) {
  const [failed, setFailed] = useState(false);

  const boxes: OverlayBox[] = [
    ...(item.box ? [item.box] : []),
    ...(item.boxes ?? []),
  ];

  if (item.visibility === 'private') {
    return (
      <Frame item={item}>
        <Unavailable item={item} reason="Restricted. This material is not public." />
      </Frame>
    );
  }
  if (item.visibility === 'coming-soon') {
    return <Frame item={item}><Unavailable item={item} reason="Not published yet." /></Frame>;
  }
  if (failed) {
    return <Frame item={item}><Unavailable item={item} reason="This did not load." /></Frame>;
  }

  switch (item.type) {
    case 'image':
    case 'gif':
    case 'svg':
    case 'diagram':
      const isPortraitImg = item.ratio && item.ratio < 1;
      return (
        <Frame item={item}>
          <NextImage
            src={item.url}
            alt={item.alt ?? item.title ?? ''}
            fill
            sizes="(max-width: 52rem) 100vw, 46rem"
            style={{ objectFit: item.type === 'diagram' || isPortraitImg ? 'contain' : 'cover' }}
            onError={() => setFailed(true)}
            unoptimized={item.type === 'svg' || item.type === 'gif' || item.url.startsWith('http')}
          />
          {boxes.map((b, idx) => (
            <BoundingBoxOverlay key={idx} box={b} />
          ))}
        </Frame>
      );

    case 'video':
      if (isVideoHost(item.url)) {
        return (
          <Frame item={item}>
            <iframe
              src={item.url}
              title={item.title ?? 'Embedded video'}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              style={{ width: '100%', height: '100%', border: 0 }}
              onError={() => setFailed(true)}
            />
          </Frame>
        );
      }
      return (
        <Frame item={item}>
          <video
            controls
            preload="metadata"
            poster={item.poster}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={() => setFailed(true)}
          >
            <source src={item.url} />
            <track kind="captions" />
          </video>
        </Frame>
      );

    case 'iframe':
    case 'embed':
      return (
        <Frame item={item}>
          <IframeWithLoader
            url={item.url}
            title={item.title ?? 'Embedded application'}
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            onError={() => setFailed(true)}
          />
        </Frame>
      );

    case 'document':
      return (
        <Frame item={item}>
          <div className="vitrine__fallback">
            <p className="label">{item.title ?? 'Document'}</p>
            <a className="control" href={item.url} target="_blank" rel="noreferrer">Open document</a>
          </div>
        </Frame>
      );

    default:
      return null;
  }
}

export function MediaGallery({ items, limit }: { items: Media[]; limit?: number }) {
  const visible = items
    .filter((item) => item.visibility !== 'disabled')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, limit);
  if (visible.length === 0) return null;
  return (
    <div className="gallery">
      {visible.map((item) => (
        <MediaRenderer key={item.url} item={item} />
      ))}
    </div>
  );
}
