'use client';

import { useState } from 'react';

interface CopyEntityButtonProps {
  entityData: Record<string, unknown>;
  name: string;
}

export function CopyEntityButton({ entityData, name }: CopyEntityButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const jsonStr = JSON.stringify(entityData, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      type="button"
      className="control"
      onClick={handleCopy}
      title={`Copy ${name} JSON snippet`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: 'var(--text-meta)',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{ color: copied ? 'var(--signal)' : 'inherit' }}
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span>{copied ? '✓ Copied JSON' : 'Copy JSON'}</span>
    </button>
  );
}
