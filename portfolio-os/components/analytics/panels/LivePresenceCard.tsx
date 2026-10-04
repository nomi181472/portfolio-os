'use client';

export function LivePresenceCard({ activeCount, activeSections }: { activeCount: number, activeSections: { section: string; count: number }[] }) {
  return (
    <div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: 'var(--text-meta)',
          color: 'var(--ink-quiet)',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: activeCount > 0 ? '#48c774' : 'var(--ink-faint)',
            boxShadow:
              activeCount > 0
                ? '0 0 8px rgba(72, 199, 116, 0.6)'
                : 'none',
          }}
        />
        <strong style={{ color: 'var(--ink-bright)', fontFamily: 'var(--font-data)' }}>
          {activeCount}
        </strong>{' '}
        {activeCount === 1 ? 'visitor online now' : 'visitors online now'}
      </div>

      {activeSections.length > 0 && (
        <div
          style={{
            marginTop: '4px',
            fontSize: 'var(--text-fine)',
            fontFamily: 'var(--font-data)',
            color: 'var(--signal)',
          }}
        >
          Viewing:{' '}
          {activeSections
            .map((s) => `${s.section} (${s.count})`)
            .join(', ')}
        </div>
      )}
    </div>
  );
}
