'use client';

/**
 * components/p2p/VoiceMessagePlayer.tsx
 *
 * WhatsApp/Telegram-style Audio Voice Message Player.
 * Renders an interactive waveform scrubber, play/pause controls,
 * elapsed/total duration, and playback speed switcher.
 *
 * Defensive against browser MediaRecorder WebM Opus quirks
 * where audio.duration is reported as Infinity or NaN.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './VoiceMessagePlayer.module.css';

interface VoiceMessagePlayerProps {
  audioData: string;
  duration?: number;
  isSender?: boolean;
}

const WAVE_BAR_HEIGHTS = [
  35, 60, 85, 45, 75, 100, 65, 40, 80, 95, 70, 50, 90, 60, 45, 80, 100, 55, 40, 65,
];

function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function VoiceMessagePlayer({ audioData, duration = 0, isSender = false }: VoiceMessagePlayerProps) {
  const initialDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(initialDuration);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Number.isFinite(duration) && duration > 0 && (!Number.isFinite(totalDuration) || totalDuration <= 0)) {
      setTotalDuration(duration);
    }
  }, [duration, totalDuration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('[VoicePlayer] Playback error', err));
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      if (typeof cur === 'number' && Number.isFinite(cur)) {
        setCurrentTime(cur);
      }
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const d = audio.duration;

    // MediaRecorder WebM streams often report duration as Infinity or NaN in Chromium/Firefox
    if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
      setTotalDuration(d);
    } else if (Number.isFinite(duration) && duration > 0) {
      setTotalDuration(duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = waveformRef.current;
    const audio = audioRef.current;
    if (!container || !audio) return;

    // Resolve a safe, finite duration: prefer finite audio.duration, then totalDuration state, then duration prop
    let safeTotal = 0;
    if (typeof audio.duration === 'number' && Number.isFinite(audio.duration) && audio.duration > 0) {
      safeTotal = audio.duration;
    } else if (typeof totalDuration === 'number' && Number.isFinite(totalDuration) && totalDuration > 0) {
      safeTotal = totalDuration;
    } else if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      safeTotal = duration;
    }

    if (!safeTotal || !Number.isFinite(safeTotal) || safeTotal <= 0) return;

    const rect = container.getBoundingClientRect();
    if (!rect.width || rect.width <= 0) return;

    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const seekTime = percentage * safeTotal;

    // Strictly ensure seekTime is finite floating point value before assigning to audio.currentTime
    if (typeof seekTime === 'number' && Number.isFinite(seekTime) && seekTime >= 0) {
      try {
        audio.currentTime = seekTime;
        setCurrentTime(seekTime);
      } catch (err) {
        console.warn('[VoicePlayer] Failed to seek currentTime', err);
      }
    }
  };

  const safeTotal =
    Number.isFinite(totalDuration) && totalDuration > 0
      ? totalDuration
      : Number.isFinite(duration) && duration > 0
        ? duration
        : 0;

  const progressPercent =
    safeTotal > 0 && Number.isFinite(currentTime)
      ? Math.max(0, Math.min(100, (currentTime / safeTotal) * 100))
      : 0;

  return (
    <div
      className={`${styles.playerContainer} ${
        isSender ? styles.senderPlayer : styles.receiverPlayer
      }`}
    >
      <audio
        ref={audioRef}
        src={audioData}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Play/Pause Button */}
      <button
        type="button"
        className={styles.playButton}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? (
          <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Waveform Scrubber & Metadata */}
      <div className={styles.scrubberArea}>
        <div
          className={styles.waveform}
          ref={waveformRef}
          onClick={handleWaveformClick}
          title="Click to seek"
        >
          {WAVE_BAR_HEIGHTS.map((h, i) => {
            const barPercent = (i / (WAVE_BAR_HEIGHTS.length - 1)) * 100;
            const isFilled = barPercent <= progressPercent;
            return (
              <span
                key={i}
                className={`${styles.bar} ${isFilled ? styles.barFilled : styles.barUnfilled}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        <div className={styles.metaRow}>
          <span className={styles.timeText}>
            {isPlaying ? formatTime(currentTime) : formatTime(safeTotal)}
          </span>

          <button
            type="button"
            className={styles.speedBtn}
            onClick={cycleSpeed}
            title="Toggle playback speed"
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}
