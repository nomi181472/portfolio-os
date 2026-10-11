'use client';

/**
 * app/direct/page.tsx
 *
 * Dedicated Multi-Visitor Host Receiver Dashboard for Portfolio OS.
 * Supports N concurrent visitors with isolated, private chatrooms.
 * When the host replies, the message is routed strictly to that specific visitor.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  clearHostCredentials,
  deriveChannelId,
  getStoredHostCredentials,
  storeHostCredentials,
} from '@/lib/p2p/crypto';
import { HostMultiPeerManager } from '@/lib/p2p/hostManager';
import type { VisitorSession } from '@/lib/p2p/types';
import { ReceiptTicks } from '@/components/p2p/ReceiptTicks';
import { VoiceRecorderButton } from '@/components/p2p/VoiceRecorderButton';
import { VoiceMessagePlayer } from '@/components/p2p/VoiceMessagePlayer';
import { useAppearance } from '@/components/theme/AppearanceProvider';
import styles from './page.module.css';

/**
 * Synthesizes an alert chime using the browser's Web Audio API.
 */
function playChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 80, 150]);
    }
  } catch {}
}

const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export default function DirectHostPage() {
  const { appearance } = useAppearance();
  const [email, setEmail] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [expectedChannel, setExpectedChannel] = useState<{
    channelId: string;
    ownerName: string;
    emailMasked: string;
  } | null>(null);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'rooms' | 'chat'>('rooms');
  const [replyText, setReplyText] = useState('');

  // Mobile background & persistent host state
  const [backgroundAudioActive, setBackgroundAudioActive] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [showAndroidTips, setShowAndroidTips] = useState(false);

  const managerRef = useRef<HostMultiPeerManager | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Background Audio Keep-Alive for Android / mobile browsers
  const enableBackgroundAudio = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      if (!audioRef.current) {
        const audio = new Audio(SILENT_AUDIO_URI);
        audio.loop = true;
        audio.volume = 0.01;
        audioRef.current = audio;
      }
      await audioRef.current.play();
      setBackgroundAudioActive(true);

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Portfolio OS — Host Online',
          artist: 'Direct Line Active',
          album: 'Listening for visitor chats in background',
          artwork: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        });
        navigator.mediaSession.setActionHandler('play', () => {
          audioRef.current?.play().catch(() => {});
          setBackgroundAudioActive(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioRef.current?.pause();
          setBackgroundAudioActive(false);
        });
      }
    } catch (err) {
      console.warn('[DirectHostPage] Background audio activation note:', err);
    }
  }, []);

  const disableBackgroundAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setBackgroundAudioActive(false);
  }, []);

  const toggleBackgroundAudio = useCallback(async () => {
    if (backgroundAudioActive) {
      disableBackgroundAudio();
    } else {
      await enableBackgroundAudio();
    }
  }, [backgroundAudioActive, disableBackgroundAudio, enableBackgroundAudio]);

  // Screen Wake Lock API (keeps screen awake on Android desk stand/dock)
  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        if (wakeLockRef.current === sentinel) {
          wakeLockRef.current = null;
        }
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
    setWakeLockActive(false);
  }, []);

  const toggleWakeLock = useCallback(async () => {
    if (wakeLockActive) {
      await releaseWakeLock();
    } else {
      await acquireWakeLock();
    }
  }, [wakeLockActive, releaseWakeLock, acquireWakeLock]);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    } catch {}
  }, []);

  // Check Wake Lock & Notification capabilities on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      setWakeLockSupported(true);
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Restore screen wake lock when returning to visible state if it was active
  useEffect(() => {
    const handleVisibility = () => {
      if (wakeLockActive && document.visibilityState === 'visible' && !wakeLockRef.current) {
        void acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [wakeLockActive, acquireWakeLock]);

  // Clean up wake lock and background audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  // 1. Fetch public channel discovery info & check for stored credentials on mount
  useEffect(() => {
    fetch('/api/p2p/channel')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.channelId) {
          setExpectedChannel(data);
        }
      })
      .catch((err) => console.warn('[DirectHostPage] Failed to fetch channel info', err));

    const creds = getStoredHostCredentials();
    if (creds && creds.email && creds.secretKey) {
      setEmail(creds.email);
      setSecretKey(creds.secretKey);
      void (async () => {
        const cid = await deriveChannelId(creds.email);
        try {
          const verifyRes = await fetch('/api/p2p/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'verify-host',
              channelId: cid,
              email: creds.email,
              secretKey: creds.secretKey,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            void startHostSession(creds.email, creds.secretKey);
          } else {
            clearHostCredentials();
            setMismatchError(verifyData.error || 'Saved credentials are no longer valid. Please log in again.');
          }
        } catch {
          void startHostSession(creds.email, creds.secretKey);
        }
      })();
    }
  }, []);

  // Mark incoming messages as read when host returns to tab
  useEffect(() => {
    const handleFocus = () => {
      if (managerRef.current) {
        managerRef.current.markActiveVisitorMessagesRead();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // 2. Start Host Session
  const startHostSession = async (userEmail: string, key?: string) => {
    if (!userEmail.trim()) return;

    const cid = await deriveChannelId(userEmail);
    setChannelId(cid);
    setAuthenticated(true);

    // Auto-enable background keep-alive audio
    void enableBackgroundAudio();

    if (managerRef.current) {
      managerRef.current.disconnect();
    }

    const manager = new HostMultiPeerManager({
      channelId: cid,
      secretKey: key || secretKey,
      onSessionsChange: (updatedSessions) => {
        setSessions(updatedSessions);
        // Automatically select first room if none is currently selected
        setActiveSessionId((current) => {
          if (current && updatedSessions.some((s) => s.id === current)) {
            return current;
          }
          return updatedSessions.length > 0 ? (updatedSessions[0]?.id ?? null) : null;
        });
      },
      onNewMessage: (visitorId, msg) => {
        playChime();
        // Highlight active session
        setActiveSessionId((current) => {
          if (!current) return visitorId;
          return current;
        });

        // If screen is off or app is in background, dispatch native notification
        if (typeof document !== 'undefined' && document.hidden) {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const senderName = msg.senderName || 'Visitor';
            const body = msg.text || (msg.audioData ? '🎤 Voice note received' : 'New message received');
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(`Direct Chat: ${senderName}`, {
                  body,
                  icon: '/icons/icon-192.png',
                  badge: '/bot.svg',
                  tag: `direct-msg-${visitorId}`,
                  data: { url: '/direct' },
                });
              }).catch(() => {});
            } else {
              try {
                new Notification(`Direct Chat: ${senderName}`, {
                  body,
                  icon: '/icons/icon-192.png',
                  tag: `direct-msg-${visitorId}`,
                });
              } catch {}
            }
          }
        }
      },
    });

    managerRef.current = manager;
    manager.start();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMismatchError(null);
    const cleanEmail = email.trim();
    const cleanSecret = secretKey.trim();
    if (!cleanEmail || !cleanSecret) return;

    setSubmitting(true);
    try {
      const cid = expectedChannel?.channelId || (await deriveChannelId(cleanEmail));

      // 1. Verify channel derivation against registered portfolio email
      if (expectedChannel?.channelId) {
        const derived = await deriveChannelId(cleanEmail);
        if (derived !== expectedChannel.channelId) {
          setMismatchError(
            `Invalid email: does not match the registered portfolio email (${expectedChannel.emailMasked}).`
          );
          setSubmitting(false);
          return;
        }
      }

      // 2. Strictly verify credentials against server environment variables
      const verifyRes = await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-host',
          channelId: cid,
          email: cleanEmail,
          secretKey: cleanSecret,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setMismatchError(verifyData.error || 'Invalid email or secret key. Please check your credentials.');
        setSubmitting(false);
        return;
      }

      storeHostCredentials(cleanEmail, cleanSecret, remember);
      await startHostSession(cleanEmail, cleanSecret);
    } catch {
      setMismatchError('Failed to verify credentials. Please check your network connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearHostCredentials();
    disableBackgroundAudio();
    void releaseWakeLock();
    if (managerRef.current) {
      managerRef.current.disconnect();
      managerRef.current = null;
    }
    setAuthenticated(false);
    setSecretKey('');
    setChannelId(null);
    setSessions([]);
    setActiveSessionId(null);
    setMobileView('rooms');
  };

  const handleSelectRoom = (visitorId: string) => {
    setActiveSessionId(visitorId);
    setMobileView('chat');
    if (managerRef.current) {
      managerRef.current.setActiveVisitor(visitorId);
    }
  };

  const handleCloseRoom = (visitorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (managerRef.current) {
      managerRef.current.closeSession(visitorId);
    }
  };

  const handleSendReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSessionId || !managerRef.current) return;
    const text = replyText.trim();
    if (!text) return;

    // Dispatches message STRICTLY to this visitor session
    managerRef.current.sendReplyToVisitor(activeSessionId, text, true);
    setReplyText('');
  };

  const handleSendAudioReply = useCallback(
    (audioData: string, duration: number) => {
      if (!activeSessionId || !managerRef.current) return;
      managerRef.current.sendAudioReplyToVisitor(activeSessionId, audioData, duration, true);
    },
    [activeSessionId]
  );

  // Auto-scroll chat log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div className={styles.wrapper} data-appearance={appearance}>
      {!authenticated ? (
        <div className={styles.loginCard}>
          <h1 className={styles.title}>Direct Line Host Login</h1>
          <p className={styles.subtitle}>
            Enter your credentials to manage your live multi-visitor chatrooms.
            Leave this page open (or saved as PWA) to receive direct P2P messages from visitors.
          </p>

          <form className={styles.form} onSubmit={handleLogin}>
            {expectedChannel ? (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--fill-faint)',
                  border: '1px solid var(--rule)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--ink-bright)' }}>
                  Target Portfolio: {expectedChannel.ownerName}
                </div>
                <div style={{ color: 'var(--ink-quiet)', fontSize: '0.75rem', marginTop: '2px' }}>
                  Registered Channel Email: <code>{expectedChannel.emailMasked}</code>
                </div>
              </div>
            ) : null}

            {mismatchError ? (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.8125rem',
                  lineHeight: 1.4,
                }}
              >
                {mismatchError}
              </div>
            ) : null}

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email Address</label>
              <input
                type="email"
                className={styles.input}
                placeholder={expectedChannel?.emailMasked || 'user@example.com'}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (mismatchError) setMismatchError(null);
                }}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Secret Key / Passphrase</label>
              <input
                type="password"
                className={styles.input}
                placeholder="Your secret key"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                required
              />
            </div>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember credentials on this device</span>
            </label>

            <button type="submit" className={styles.buttonPrimary} disabled={submitting}>
              {submitting ? 'Verifying Credentials…' : 'Activate Direct Line (Host Mode)'}
            </button>
          </form>

          <div style={{ marginTop: '12px', fontSize: '0.8125rem' }}>
            <Link href="/" style={{ color: 'var(--ink-quiet)' }}>
              ← Return to Portfolio OS
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Header Bar */}
          <div className={styles.headerBar}>
            <div className={styles.statusIndicator}>
              <span className={styles.dotLive} />
              <strong>
                Host Online · {sessions.length} Active {sessions.length === 1 ? 'Room' : 'Rooms'}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={playChime}
                title="Test notification chime"
              >
                🔔 Test Sound
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Controls Bar for Background & Mobile Host */}
          <div className={styles.controlBar}>
            <div className={styles.controlGroup}>
              {/* Background Audio Keep-Alive */}
              <button
                type="button"
                className={`${styles.toggleBtn} ${
                  backgroundAudioActive ? styles.toggleBtnActive : ''
                }`}
                onClick={toggleBackgroundAudio}
                title="Keeps Android browser alive in background via silent audio loop and MediaSession"
              >
                <span>{backgroundAudioActive ? '🟢' : '⚪'}</span>
                <span>
                  Background Mode: {backgroundAudioActive ? 'Active' : 'Paused'}
                </span>
              </button>

              {/* Screen Wake Lock */}
              {wakeLockSupported ? (
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${
                    wakeLockActive ? styles.toggleBtnActive : ''
                  }`}
                  onClick={toggleWakeLock}
                  title="Prevents phone screen from turning off (Desk/Dock mode)"
                >
                  <span>{wakeLockActive ? '☀️' : '🌙'}</span>
                  <span>
                    Keep Screen On: {wakeLockActive ? 'Active' : 'Off'}
                  </span>
                </button>
              ) : null}

              {/* Push Notifications */}
              {notificationPermission !== 'granted' ? (
                <button
                  type="button"
                  className={styles.toggleBtn}
                  onClick={requestNotificationPermission}
                  title="Allow browser notifications for new messages while screen is off"
                >
                  <span>🔔</span>
                  <span>Enable Push Alerts</span>
                </button>
              ) : (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#10b981',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                  }}
                  title="Browser notifications granted"
                >
                  ✓ Alerts Enabled
                </span>
              )}
            </div>

            <button
              type="button"
              className={styles.tipsToggleBtn}
              onClick={() => setShowAndroidTips((prev) => !prev)}
            >
              {showAndroidTips ? 'Hide Android Setup ▲' : '📱 Android Background Setup ▼'}
            </button>
          </div>

          {/* Android Background Tips Drawer */}
          {showAndroidTips ? (
            <div className={styles.tipsCard}>
              <h4>📱 Keeping Host Mode Online 24/7 on Android</h4>
              <ol className={styles.tipsList}>
                <li>
                  <strong>Set Battery to Unrestricted:</strong> Long press the Portfolio OS app icon → <em>App info</em> → <em>Battery</em> → Select <strong>Unrestricted</strong>. This prevents Android OS from putting the app to sleep in the background.
                </li>
                <li>
                  <strong>Lock in Recent Apps:</strong> Open the Android App Switcher (swipe up and hold), tap the app menu or icon, and choose <strong>Lock</strong> (padlock icon) so Android never closes it.
                </li>
                <li>
                  <strong>Background Mode (Active):</strong> Keep the <em>Background Mode</em> toggle above active. It runs an inaudible audio loop + Media Session that signals Android to maintain active WebRTC and network heartbeats even with the screen locked.
                </li>
                <li>
                  <strong>Deep Wakeup Push (ntfy.sh):</strong> To wake your phone even after device restarts, set <code>P2P_ALERT_WEBHOOK_URL</code> in your deployment environment to a free <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink-bright)', textDecoration: 'underline' }}>ntfy.sh</a> topic URL.
                </li>
              </ol>
            </div>
          ) : null}

          {/* Two-Column Dashboard (Desktop/Tablet) or Drill-down (Mobile) */}
          <div
            className={`${styles.dashboardGrid} ${
              mobileView === 'rooms' ? styles.showRoomsMobile : styles.showChatMobile
            }`}
          >
            {/* Left Column: Chatrooms Switcher */}
            <aside className={styles.roomsSidebar}>
              <div className={styles.sidebarHead}>
                <span>VISITOR CHATROOMS ({sessions.length})</span>
              </div>

              <div className={styles.roomsList}>
                {sessions.length === 0 ? (
                  <div className={styles.emptyRooms}>
                    <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                      Listening for visitors…
                    </p>
                    <p style={{ fontSize: '0.8125rem' }}>
                      When a visitor sends a message, their private chatroom will appear here.
                    </p>
                  </div>
                ) : null}

                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const lastMsg =
                    session.messages.length > 0
                      ? session.messages[session.messages.length - 1]
                      : null;

                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={`${styles.roomCard} ${
                        isActive ? styles.roomCardActive : ''
                      }`}
                      onClick={() => handleSelectRoom(session.id)}
                    >
                      <div className={styles.roomCardHead}>
                        <span className={styles.roomLabel}>
                          {session.label}
                          {session.p2pConnected ? (
                            <span className={styles.p2pBadge} title="WebRTC P2P DataChannel Active">
                              ⚡
                            </span>
                          ) : null}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {session.unreadCount > 0 ? (
                            <span className={styles.roomCardBadge}>
                              {session.unreadCount}
                            </span>
                          ) : null}
                          <span className={styles.roomTime}>
                            {new Date(session.lastActivity).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span
                            onClick={(e) => handleCloseRoom(session.id, e)}
                            title="End room"
                            style={{
                              marginLeft: 4,
                              opacity: 0.5,
                              cursor: 'pointer',
                              padding: '0 4px',
                            }}
                          >
                            ×
                          </span>
                        </div>
                      </div>

                      <div className={styles.roomCardSnippet}>
                        {lastMsg ? (
                          <span>
                            {lastMsg.sender === 'host' ? 'You: ' : ''}
                            {lastMsg.text}
                          </span>
                        ) : (
                          <span style={{ fontStyle: 'italic' }}>New connection initiated…</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Column: Active Chat Surface */}
            <main className={styles.chatArea}>
              {activeSession ? (
                <>
                  <div className={styles.chatAreaHead}>
                    <div className={styles.chatHeadInfo}>
                      <button
                        type="button"
                        className={styles.mobileBackBtn}
                        onClick={() => setMobileView('rooms')}
                        title="Back to visitor chatrooms list"
                      >
                        ← Rooms
                      </button>
                      <div>
                        <h2 className={styles.chatAreaTitle}>
                          <span>{activeSession.label}</span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              color: activeSession.p2pConnected ? '#10b981' : '#f59e0b',
                            }}
                          >
                            {activeSession.p2pConnected
                              ? '⚡ Direct WebRTC P2P (E2EE)'
                              : '⚡ Ephemeral Relay (Connecting P2P…)'}
                          </span>
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
                          Private Channel (Visible ONLY to this visitor)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.messagesLog} ref={logRef}>
                    {activeSession.messages.length === 0 ? (
                      <div
                        style={{
                          margin: 'auto',
                          textAlign: 'center',
                          color: 'var(--ink-quiet)',
                        }}
                      >
                        <p style={{ fontWeight: 600, color: 'var(--ink-bright)' }}>
                          Private Chatroom Opened
                        </p>
                        <p style={{ fontSize: '0.875rem' }}>
                          Replies sent here are strictly delivered to {activeSession.label}.
                        </p>
                      </div>
                    ) : null}

                    {activeSession.messages.map((msg) => {
                      const isHost = msg.sender === 'host';
                      return (
                        <div
                          key={msg.id}
                          className={`${styles.messageRow} ${
                            isHost ? styles.rowHost : styles.rowVisitor
                          }`}
                        >
                          <div
                            className={`${styles.bubble} ${
                              isHost ? styles.bubbleHost : styles.bubbleVisitor
                            } ${msg.audioData ? styles.audioBubble : ''}`}
                          >
                            {msg.audioData ? (
                              <VoiceMessagePlayer
                                audioData={msg.audioData}
                                duration={msg.audioDuration}
                                isSender={isHost}
                              />
                            ) : (
                              msg.text
                            )}
                          </div>
                          <div className={styles.messageMeta}>
                            <span>{isHost ? 'You' : msg.senderName || activeSession.label}</span>
                            <span>·</span>
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isHost ? <ReceiptTicks status={msg.status} /> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form className={styles.inputRow} onSubmit={handleSendReply}>
                    <input
                      type="text"
                      className={styles.input}
                      style={{ flex: 1, minWidth: 0 }}
                      placeholder={`Reply strictly to ${activeSession.label}…`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <VoiceRecorderButton onSendAudio={handleSendAudioReply} />
                    <button
                      type="submit"
                      className={styles.buttonPrimary}
                      disabled={!replyText.trim()}
                    >
                      Send Reply
                    </button>
                  </form>
                </>
              ) : (
                <div
                  style={{
                    margin: 'auto',
                    textAlign: 'center',
                    padding: 'var(--space)',
                    color: 'var(--ink-quiet)',
                  }}
                >
                  <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink-bright)' }}>
                    No Active Chatroom Selected
                  </p>
                  <p style={{ fontSize: '0.875rem', maxWidth: 360, margin: '8px auto' }}>
                    When visitors on your portfolio open the Direct Message tab, their individual
                    chatrooms will appear in the sidebar on the left.
                  </p>
                  <button
                    type="button"
                    className={styles.mobileBackBtn}
                    onClick={() => setMobileView('rooms')}
                    style={{ marginTop: 12 }}
                  >
                    ← View Visitor Rooms ({sessions.length})
                  </button>
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}
