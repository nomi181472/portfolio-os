'use client';

/**
 * components/p2p/DirectChatPanel.tsx
 *
 * Client component for visitor-to-owner direct communication over WebRTC RTCDataChannel.
 * Visitors introduce their name first to open their private, encrypted chatroom.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { PeerClient } from '@/lib/p2p/peerClient';
import type { ConnectionState, P2PMessage, PresenceStatus } from '@/lib/p2p/types';
import { ReceiptTicks } from './ReceiptTicks';
import { VoiceRecorderButton } from './VoiceRecorderButton';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import styles from './DirectChatPanel.module.css';

interface DirectChatPanelProps {
  onSwitchToAssistant?: () => void;
  ownerName?: string;
}

export function DirectChatPanel({
  onSwitchToAssistant,
  ownerName: initialOwnerName,
}: DirectChatPanelProps) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>(initialOwnerName || 'Host');
  const [presence, setPresence] = useState<PresenceStatus>('offline');
  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [messages, setMessages] = useState<P2PMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [pingSent, setPingSent] = useState(false);

  // Visitor identity
  const [visitorId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'visitor_init';
    let stored = sessionStorage.getItem('portfolio_p2p_visitor_id');
    if (!stored) {
      stored = `visitor_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('portfolio_p2p_visitor_id', stored);
    }
    return stored;
  });

  const [visitorName, setVisitorName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('portfolio_p2p_visitor_name') || '';
  });

  const [nameInput, setNameInput] = useState('');

  const clientRef = useRef<PeerClient | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch channel discovery info
  useEffect(() => {
    let active = true;
    fetch('/api/p2p/channel')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setChannelId(data.channelId);
        if (data.ownerName) setOwnerName(data.ownerName);
      })
      .catch((err) => console.warn('[P2P] Channel discovery error', err));

    return () => {
      active = false;
    };
  }, []);

  // 2. Initialize PeerClient when channelId is ready
  useEffect(() => {
    if (!channelId) return;

    const client = new PeerClient({
      channelId,
      role: 'visitor',
      clientId: visitorId,
      senderName: visitorName || undefined,
      onMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
        // Send receipt back to host immediately
        const isFocused = typeof document !== 'undefined' ? document.hasFocus() : true;
        client.sendReceipt([msg.id], isFocused ? 'read' : 'delivered');
      },
      onReceipt: (messageIds, status) => {
        const idSet = new Set(messageIds);
        setMessages((prev) =>
          prev.map((msg) => {
            if (!idSet.has(msg.id)) return msg;
            if (status === 'read') return { ...msg, status: 'read' };
            if (status === 'delivered' && (!msg.status || msg.status === 'sent')) {
              return { ...msg, status: 'delivered' };
            }
            return msg;
          })
        );
      },
      onStateChange: (state) => {
        setConnState(state);
      },
      onPresenceChange: (status) => {
        setPresence(status);
      },
    });

    clientRef.current = client;

    // Check host presence and attempt initial connection
    void client.checkPresence().then((status) => {
      setPresence(status);
      void client.connect();
    });

    // Presence polling interval
    const presenceTimer = setInterval(() => {
      void client.checkPresence();
    }, 12_000);

    return () => {
      clearInterval(presenceTimer);
      client.disconnect();
      clientRef.current = null;
    };
  }, [channelId, visitorId, visitorName]);

  // Mark received host messages as read when visitor returns to tab
  useEffect(() => {
    const handleFocus = () => {
      if (!clientRef.current) return;
      const hostMsgIds = messages
        .filter((m) => m.sender === 'host')
        .map((m) => m.id);
      if (hostMsgIds.length > 0) {
        clientRef.current.sendReceipt(hostMsgIds, 'read');
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, connState]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    sessionStorage.setItem('portfolio_p2p_visitor_name', trimmed);
    setVisitorName(trimmed);
    if (clientRef.current) {
      clientRef.current.setSenderName(trimmed);
    }
  };

  const handleSend = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const text = inputVal.trim();
      if (!text || !clientRef.current) return;

      const sent = clientRef.current.sendMessage(text, false, visitorName);
      if (sent) {
        setMessages((prev) => [...prev, sent]);
        setInputVal('');
      }
    },
    [inputVal, visitorName]
  );

  const handleSendAudio = useCallback(
    (audioData: string, duration: number) => {
      if (!clientRef.current) return;
      const sent = clientRef.current.sendAudioMessage(audioData, duration, visitorName);
      if (sent) {
        setMessages((prev) => [...prev, sent]);
      }
    },
    [visitorName]
  );

  const handlePingHost = useCallback(async () => {
    if (!clientRef.current || pingSent) return;
    setPingSent(true);
    await clientRef.current.pingHostPhone();
    setTimeout(() => setPingSent(false), 30_000);
  }, [pingSent]);

  return (
    <div className={styles.container}>
      {/* Presence Header */}
      <div className={styles.presenceBar}>
        <div className={styles.presenceStatus}>
          <span
            className={`${styles.dot} ${
              connState === 'connected'
                ? styles.dotOnline
                : presence === 'online'
                ? styles.dotOnline
                : presence === 'away'
                ? styles.dotAway
                : connState === 'connecting'
                ? styles.dotConnecting
                : styles.dotOffline
            }`}
          />
          <span>
            {connState === 'connected'
              ? `Connected directly with ${ownerName}`
              : presence === 'online'
              ? `${ownerName} is Live Online`
              : presence === 'away'
              ? `${ownerName} is Away (Screen asleep)`
              : `${ownerName} is currently Offline`}
          </span>
        </div>

        <div className={styles.presenceActions}>
          <Link
            href="/direct"
            className={styles.hostLink}
            title="Are you the portfolio owner? Click to enter Host Receiver Portal"
            target="_blank"
          >
            🔑 Host (/direct)
          </Link>
          {presence !== 'online' && connState !== 'connected' ? (
            <button
              type="button"
              className={styles.pingButton}
              onClick={handlePingHost}
              disabled={pingSent}
              title="Sends a notification ping to wake up mobile tab"
            >
              {pingSent ? 'Ping Dispatched ✓' : '🔔 Wake Mobile'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Security Status */}
      <div className={styles.securityBadge}>
        <svg
          className={styles.lockIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>
          Private Room #{visitorId.replace('visitor_', '').slice(0, 4).toUpperCase()} (DTLS-SRTP E2EE · 0 Server Storage)
        </span>
      </div>

      {/* Step 1: Tell your name first */}
      {!visitorName ? (
        <div className={styles.introCard}>
          <div className={styles.introIcon}>👋</div>
          <h3 className={styles.introTitle}>Direct Line to {ownerName}</h3>
          <p className={styles.introSubtitle}>
            Please introduce yourself to start a private, encrypted conversation directly with {ownerName}.
          </p>

          <form onSubmit={handleSaveName} className={styles.introForm}>
            <input
              type="text"
              className={styles.textInput}
              placeholder="Your Name (e.g. Sarah / Recruiter)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
              required
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={!nameInput.trim()}
            >
              Start Direct Chat →
            </button>
          </form>

          {onSwitchToAssistant ? (
            <button
              type="button"
              className={styles.pingButton}
              style={{ marginTop: '10px' }}
              onClick={onSwitchToAssistant}
            >
              Switch to AI Assistant instead
            </button>
          ) : null}

          <div className={styles.hostIntroNote}>
            <span>Are you the portfolio owner?</span>
            <Link href="/direct" className={styles.hostIntroLink} target="_blank">
              Open Host Mode (/direct) →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Active Name Banner */}
          <div className={styles.nameBadge}>
            <span>
              Chatting as <strong>{visitorName}</strong>
            </span>
            <button
              type="button"
              className={styles.changeNameBtn}
              onClick={() => {
                setNameInput(visitorName);
                setVisitorName('');
              }}
            >
              Change Name
            </button>
          </div>

          {/* Message Stream */}
          <div className={styles.messages} ref={logRef}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>Welcome, {visitorName}!</p>
                <p>
                  Send a direct message below. Your conversation is private and delivered directly to {ownerName}.
                </p>
                {onSwitchToAssistant ? (
                  <button
                    type="button"
                    className={styles.pingButton}
                    style={{ marginTop: '12px' }}
                    onClick={onSwitchToAssistant}
                  >
                    Switch to AI Assistant instead
                  </button>
                ) : null}
              </div>
            ) : null}

            {messages.map((msg) => {
              const isVisitor = msg.sender === 'visitor';
              return (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${
                    isVisitor ? styles.messageVisitor : styles.messageHost
                  }`}
                >
                  <div
                    className={`${styles.messageBubble} ${
                      isVisitor ? styles.bubbleVisitor : styles.bubbleHost
                    } ${msg.audioData ? styles.audioBubble : ''}`}
                  >
                    {msg.audioData ? (
                      <VoiceMessagePlayer
                        audioData={msg.audioData}
                        duration={msg.audioDuration}
                        isSender={isVisitor}
                      />
                    ) : (
                      msg.text
                    )}
                  </div>
                  <div className={styles.messageMeta}>
                    <span>{isVisitor ? msg.senderName || 'You' : ownerName}</span>
                    <span>·</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isVisitor ? <ReceiptTicks status={msg.status} /> : null}
                    {!isVisitor && msg.verified ? (
                      <span className={styles.verifiedBadge} title="Verified using owner's secret HMAC key">
                        ✓ Verified Owner
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input bar */}
          <form className={styles.inputBar} onSubmit={handleSend}>
            <input
              type="text"
              className={styles.textInput}
              placeholder={
                connState === 'connected'
                  ? `Message ${ownerName} directly (P2P)…`
                  : `Message ${ownerName} directly…`
              }
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <VoiceRecorderButton onSendAudio={handleSendAudio} />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={!inputVal.trim()}
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
