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

export default function DirectHostPage() {
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

  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'rooms' | 'chat'>('rooms');
  const [replyText, setReplyText] = useState('');

  const managerRef = useRef<HostMultiPeerManager | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

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
      void startHostSession(creds.email);
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
  const startHostSession = async (userEmail: string) => {
    if (!userEmail.trim()) return;

    const cid = await deriveChannelId(userEmail);
    setChannelId(cid);
    setAuthenticated(true);

    if (managerRef.current) {
      managerRef.current.disconnect();
    }

    const manager = new HostMultiPeerManager({
      channelId: cid,
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
      onNewMessage: (visitorId) => {
        playChime();
        // Highlight active session
        setActiveSessionId((current) => {
          if (!current) return visitorId;
          return current;
        });
      },
    });

    managerRef.current = manager;
    manager.start();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMismatchError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !secretKey.trim()) return;

    if (expectedChannel?.channelId) {
      const derived = await deriveChannelId(cleanEmail);
      if (derived !== expectedChannel.channelId) {
        setMismatchError(
          `The entered email does not match the active portfolio email (${expectedChannel.emailMasked}). Visitors are connecting to channel ID ${expectedChannel.channelId.slice(0, 8)}…, so you will not receive their messages unless you use your registered portfolio email.`
        );
        return;
      }
    }

    storeHostCredentials(cleanEmail, secretKey, remember);
    await startHostSession(cleanEmail);
  };

  const handleLogout = () => {
    clearHostCredentials();
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
    <div className={styles.wrapper}>
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
                  background: 'var(--surface-sunken, rgba(255,255,255,0.04))',
                  border: '1px solid var(--line, rgba(255,255,255,0.08))',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  Target Portfolio: {expectedChannel.ownerName}
                </div>
                <div style={{ color: 'var(--ink-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
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

            <button type="submit" className={styles.buttonPrimary}>
              Activate Direct Line (Host Mode)
            </button>
          </form>

          <div style={{ marginTop: '12px', fontSize: '0.8125rem' }}>
            <Link href="/" style={{ color: 'var(--ink-secondary, #9ca3af)' }}>
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
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink-secondary, #9ca3af)' }}>
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
                          color: 'var(--ink-secondary, #9ca3af)',
                        }}
                      >
                        <p style={{ fontWeight: 600, color: 'var(--ink)' }}>
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
                    color: 'var(--ink-secondary, #9ca3af)',
                  }}
                >
                  <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
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
