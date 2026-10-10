/**
 * app/api/p2p/signal/route.ts
 *
 * Ephemeral signaling relay for WebRTC SDP offer/answer and ICE candidate exchange.
 *
 * Invariants:
 * 1. Zero chat content passes through or is retained in database: chat messages
 *    travel 100% directly between browsers via RTCDataChannel.
 * 2. Signaling payloads are ephemeral in-memory state with a sliding 60-second TTL.
 * 3. Heartbeats track host presence (online / away / offline).
 * 4. Optional wakeup notification: can ping a webhook (Telegram/ntfy/Discord) if configured.
 */

import { NextResponse } from 'next/server';
import type { SignalEnvelope, ChannelPresence } from '@/lib/p2p/types';

// In-memory ephemeral bus: channelId -> SignalEnvelope[]
const signalsByChannel = new Map<string, SignalEnvelope[]>();

// In-memory host presence: channelId -> lastHeartbeatTimestamp
const hostHeartbeats = new Map<string, number>();

// Sliding window TTL
const SIGNAL_TTL_MS = 60_000; // 60 seconds
const HOST_ONLINE_TTL_MS = 45_000; // 45 seconds
const HOST_AWAY_TTL_MS = 180_000; // 3 minutes

/**
 * Prunes expired signals from memory to prevent memory accumulation.
 */
function pruneExpiredSignals(channelId: string) {
  const now = Date.now();
  const list = signalsByChannel.get(channelId);
  if (!list) return;

  const fresh = list.filter((sig) => now - sig.timestamp < SIGNAL_TTL_MS);
  if (fresh.length === 0) {
    signalsByChannel.delete(channelId);
  } else {
    signalsByChannel.set(channelId, fresh);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, channelId } = body;

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid channelId' }, { status: 400 });
    }

    pruneExpiredSignals(channelId);

    // 0. Verify host credentials if P2P_HOST_SECRET is configured
    if (action === 'verify-host') {
      const configuredSecret = process.env.P2P_HOST_SECRET;
      if (!configuredSecret) {
        return NextResponse.json({ ok: true, protected: false });
      }
      const { secretKey } = body;
      if (secretKey && typeof secretKey === 'string' && secretKey.trim() === configuredSecret.trim()) {
        return NextResponse.json({ ok: true, protected: true });
      }
      return NextResponse.json({ error: 'Incorrect secret key or passphrase' }, { status: 401 });
    }

    // 1. Presence check or heartbeat
    if (action === 'host-heartbeat') {
      const configuredSecret = process.env.P2P_HOST_SECRET;
      if (configuredSecret) {
        const { secretKey } = body;
        if (!secretKey || typeof secretKey !== 'string' || secretKey.trim() !== configuredSecret.trim()) {
          return NextResponse.json({ error: 'Unauthorized heartbeat' }, { status: 401 });
        }
      }
      hostHeartbeats.set(channelId, Date.now());
      return NextResponse.json({ ok: true, status: 'online' });
    }

    if (action === 'get-presence') {
      const lastSeen = hostHeartbeats.get(channelId) || 0;
      const now = Date.now();
      const diff = now - lastSeen;

      let status: 'online' | 'away' | 'offline' = 'offline';
      if (lastSeen > 0 && diff < HOST_ONLINE_TTL_MS) {
        status = 'online';
      } else if (lastSeen > 0 && diff < HOST_AWAY_TTL_MS) {
        status = 'away';
      }

      const presence: ChannelPresence = {
        channelId,
        hostOnline: status === 'online',
        lastSeenHost: lastSeen,
        activeVisitors: 0,
      };

      return NextResponse.json({ presence, status });
    }

    // 2. Dispatch a signal (offer, answer, ice-candidate, leave)
    if (action === 'send-signal') {
      const signal: SignalEnvelope = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        channelId,
        from: body.from,
        to: body.to,
        type: body.type,
        payload: body.payload,
        timestamp: Date.now(),
      };

      const current = signalsByChannel.get(channelId) || [];
      current.push(signal);
      signalsByChannel.set(channelId, current);

      return NextResponse.json({ ok: true, signalId: signal.id });
    }

    // 3. Poll for signals addressed to recipient
    if (action === 'poll-signals') {
      const { role, clientId, since } = body;
      const current = signalsByChannel.get(channelId) || [];
      const sinceTs = typeof since === 'number' ? since : 0;

      const matched = current.filter((sig) => {
        const isRecipient =
          sig.to === role ||
          (clientId && sig.to === clientId) ||
          (role === 'host' && (sig.to === 'host' || sig.to === 'all'));
        return isRecipient && sig.timestamp >= sinceTs;
      });

      return NextResponse.json({ signals: matched, serverTime: Date.now() });
    }

    // 4. Ping host's phone (Wakeup via webhook if configured)
    if (action === 'ping-host') {
      const webhookUrl = process.env.P2P_ALERT_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🔔 Portfolio OS: A visitor is waiting for direct P2P chat on your portfolio!`,
              channelId,
              timestamp: new Date().toISOString(),
            }),
          });
          return NextResponse.json({ ok: true, alerted: true });
        } catch (err) {
          console.error('Failed to trigger P2P alert webhook', err);
        }
      }
      return NextResponse.json({ ok: true, alerted: false, note: 'No webhook configured or dispatched' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal signaling error', detail: String(err) }, { status: 500 });
  }
}
