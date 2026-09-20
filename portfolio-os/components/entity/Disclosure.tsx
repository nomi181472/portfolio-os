'use client';

import { useId, useState } from 'react';

/**
 * The mechanism behind progressive disclosure. It is a real button with real
 * ARIA state rather than a CSS trick, so a screen reader hears "collapsed" and
 * keyboard users get it for free. Features smooth CSS Grid height animation.
 */
export function Disclosure({
  label,
  hint,
  children,
  defaultOpen = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const triggerId = useId();

  return (
    <section className="disclosure">
      <button
        id={triggerId}
        type="button"
        className="disclosure__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="title" style={{ fontSize: 'var(--text-lead)' }}>{label}</span>
          {hint ? <span className="label" style={{ display: 'block' }}>{hint}</span> : null}
        </span>
        <span className="disclosure__sign" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>
      <div
        className="disclosure__panelWrapper"
        data-open={open}
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
      >
        <div className="disclosure__panelInner">
          <div className="disclosure__panel">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
