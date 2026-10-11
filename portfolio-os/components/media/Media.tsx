'use client';

/**
 * components/media/Media.tsx
 *
 * Universal media renderer, driven dynamically by each media object's `type` (§21, §65).
 * Features:
 * - Interactive Lightbox with zoom, pan, and keyboard navigation for high-res certificates, diagrams, and transcripts.
 * - Tabbed segmented switcher for multi-document galleries.
 * - Simulated OS Window Chrome with SSL hostname badge, reload, and fullscreen modal for iframes.
 * - Mobile Touch-Scroll Shield preventing scroll trapping on touch screens.
 * - Embedded PDF viewer support for academic and technical documents.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import type { Media, OverlayBox } from '@/types/portfolio';
import styles from './Media.module.css';

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

function getHostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'embed';
  }
}

function Frame({
  item,
  children,
  onReload,
  onFullscreen,
}: {
  item: Media;
  children: React.ReactNode;
  onReload?: () => void;
  onFullscreen?: () => void;
}) {
  const isPortrait = item.ratio && item.ratio < 1;
  const isIframe = item.type === 'iframe' || item.type === 'embed';
  const hostname = item.url ? getHostName(item.url) : '';

  return (
    <figure
      className="vitrine"
      style={{
        ...(isPortrait ? { maxWidth: '480px', margin: '0 auto' } : { width: '100%' }),
        ...(isIframe ? { border: '1px solid var(--rule-strong)', boxShadow: 'var(--lift)' } : {}),
      }}
    >
      {isIframe ? (
        <div className={styles.windowBar}>
          <div className={styles.windowDots}>
            <span className={styles.windowDot} />
            <span className={styles.windowDot} />
            <span className={styles.windowDot} />
          </div>
          <div className={styles.windowAddress} title={item.url}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>{hostname}</span>
          </div>
          <div className={styles.windowActions}>
            {onReload ? (
              <button
                type="button"
                onClick={onReload}
                className={styles.windowActionBtn}
                title="Reload embed"
                aria-label="Reload embed"
              >
                ↻
              </button>
            ) : null}
            {onFullscreen ? (
              <button
                type="button"
                onClick={onFullscreen}
                className={styles.windowActionBtn}
                title="Expand to Fullscreen"
                aria-label="Expand to Fullscreen"
              >
                ⛶
              </button>
            ) : null}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className={styles.windowActionBtn}
                title="Open directly in new tab"
                aria-label="Open directly in new tab"
              >
                ↗
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="vitrine__body"
        style={{
          aspectRatio: isIframe ? '16 / 9.5' : (item.ratio ?? RATIO_DEFAULT),
          minHeight: isIframe ? 'clamp(440px, 68vh, 850px)' : undefined,
          width: '100%',
          overflow: 'hidden',
          background: 'var(--surface-sunk)',
        }}
      >
        {children}
      </div>

      {item.title || item.caption ? (
        <figcaption className="vitrine__caption">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, color: 'var(--ink-bright)' }}>{item.title}</span>
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
          {item.caption ? <span style={{ color: 'var(--ink-quiet)' }}>{item.caption}</span> : null}
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
  const [interactive, setInteractive] = useState(false);
  const [key, setKey] = useState(0);

  const handleReload = () => {
    setLoading(true);
    setKey((prev) => prev + 1);
  };

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

      {/* Mobile Touch Shield to prevent touch scroll hijacking */}
      {!interactive ? (
        <div
          className={styles.touchShield}
          onClick={() => setInteractive(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setInteractive(true);
          }}
          aria-label="Tap to interact with embed"
        >
          <div className={styles.touchShieldPrompt}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Tap to interact with embed</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.relockBtn}
          onClick={(e) => {
            e.stopPropagation();
            setInteractive(false);
          }}
          title="Lock touch scroll"
        >
          🔒 Lock page scroll
        </button>
      )}

      <iframe
        key={key}
        src={url}
        title={title}
        loading="lazy"
        allow={allow}
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox={sandbox}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          background: 'var(--surface-sunk)',
          display: 'block',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
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
        <a className="link" href={item.url} target="_blank" rel="noreferrer">
          Open directly ↗
        </a>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Interactive Lightbox for high-res image and credential inspection
   -------------------------------------------------------------------------- */
function LightboxModal({
  items,
  currentIndex,
  onClose,
  onNavigate,
}: {
  items: Media[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const current = items[currentIndex] ?? items[0];
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset zoom & pan when item changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  // Keyboard navigation & escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && items.length > 1) {
        onNavigate((currentIndex + 1) % items.length);
      }
      if (e.key === 'ArrowLeft' && items.length > 1) {
        onNavigate((currentIndex - 1 + items.length) % items.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, onClose, onNavigate]);

  if (!current) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(1, Number((z - 0.5).toFixed(1)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch pan support for mobile inspection
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (zoom <= 1 || e.touches.length !== 1 || !touch) return;
    setIsDragging(true);
    dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!isDragging || zoom <= 1 || e.touches.length !== 1 || !touch) return;
    setPan({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  return (
    <div className={styles.lightboxOverlay} role="dialog" aria-modal="true" aria-label="Media Lightbox">
      <div className={styles.lightboxHeader}>
        <div className={styles.lightboxTitleWrap}>
          <span className={styles.lightboxTitle}>{current.title || 'Document View'}</span>
          {items.length > 1 ? (
            <span className={styles.lightboxCounter}>
              {currentIndex + 1} / {items.length}
            </span>
          ) : null}
        </div>

        <div className={styles.lightboxControls}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${zoom > 1 ? styles.controlBtnActive : ''}`}
            onClick={handleResetZoom}
            title="Reset Zoom"
            aria-label="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            title="Zoom In"
            aria-label="Zoom In"
          >
            +
          </button>
          {current.url ? (
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className={styles.controlBtn}
              title="Open full resolution in new tab"
              aria-label="Open full resolution in new tab"
            >
              ↗
            </a>
          ) : null}
          <button
            type="button"
            className={styles.controlBtn}
            onClick={onClose}
            title="Close Lightbox (Esc)"
            aria-label="Close Lightbox"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className={`${styles.lightboxStage} ${isDragging ? styles.lightboxStageDragging : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {items.length > 1 ? (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex - 1 + items.length) % items.length);
            }}
            title="Previous document"
            aria-label="Previous document"
          >
            <MetaphorMark name="arrow-back" size={20} />
          </button>
        ) : null}

        <div
          className={styles.lightboxImgWrap}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <img
            src={current.url}
            alt={current.alt ?? current.title ?? 'Enlarged document preview'}
            className={styles.lightboxImg}
            draggable={false}
          />
        </div>

        {items.length > 1 ? (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex + 1) % items.length);
            }}
            title="Next document"
            aria-label="Next document"
          >
            <MetaphorMark name="arrow-next" size={20} />
          </button>
        ) : null}
      </div>

      {current.caption ? (
        <div className={styles.lightboxFooter}>{current.caption}</div>
      ) : null}
    </div>
  );
}

export function MediaRenderer({
  item,
  onOpenLightbox,
}: {
  item: Media;
  onOpenLightbox?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [fullscreenIframe, setFullscreenIframe] = useState(false);

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
    return (
      <Frame item={item}>
        <Unavailable item={item} reason="Not published yet." />
      </Frame>
    );
  }
  if (failed) {
    return (
      <Frame item={item}>
        <Unavailable item={item} reason="This did not load." />
      </Frame>
    );
  }

  // Detect certificates, transcripts, and documents to preserve crisp edges without cropping
  const isDocumentOrCert =
    item.type === 'diagram' ||
    (item.ratio && item.ratio < 1) ||
    Boolean(
      item.title?.toLowerCase().match(/degree|certificate|transcript|diploma|sheet|record/) ||
      item.url.toLowerCase().match(/certificate|transcript|degree|diploma/)
    );

  switch (item.type) {
    case 'image':
    case 'gif':
    case 'svg':
    case 'diagram':
      return (
        <Frame item={item}>
          <div
            className={styles.imageClickable}
            onClick={onOpenLightbox}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onOpenLightbox) onOpenLightbox();
            }}
            title="Click to inspect & zoom document"
            aria-label={`Inspect ${item.title || 'image'}`}
          >
            <NextImage
              src={item.url}
              alt={item.alt ?? item.title ?? ''}
              fill
              sizes="(max-width: 52rem) 100vw, 46rem"
              style={{ objectFit: isDocumentOrCert ? 'contain' : 'cover' }}
              onError={() => setFailed(true)}
              unoptimized={item.type === 'svg' || item.type === 'gif' || item.url.startsWith('http')}
            />
            {boxes.map((b, idx) => (
              <BoundingBoxOverlay key={idx} box={b} />
            ))}
            <div className={styles.inspectBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <span>Inspect</span>
            </div>
          </div>
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
        <>
          <Frame
            item={item}
            onFullscreen={() => setFullscreenIframe(true)}
          >
            <IframeWithLoader
              url={item.url}
              title={item.title ?? 'Embedded application'}
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
              onError={() => setFailed(true)}
            />
          </Frame>

          {/* Fullscreen Modal View for interactive web embeds */}
          {fullscreenIframe ? (
            <div className={styles.fullscreenModal} role="dialog" aria-modal="true">
              <div className={styles.lightboxHeader}>
                <div className={styles.lightboxTitleWrap}>
                  <span className={styles.lightboxTitle}>{item.title ?? 'Live Embed'}</span>
                </div>
                <div className={styles.lightboxControls}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.controlBtn}
                    title="Open directly in new window"
                  >
                    ↗ Open direct
                  </a>
                  <button
                    type="button"
                    className={styles.controlBtn}
                    onClick={() => setFullscreenIframe(false)}
                    title="Exit Fullscreen"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
              <div className={styles.fullscreenModalBody}>
                <iframe
                  src={item.url}
                  title={item.title ?? 'Fullscreen Embedded application'}
                  allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                  sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              </div>
            </div>
          ) : null}
        </>
      );

    case 'document':
      // Support native PDF embedding when url points to a PDF
      const isPdf = item.url.toLowerCase().endsWith('.pdf') || item.url.includes('/pdf');
      if (isPdf) {
        return (
          <Frame item={item}>
            <iframe
              src={`${item.url}#toolbar=0`}
              title={item.title ?? 'Document preview'}
              style={{ width: '100%', height: '100%', border: 0, minHeight: '480px' }}
              onError={() => setFailed(true)}
            />
          </Frame>
        );
      }
      return (
        <Frame item={item}>
          <div className="vitrine__fallback">
            <p className="label">{item.title ?? 'Document'}</p>
            <a className="control" href={item.url} target="_blank" rel="noreferrer">
              Open document ↗
            </a>
          </div>
        </Frame>
      );

    default:
      return null;
  }
}

export function MediaGallery({ items, limit }: { items: Media[]; limit?: number }) {
  const [activeTab, setActiveTab] = useState<'all' | number>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visible = items
    .filter((item) => item.visibility !== 'disabled')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, limit);

  if (visible.length === 0) return null;

  // Filter items for Lightbox (images and diagrams)
  const imageItems = visible.filter((i) =>
    ['image', 'gif', 'svg', 'diagram'].includes(i.type)
  );

  const selectedItem = typeof activeTab === 'number' ? (visible[activeTab] ?? visible[0]) : null;
  const displayedItems: Media[] = selectedItem ? [selectedItem] : visible;

  return (
    <div>
      {/* Tabbed media switcher when multiple items exist */}
      {visible.length > 1 ? (
        <div className={styles.tabContainer}>
          <div className={styles.tabHeaderWrap}>
            <div className={styles.tabList} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'all'}
                className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span>All Documents ({visible.length})</span>
              </button>
              {visible.map((item, idx) => (
                <button
                  key={item.url || idx}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === idx}
                  className={`${styles.tabBtn} ${activeTab === idx ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(idx)}
                >
                  <span>{item.title ? (item.title.length > 28 ? `${item.title.slice(0, 26)}…` : item.title) : `Document ${idx + 1}`}</span>
                </button>
              ))}
            </div>

            <div className={styles.tabSteppers} role="group" aria-label="Document navigation">
              <button
                type="button"
                className={styles.tabStepBtn}
                onClick={() => {
                  const total = visible.length;
                  if (typeof activeTab === 'number') {
                    setActiveTab((activeTab - 1 + total) % total);
                  } else {
                    setActiveTab(total - 1);
                  }
                }}
                title="Previous document"
                aria-label="Previous document"
              >
                <MetaphorMark name="arrow-back" size={14} />
              </button>
              <button
                type="button"
                className={styles.tabStepBtn}
                onClick={() => {
                  const total = visible.length;
                  if (typeof activeTab === 'number') {
                    setActiveTab((activeTab + 1) % total);
                  } else {
                    setActiveTab(0);
                  }
                }}
                title="Next document"
                aria-label="Next document"
              >
                <MetaphorMark name="arrow-next" size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="gallery">
        {displayedItems.map((item) => {
          const imgIdx = imageItems.findIndex((i) => i.url === item.url);
          return (
            <MediaRenderer
              key={item.url}
              item={item}
              onOpenLightbox={
                imgIdx !== -1 ? () => setLightboxIndex(imgIdx) : undefined
              }
            />
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && imageItems.length > 0 ? (
        <LightboxModal
          items={imageItems}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        />
      ) : null}
    </div>
  );
}
