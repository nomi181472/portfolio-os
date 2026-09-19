'use client';

import { useId, useState } from 'react';

/**
 * The mechanism behind progressive disclosure. It is a real button with real
 * ARIA state rather than a CSS trick, so a screen reader hears "collapsed" and
 * keyboard users get it for free.
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

  return (
    <section className="disclosure">
      <button
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
        <span className="disclosure__sign" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div className="disclosure__panel" id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
