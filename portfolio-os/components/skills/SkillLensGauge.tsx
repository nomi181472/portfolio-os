'use client';

interface SkillLensGaugeProps {
  data: Record<string, unknown>;
  /** When true, renders a slightly more compact single-row variant */
  compact?: boolean;
}

function parseScore(val: unknown): { score: string; pct: number } {
  const str = String(val ?? '').trim();
    const parts = str.split('/').map((s) => parseFloat(s.trim()));
    const num = parts[0];
    const den = parts[1];
    if (typeof num === 'number' && typeof den === 'number' && !isNaN(num) && !isNaN(den) && den > 0) {
      return { score: `${num}/${den}`, pct: Math.min(100, Math.max(0, (num / den) * 100)) };
    }
  const parsed = parseFloat(str);
  if (!isNaN(parsed)) {
    return { score: `${parsed}`, pct: Math.min(100, Math.max(0, (parsed / 10) * 100)) };
  }
  return { score: str, pct: 100 };
}

export function SkillLensGauge({ data, compact = false }: SkillLensGaugeProps) {
  // 1. Frameworks & Runtimes: Tri-Modal Velocity (Agentic, AI-Assisted, Independent)
  if (data.agentic && data.aiAssisted && data.independent) {
    const agentic = parseScore(data.agentic);
    const ai = parseScore(data.aiAssisted);
    const indep = parseScore(data.independent);

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 6 : 8,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--text-fine)',
          maxWidth: '100%',
          flexWrap: 'wrap',
        }}
      >
        {/* Agentic */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }} title="Autonomous Agentic Development">🤖</span>
          <span style={{ color: '#93c5fd', fontWeight: 600 }}>Agentic</span>
          <span style={{ color: 'var(--ink-bright)', fontWeight: 700 }}>{agentic.score}</span>
          <span
            style={{
              width: 24,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${agentic.pct}%`,
                height: '100%',
                background: '#60a5fa',
              }}
            />
          </span>
        </div>

        <span style={{ opacity: 0.25, color: 'var(--ink-faint)' }}>│</span>

        {/* AI-Assisted */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }} title="AI-Assisted Copilot Velocity">⚡</span>
          <span style={{ color: '#c084fc', fontWeight: 600 }}>Copilot</span>
          <span style={{ color: 'var(--ink-bright)', fontWeight: 700 }}>{ai.score}</span>
          <span
            style={{
              width: 24,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${ai.pct}%`,
                height: '100%',
                background: '#a855f7',
              }}
            />
          </span>
        </div>

        <span style={{ opacity: 0.25, color: 'var(--ink-faint)' }}>│</span>

        {/* Independent / Native */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }} title="Independent / Zero-AI First Principles">👤</span>
          <span style={{ color: '#6ee7b7', fontWeight: 600 }}>Native</span>
          <span style={{ color: 'var(--ink-bright)', fontWeight: 700 }}>{indep.score}</span>
          <span
            style={{
              width: 24,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${indep.pct}%`,
                height: '100%',
                background: '#34d399',
              }}
            />
          </span>
        </div>
      </div>
    );
  }

  // 2. Languages: Dual Literacy (Reading & Writing)
  if (data.reading && data.writing) {
    const reading = parseScore(data.reading);
    const writing = parseScore(data.writing);

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 6 : 8,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--text-fine)',
          maxWidth: '100%',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }}>📖</span>
          <span style={{ color: 'var(--ink-quiet)', fontWeight: 500 }}>Read</span>
          <span style={{ color: '#34d399', fontWeight: 700 }}>{reading.score}</span>
          <span
            style={{
              width: 26,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${reading.pct}%`,
                height: '100%',
                background: '#34d399',
              }}
            />
          </span>
        </div>

        <span style={{ opacity: 0.25, color: 'var(--ink-faint)' }}>│</span>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }}>✍️</span>
          <span style={{ color: 'var(--ink-quiet)', fontWeight: 500 }}>Write</span>
          <span style={{ color: 'var(--signal)', fontWeight: 700 }}>{writing.score}</span>
          <span
            style={{
              width: 26,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${writing.pct}%`,
                height: '100%',
                background: 'var(--signal)',
              }}
            />
          </span>
        </div>
      </div>
    );
  }

  // 3. Databases & Storage: Architectural Balance (Design & Support)
  if (data.design && data.support) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--text-fine)',
          color: 'var(--ink-bright)',
          fontWeight: 500,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }}>📐</span>
          <span style={{ color: '#67e8f9' }}>Design: {String(data.design)}</span>
        </span>
        <span style={{ opacity: 0.3, color: 'var(--ink-faint)' }}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }}>🛠️</span>
          <span style={{ color: '#2dd4bf' }}>Support: {String(data.support)}</span>
        </span>
      </div>
    );
  }

  // 4. DevOps & Containers: Operational Scale (Handling)
  if (data.handling) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--text-fine)',
          color: '#38bdf8',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '11px', lineHeight: 1 }}>☸️</span>
        <span>Fleet Handling: {String(data.handling)}</span>
      </div>
    );
  }

  // 5. Message Brokers & Event Streams: Signal Throughput (Proficiency)
  if (data.proficiency) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--text-fine)',
          color: 'var(--signal)',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '11px', lineHeight: 1 }}>📡</span>
        <span>Stream Pub/Sub: {String(data.proficiency)} ★</span>
      </div>
    );
  }

  // 6. AI/ML & Deep Learning Runtimes: Neural Acceleration Level
  if (data.level) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '4px 8px',
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--text-fine)',
          color: '#f43f5e',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '11px', lineHeight: 1 }}>🧠</span>
        <span>Neural Inference: {String(data.level)}</span>
      </div>
    );
  }

  return null;
}
