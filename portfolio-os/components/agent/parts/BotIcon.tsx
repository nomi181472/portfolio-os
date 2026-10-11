import React from 'react';
import type { Appearance } from '@/lib/theme';

export function BotIcon({ className, appearance }: { className?: string; appearance?: Appearance }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width="120"
      height="120"
      className={className}
      data-appearance={appearance}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="botSweep" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--ink-bright)" stopOpacity="0" />
          <stop offset="45%" stopColor="var(--ink-bright)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--ink-bright)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--ink-bright)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--ink-bright)" stopOpacity="0" />
        </linearGradient>
        <filter id="botEyeGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="botCircleClip">
          <circle cx="60" cy="60" r="54" />
        </clipPath>
      </defs>

      {/* Outer pulse rings */}
      <circle cx="60" cy="60" r="54" fill="none" stroke="var(--rule-strong)" strokeWidth="1.5" opacity="0">
        <animate attributeName="r" values="54;70;70" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="60" r="54" fill="none" stroke="var(--rule-strong)" strokeWidth="1.5" opacity="0">
        <animate attributeName="r" values="54;70;70" dur="2.6s" begin="0.9s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0" dur="2.6s" begin="0.9s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="60" r="54" fill="none" stroke="var(--rule-strong)" strokeWidth="1.5" opacity="0">
        <animate attributeName="r" values="54;70;70" dur="2.6s" begin="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0" dur="2.6s" begin="1.8s" repeatCount="indefinite" />
      </circle>

      {/* Main circle base */}
      <circle cx="60" cy="60" r="53" fill="var(--surface-raised)" stroke="var(--rule-strong)" strokeWidth="2" />

      {/* Rotating highlight sweep */}
      <g clipPath="url(#botCircleClip)">
        <rect x="-30" y="-30" width="180" height="180" fill="url(#botSweep)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 60"
            to="360 60 60"
            dur="4.5s"
            repeatCount="indefinite"
          />
        </rect>
      </g>

      {/* Antenna */}
      <line x1="60" y1="30" x2="60" y2="40" stroke="var(--ink-bright)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="27" r="3.5" fill="var(--ink-bright)" filter="url(#botEyeGlow)">
        <animate attributeName="r" values="3.5;5;3.5" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.6;1" dur="1.4s" repeatCount="indefinite" />
      </circle>

      {/* Head */}
      <rect x="33" y="40" width="54" height="44" rx="16" fill="none" stroke="var(--ink-bright)" strokeWidth="2.5" />

      {/* Eyes */}
      <g filter="url(#botEyeGlow)">
        <ellipse cx="49" cy="58" rx="6" ry="6" fill="var(--ink-bright)">
          <animate
            attributeName="ry"
            values="6;6;0;0;6;6"
            dur="3.8s"
            repeatCount="indefinite"
            keyTimes="0;0.85;0.9;0.95;0.98;1"
          />
        </ellipse>
        <circle cx="49" cy="58" r="2.4" fill="var(--surface-raised)">
          <animate attributeName="cx" values="49;50.5;47.5;49" dur="3s" repeatCount="indefinite" />
          <animate attributeName="cy" values="58;57.5;58.5;58" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
      <g filter="url(#botEyeGlow)">
        <ellipse cx="71" cy="58" rx="6" ry="6" fill="var(--ink-bright)">
          <animate
            attributeName="ry"
            values="6;6;0;0;6;6"
            dur="3.8s"
            repeatCount="indefinite"
            keyTimes="0;0.85;0.9;0.95;0.98;1"
          />
        </ellipse>
        <circle cx="71" cy="58" r="2.4" fill="var(--surface-raised)">
          <animate attributeName="cx" values="71;72.5;69.5;71" dur="3s" repeatCount="indefinite" />
          <animate attributeName="cy" values="58;57.5;58.5;58" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Mouth */}
      <path d="M50 74 Q60 80 70 74" fill="none" stroke="var(--ink-bright)" strokeWidth="2.5" strokeLinecap="round">
        <animate
          attributeName="d"
          values="M50 74 Q60 80 70 74; M50 75 Q60 72 70 75; M50 74 Q60 80 70 74"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>

      {/* Cheeks */}
      <circle cx="40" cy="68" r="2.5" fill="var(--ink-bright)" filter="url(#botEyeGlow)" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="80" cy="68" r="2.5" fill="var(--ink-bright)" filter="url(#botEyeGlow)" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Notification badge */}
      <g>
        <circle cx="95" cy="25" r="11" fill="var(--ink-bright)" stroke="var(--surface-raised)" strokeWidth="2">
          <animate attributeName="r" values="11;12;11" dur="2s" repeatCount="indefinite" />
        </circle>
        <text
          x="95"
          y="30"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="12"
          fontWeight="700"
          fill="var(--surface-raised)"
        >
          1
        </text>
        <circle cx="95" cy="25" r="11" fill="none" stroke="var(--ink-bright)" strokeWidth="1.5" opacity="0.8">
          <animate attributeName="r" values="11;18;18" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0;0" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
