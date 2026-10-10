'use client';

/**
 * components/p2p/VoiceRecorderButton.tsx
 *
 * Click & Hold audio voice recorder for direct P2P communication.
 * Supports:
 * 1. Hold-to-record & release to send (WhatsApp / Telegram style)
 * 2. Tap-to-record with hands-free lock mode (with explicit Send and Cancel buttons)
 * 3. Encodes to browser-native Opus/WebM/MP4 Base64 Data URL
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './VoiceRecorderButton.module.css';

interface VoiceRecorderButtonProps {
  onSendAudio: (audioData: string, durationSeconds: number) => void;
  disabled?: boolean;
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function VoiceRecorderButton({ onSendAudio, disabled = false }: VoiceRecorderButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const isHoldingRef = useRef<boolean>(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || isRecording) return;
    cancelledRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopTracks();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setIsRecording(false);
        setIsLocked(false);
        setRecordSeconds(0);

        if (cancelledRef.current) {
          chunksRef.current = [];
          return;
        }

        const totalDuration = (Date.now() - startTimeRef.current) / 1000;
        if (totalDuration < 0.6) {
          // Micro-tap discarded
          chunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (audioBlob.size > 0) {
          try {
            const base64 = await blobToBase64(audioBlob);
            onSendAudio(base64, totalDuration);
          } catch (err) {
            console.warn('[VoiceRecorder] Base64 encoding error', err);
          }
        }
      };

      recorder.start(150); // collect slice every 150ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordSeconds(elapsed);
        // Automatic safety cap at 2 minutes
        if (elapsed >= 120 && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 500);
    } catch (err) {
      console.warn('[VoiceRecorder] Mic access denied or unavailable', err);
      setHasPermission(false);
      stopTracks();
      setIsRecording(false);
    }
  }, [disabled, isRecording, onSendAudio, stopTracks]);

  const stopAndSend = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      cancelledRef.current = false;
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      stopTracks();
      setIsRecording(false);
      setIsLocked(false);
      setRecordSeconds(0);
    }
  }, [stopTracks]);

  // Pointer Down: Start hold
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || isRecording) return;
      e.preventDefault();
      isHoldingRef.current = true;
      void startRecording();

      const onGlobalPointerUp = () => {
        window.removeEventListener('pointerup', onGlobalPointerUp);
        window.removeEventListener('pointercancel', onGlobalPointerCancel);

        if (!isHoldingRef.current) return;
        isHoldingRef.current = false;

        const heldDuration = (Date.now() - startTimeRef.current) / 1000;
        if (heldDuration >= 0.6) {
          // Released after holding -> Send voice note!
          stopAndSend();
        } else {
          // Quick tap -> switch to hands-free locked recording mode
          setIsLocked(true);
        }
      };

      const onGlobalPointerCancel = () => {
        window.removeEventListener('pointerup', onGlobalPointerUp);
        window.removeEventListener('pointercancel', onGlobalPointerCancel);
        isHoldingRef.current = false;
        cancelRecording();
      };

      window.addEventListener('pointerup', onGlobalPointerUp);
      window.addEventListener('pointercancel', onGlobalPointerCancel);
    },
    [disabled, isRecording, startRecording, stopAndSend, cancelRecording]
  );

  if (isRecording) {
    return (
      <div className={styles.activeRecordingOverlay}>
        <div className={styles.recordingPill}>
          <span className={styles.recordingDot} />
          <span className={styles.recordingTimer}>{formatDuration(recordSeconds)}</span>
          <div className={styles.soundWaves}>
            <span className={styles.waveBar} />
            <span className={styles.waveBar} />
            <span className={styles.waveBar} />
            <span className={styles.waveBar} />
          </div>
        </div>

        <div className={styles.recordingControls}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={cancelRecording}
            title="Cancel recording (discard)"
          >
            ✕
          </button>

          {isLocked ? (
            <button
              type="button"
              className={styles.sendAudioBtn}
              onClick={stopAndSend}
              title="Send voice note"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <span className={styles.releaseHint}>Release to send</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.micButton} ${disabled ? styles.disabled : ''}`}
      onPointerDown={handlePointerDown}
      title={
        hasPermission === false
          ? 'Microphone access is blocked in browser'
          : 'Click & hold to record voice message (or tap for hands-free)'
      }
      disabled={disabled}
      aria-label="Record voice note"
    >
      <svg
        className={styles.micIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
