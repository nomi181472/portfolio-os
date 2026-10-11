/**
 * app/api/p2p/signal/route.ts
 *
 * Ephemeral signaling relay for WebRTC SDP offer/answer and ICE candidate exchange.
 *
 * Invariants:
 * 1. Zero chat content passes through or is retained in database: chat messages
 *    travel 100% directly between browsers via RTCDataChannel.
 * 2. Signaling payloads are ephemeral state with a sliding 60-second TTL.
 * 3. Dual-mode peer discovery:
 *    - Mode A (Stateless Serverless / Vercel): Uses Upstash Redis REST for cross-container
 *      shared signaling state.
 *    - Mode B (Persistent Server / Docker / VPS): Uses zero-dependency in-memory Map bus.
 * 4. Heartbeats track host presence (online / away / offline).
 * 5. Optional wakeup notification: can ping a webhook (Telegram/ntfy/Discord) if configured.
 */

import { NextResponse } from 'next/server';
import type { SignalEnvelope, ChannelPresence } from '@/lib/p2p/types';
import { getSignalingStore } from '@/lib/p2p/signalingStore';

// Sliding window presence TTL
const HOST_ONLINE_TTL_MS = 75_000; // 75 seconds (accommodates mobile background timer jitter)
const HOST_AWAY_TTL_MS = 240_000; // 4 minutes

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, channelId } = body;

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid channelId' }, { status: 400 });
    }

    const store = getSignalingStore();

    // 0. Verify host credentials against P2P_HOST_SECRET and P2P_HOST_EMAIL
    if (action === 'verify-host') {
      const configuredSecret = process.env.P2P_HOST_SECRET?.trim();
      const configuredEmail = process.env.P2P_HOST_EMAIL?.trim();
      const { email, secretKey } = body;

      // 1. Verify email against P2P_HOST_EMAIL if set
      if (configuredEmail) {
        if (!email || typeof email !== 'string' || email.trim().toLowerCase() !== configuredEmail.toLowerCase()) {
          return NextResponse.json({ error: 'Invalid email address.' }, { status: 401 });
        }
      }

      // 2. Verify secret key against P2P_HOST_SECRET if set
      if (configuredSecret) {
        if (!secretKey || typeof secretKey !== 'string' || secretKey.trim() !== configuredSecret) {
          return NextResponse.json({ error: 'Invalid secret key or passphrase.' }, { status: 401 });
        }
      }

      return NextResponse.json({ ok: true, protected: !!configuredSecret });
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
      await store.recordHostHeartbeat(channelId, Date.now());
      return NextResponse.json({ ok: true, status: 'online', backend: store.backend });
    }

    if (action === 'get-presence') {
      const lastSeen = await store.getHostLastSeen(channelId);
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

      return NextResponse.json({ presence, status, backend: store.backend });
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

      await store.pushSignal(channelId, signal);
      return NextResponse.json({ ok: true, signalId: signal.id, backend: store.backend });
    }

    // 3. Poll for signals addressed to recipient
    if (action === 'poll-signals') {
      const { role, clientId, since } = body;
      const sinceTs = typeof since === 'number' ? since : 0;

      const matched = await store.pollSignals(channelId, role, clientId, sinceTs);
      return NextResponse.json({ signals: matched, serverTime: Date.now(), backend: store.backend });
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
