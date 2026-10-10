/**
 * lib/p2p/hostManager.ts
 *
 * Multi-visitor WebRTC Host Manager for Portfolio OS.
 * Manages 1-to-N concurrent visitor sessions, establishing isolated
 * WebRTC DataChannels for each visitor and routing replies strictly to their
 * individual chatroom.
 */

import type {
  P2PMessage,
  SignalEnvelope,
  VisitorSession,
} from './types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

interface InternalVisitorSession {
  id: string; // visitor clientId, e.g. 'visitor_7x9a'
  label: string; // 'Guest #7X9A'
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  p2pConnected: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  messages: P2PMessage[];
  lastActivity: number;
  unreadCount: number;
}

export interface HostManagerOptions {
  channelId: string;
  secretKey?: string;
  onSessionsChange: (sessions: VisitorSession[]) => void;
  onNewMessage: (visitorId: string, msg: P2PMessage) => void;
}

export class HostMultiPeerManager {
  public channelId: string;
  private secretKey?: string;
  private sessions = new Map<string, InternalVisitorSession>();
  private activeVisitorId: string | null = null;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp = 0;
  private processedSignalIds = new Set<string>();
  private deliveredMessageIds = new Set<string>();
  private destroyed = false;

  private onSessionsChangeCallback: (sessions: VisitorSession[]) => void;
  private onNewMessageCallback: (visitorId: string, msg: P2PMessage) => void;

  constructor(options: HostManagerOptions) {
    this.channelId = options.channelId;
    this.secretKey = options.secretKey;
    this.onSessionsChangeCallback = options.onSessionsChange;
    this.onNewMessageCallback = options.onNewMessage;
  }

  start() {
    this.destroyed = false;
    this.startHostHeartbeat();
    this.startPolling();
  }

  setActiveVisitor(visitorId: string | null) {
    this.activeVisitorId = visitorId;
    if (visitorId) {
      const session = this.sessions.get(visitorId);
      if (session) {
        session.unreadCount = 0;
        // Mark all unread incoming visitor messages as read and send receipt
        const visitorMsgIds = session.messages
          .filter((m) => m.sender === 'visitor')
          .map((m) => m.id);
        if (visitorMsgIds.length > 0) {
          this.sendReceiptToVisitor(visitorId, visitorMsgIds, 'read');
        }
        this.emitSessionsChange();
      }
    }
  }

  markActiveVisitorMessagesRead() {
    if (!this.activeVisitorId) return;
    const session = this.sessions.get(this.activeVisitorId);
    if (!session) return;

    session.unreadCount = 0;
    const visitorMsgIds = session.messages
      .filter((m) => m.sender === 'visitor')
      .map((m) => m.id);
    if (visitorMsgIds.length > 0) {
      this.sendReceiptToVisitor(this.activeVisitorId, visitorMsgIds, 'read');
    }
    this.emitSessionsChange();
  }

  getActiveVisitorId(): string | null {
    return this.activeVisitorId;
  }

  getPublicSessions(): VisitorSession[] {
    const list: VisitorSession[] = [];
    for (const s of this.sessions.values()) {
      list.push({
        id: s.id,
        label: s.label,
        p2pConnected: s.p2pConnected,
        messages: [...s.messages],
        lastActivity: s.lastActivity,
        unreadCount: s.unreadCount,
      });
    }
    // Sort by most recent activity
    return list.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  private emitSessionsChange() {
    if (this.destroyed) return;
    this.onSessionsChangeCallback(this.getPublicSessions());
  }

  private getOrCreateSession(visitorId: string): InternalVisitorSession {
    let session = this.sessions.get(visitorId);
    if (!session) {
      const cleanLabel = visitorId.replace('visitor_', '').slice(0, 4).toUpperCase();
      session = {
        id: visitorId,
        label: `Guest #${cleanLabel || 'USER'}`,
        peerConnection: null,
        dataChannel: null,
        p2pConnected: false,
        pendingCandidates: [],
        messages: [],
        lastActivity: Date.now(),
        unreadCount: 0,
      };
      this.sessions.set(visitorId, session);
      if (!this.activeVisitorId) {
        this.activeVisitorId = visitorId;
      }
      this.emitSessionsChange();
    }
    return session;
  }

  private startHostHeartbeat() {
    const beat = async () => {
      try {
        await fetch('/api/p2p/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'host-heartbeat',
            channelId: this.channelId,
            secretKey: this.secretKey,
          }),
        });
      } catch {}
    };

    void beat();
    this.heartbeatTimer = setInterval(() => {
      void beat();
    }, 18_000);
  }

  private startPolling(intervalMs = 1200) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      void this.pollSignals();
    }, intervalMs);
  }

  private async pollSignals() {
    if (this.destroyed) return;
    try {
      const res = await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'poll-signals',
          channelId: this.channelId,
          role: 'host',
          clientId: 'host',
          since: this.lastPollTimestamp,
        }),
      });

      const data = await res.json();
      if (!data.signals || !Array.isArray(data.signals)) return;

      for (const sig of data.signals as SignalEnvelope[]) {
        if (this.processedSignalIds.has(sig.id)) continue;
        this.processedSignalIds.add(sig.id);
        this.lastPollTimestamp = Math.max(this.lastPollTimestamp, sig.timestamp);

        await this.handleIncomingSignal(sig);
      }
    } catch {}
  }

  private async handleIncomingSignal(sig: SignalEnvelope) {
    if (this.destroyed) return;

    const visitorId = sig.from;
    if (!visitorId || visitorId === 'host') return;

    const session = this.getOrCreateSession(visitorId);
    session.lastActivity = Date.now();

    // 1. Visitor introduction with real name
    if (sig.type === 'visitor-intro') {
      try {
        const data = JSON.parse(sig.payload) as { name?: string };
        if (data.name && data.name.trim()) {
          session.label = data.name.trim();
          this.emitSessionsChange();
        }
      } catch {}
      return;
    }

    // 2. Incoming delivery or read receipt from visitor
    if (sig.type === 'receipt') {
      try {
        const data = JSON.parse(sig.payload) as { messageIds: string[]; status: 'delivered' | 'read' };
        this.applyReceipt(session, data.messageIds, data.status);
      } catch (err) {
        console.warn('[HostManager] Failed to parse receipt signal', err);
      }
      return;
    }

    // 3. Instant chat message from visitor
    if (sig.type === 'chat-message') {
      try {
        const msg = JSON.parse(sig.payload) as P2PMessage;
        if (msg.senderName && msg.senderName.trim()) {
          session.label = msg.senderName.trim();
        }
        this.addMessageToSession(session, msg);
      } catch (err) {
        console.warn('[HostManager] Failed to parse chat message', err);
      }
      return;
    }

    // 2. Incoming WebRTC SDP Offer from visitor
    if (sig.type === 'offer') {
      await this.handleVisitorOffer(session, sig.payload);
      return;
    }

    // 3. Incoming ICE Candidate from visitor
    if (sig.type === 'ice-candidate') {
      const candidateInit = JSON.parse(sig.payload) as RTCIceCandidateInit;
      if (session.peerConnection && session.peerConnection.remoteDescription) {
        try {
          await session.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch {}
      } else {
        session.pendingCandidates.push(candidateInit);
      }
    }
  }

  private async handleVisitorOffer(session: InternalVisitorSession, payload: string) {
    if (typeof window === 'undefined' || !window.RTCPeerConnection) return;

    // Reset old peer connection for this specific visitor if needed
    if (session.peerConnection) {
      try {
        session.peerConnection.close();
      } catch {}
      session.peerConnection = null;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    session.peerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignalToVisitor(session.id, 'ice-candidate', JSON.stringify(event.candidate.toJSON()));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        session.p2pConnected = true;
        this.emitSessionsChange();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        session.p2pConnected = false;
        this.emitSessionsChange();
      }
    };

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      session.dataChannel = dc;

      dc.onopen = () => {
        session.p2pConnected = true;
        this.emitSessionsChange();
      };

      dc.onclose = () => {
        session.p2pConnected = false;
        this.emitSessionsChange();
      };

      dc.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.__type === 'receipt') {
            this.applyReceipt(session, parsed.messageIds, parsed.status);
            return;
          }
          const msg = parsed as P2PMessage;
          if (msg.senderName && msg.senderName.trim()) {
            session.label = msg.senderName.trim();
          }
          this.addMessageToSession(session, msg);
        } catch (err) {
          console.warn('[HostManager] Malformed DataChannel payload', err);
        }
      };
    };

    // Set remote offer description
    const offerDesc = new RTCSessionDescription(JSON.parse(payload));
    await pc.setRemoteDescription(offerDesc);

    // Flush pending candidates for this visitor
    for (const cand of session.pendingCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {}
    }
    session.pendingCandidates = [];

    // Create and send SDP Answer strictly to this visitor
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.sendSignalToVisitor(session.id, 'answer', JSON.stringify(answer));
  }

  private addMessageToSession(session: InternalVisitorSession, msg: P2PMessage) {
    if (!msg.id) {
      msg.id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    if (!msg.timestamp) {
      msg.timestamp = Date.now();
    }
    if (this.deliveredMessageIds.has(msg.id)) return;
    this.deliveredMessageIds.add(msg.id);

    session.messages.push(msg);
    session.lastActivity = Date.now();

    const isRoomActive = this.activeVisitorId === session.id;
    const isWindowFocused = typeof document !== 'undefined' ? document.hasFocus() : true;

    if (!isRoomActive) {
      session.unreadCount++;
    }

    // Automatically send receipt to visitor (read if room active & focused, else delivered)
    const receiptStatus: 'read' | 'delivered' = isRoomActive && isWindowFocused ? 'read' : 'delivered';
    this.sendReceiptToVisitor(session.id, [msg.id], receiptStatus);

    this.onNewMessageCallback(session.id, msg);
    this.emitSessionsChange();
  }

  private applyReceipt(session: InternalVisitorSession, messageIds: string[], status: 'delivered' | 'read') {
    const idSet = new Set(messageIds);
    let changed = false;

    for (const msg of session.messages) {
      if (idSet.has(msg.id)) {
        if (status === 'read' && msg.status !== 'read') {
          msg.status = 'read';
          changed = true;
        } else if (status === 'delivered' && (!msg.status || msg.status === 'sent')) {
          msg.status = 'delivered';
          changed = true;
        }
      }
    }

    if (changed) {
      this.emitSessionsChange();
    }
  }

  sendReceiptToVisitor(visitorId: string, messageIds: string[], status: 'delivered' | 'read') {
    if (messageIds.length === 0) return;
    const session = this.sessions.get(visitorId);
    if (!session) return;

    if (session.dataChannel && session.dataChannel.readyState === 'open') {
      try {
        session.dataChannel.send(JSON.stringify({ __type: 'receipt', messageIds, status }));
        return;
      } catch (err) {
        console.warn('[HostManager] Failed to send receipt via DataChannel', err);
      }
    }

    void this.sendSignalToVisitor(visitorId, 'receipt', JSON.stringify({ messageIds, status }));
  }

  private async sendSignalToVisitor(visitorId: string, type: SignalEnvelope['type'], payload: string) {
    try {
      await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-signal',
          channelId: this.channelId,
          from: 'host',
          to: visitorId,
          type,
          payload,
        }),
      });
    } catch (err) {
      console.warn('[HostManager] Failed to send signal to visitor', err);
    }
  }

  /**
   * Sends a reply message specifically to one visitor chatroom.
   * Visible ONLY to that visitor.
   */
  sendReplyToVisitor(visitorId: string, text: string, verified = true): P2PMessage | null {
    const session = this.sessions.get(visitorId);
    if (!session) return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    const message: P2PMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      sender: 'host',
      text: trimmed,
      timestamp: Date.now(),
      verified,
      status: 'sent',
    };

    this.deliveredMessageIds.add(message.id);
    session.messages.push(message);
    session.lastActivity = Date.now();
    this.emitSessionsChange();

    // 1. Direct WebRTC P2P DataChannel if open
    if (session.dataChannel && session.dataChannel.readyState === 'open') {
      session.dataChannel.send(JSON.stringify(message));
      return message;
    }

    // 2. Fast signal relay addressed strictly to this visitor
    void this.sendSignalToVisitor(visitorId, 'chat-message', JSON.stringify(message));
    return message;
  }

  /**
   * Sends an audio voice recording specifically to one visitor chatroom.
   * Visible ONLY to that visitor.
   */
  sendAudioReplyToVisitor(visitorId: string, audioData: string, duration: number, verified = true): P2PMessage | null {
    const session = this.sessions.get(visitorId);
    if (!session || !audioData) return null;

    const dur = Math.max(1, Math.round(duration));
    const message: P2PMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      sender: 'host',
      text: `🎤 Voice note (${dur}s)`,
      audioData,
      audioDuration: dur,
      timestamp: Date.now(),
      verified,
      status: 'sent',
    };

    this.deliveredMessageIds.add(message.id);
    session.messages.push(message);
    session.lastActivity = Date.now();
    this.emitSessionsChange();

    // 1. Direct WebRTC P2P DataChannel if open
    if (session.dataChannel && session.dataChannel.readyState === 'open') {
      try {
        session.dataChannel.send(JSON.stringify(message));
        return message;
      } catch (err) {
        console.warn('[HostManager] Failed to send audio via DataChannel, falling back to relay', err);
      }
    }

    // 2. Fast signal relay addressed strictly to this visitor
    void this.sendSignalToVisitor(visitorId, 'chat-message', JSON.stringify(message));
    return message;
  }

  closeSession(visitorId: string) {
    const session = this.sessions.get(visitorId);
    if (!session) return;

    if (session.dataChannel) {
      try {
        session.dataChannel.close();
      } catch {}
    }
    if (session.peerConnection) {
      try {
        session.peerConnection.close();
      } catch {}
    }

    this.sessions.delete(visitorId);
    if (this.activeVisitorId === visitorId) {
      const remaining = Array.from(this.sessions.keys());
      this.activeVisitorId = remaining.length > 0 ? (remaining[0] ?? null) : null;
    }
    this.emitSessionsChange();
  }

  disconnect() {
    this.destroyed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const session of this.sessions.values()) {
      if (session.dataChannel) {
        try {
          session.dataChannel.close();
        } catch {}
      }
      if (session.peerConnection) {
        try {
          session.peerConnection.close();
        } catch {}
      }
    }
    this.sessions.clear();
    this.emitSessionsChange();
  }
}
