export default function GlobalLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        gap: 'var(--space, 1rem)',
        color: 'var(--ink, #8e8e93)',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '2px solid var(--rule-strong, #3a3a3c)',
          borderTopColor: 'var(--ink-bright, #fff)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading content…</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
