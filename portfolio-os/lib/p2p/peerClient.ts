/**
 * lib/p2p/peerClient.ts
 *
 * Client-side WebRTC Peer Connection and RTCDataChannel manager.
 * Establishes an encrypted, zero-server P2P data pipe between Visitor and Host,
 * with fast initial relaying during handshake so messages are never blocked.
 */

import type {
  ConnectionState,
  PeerRole,
  P2PMessage,
  PresenceStatus,
  SignalEnvelope,
} from './types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export interface PeerClientOptions {
  channelId: string;
  role: PeerRole;
  clientId?: string;
  senderName?: string;
  onMessage: (message: P2PMessage) => void;
  onReceipt?: (messageIds: string[], status: 'delivered' | 'read') => void;
  onStateChange: (state: ConnectionState) => void;
  onPresenceChange?: (status: PresenceStatus) => void;
}

export class PeerClient {
  public channelId: string;
  public role: PeerRole;
  public clientId: string;
  public senderName?: string;
  private peerTargetId: string;

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private state: ConnectionState = 'idle';

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp = 0;

  private processedSignalIds = new Set<string>();
  private deliveredMessageIds = new Set<string>();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private destroyed = false;

  private onMessageCallback: (msg: P2PMessage) => void;
  private onReceiptCallback?: (messageIds: string[], status: 'delivered' | 'read') => void;
  private onStateChangeCallback: (state: ConnectionState) => void;
  private onPresenceChangeCallback?: (status: PresenceStatus) => void;

  constructor(options: PeerClientOptions) {
    this.channelId = options.channelId;
    this.role = options.role;
    this.senderName = options.senderName;
    this.clientId =
      options.clientId ||
      (this.role === 'host'
        ? 'host'
        : `visitor_${Math.random().toString(36).slice(2, 9)}`);
    this.peerTargetId = this.role === 'host' ? 'visitor' : 'host';

    this.onMessageCallback = options.onMessage;
    this.onReceiptCallback = options.onReceipt;
    this.onStateChangeCallback = options.onStateChange;
    this.onPresenceChangeCallback = options.onPresenceChange;

    if (this.role === 'host') {
      this.startHostHeartbeat();
    }
  }

  private setState(newState: ConnectionState) {
    if (this.destroyed) return;
    this.state = newState;
    this.onStateChangeCallback(newState);
  }

  /**
   * Checks current host presence status from signaling relay.
   */
  async checkPresence(): Promise<PresenceStatus> {
    try {
      const res = await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-presence',
          channelId: this.channelId,
        }),
      });
      const data = await res.json();
      const status: PresenceStatus = data.status || 'offline';
      if (this.onPresenceChangeCallback) {
        this.onPresenceChangeCallback(status);
      }
      return status;
    } catch {
      return 'offline';
    }
  }

  /**
   * Pings the host's phone (triggers push/webhook if configured).
   */
  async pingHostPhone(): Promise<boolean> {
    try {
      const res = await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping-host',
          channelId: this.channelId,
        }),
      });
      const data = await res.json();
      return !!data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Starts connection attempt.
   */
  async connect(): Promise<void> {
    if (typeof window === 'undefined' || !window.RTCPeerConnection) {
      this.setState('failed');
      throw new Error('WebRTC (RTCPeerConnection) is not supported in this browser.');
    }

    this.destroyed = false;
    this.setState('signaling');

    this.initPeerConnection();

    if (this.role === 'visitor') {
      await this.initiateVisitorOffer();
    }

    this.startPolling();
  }

  private initPeerConnection() {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pendingCandidates = [];

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal('ice-candidate', JSON.stringify(event.candidate.toJSON()));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const pcs = this.peerConnection.connectionState;
      if (pcs === 'connected') {
        this.setState('connected');
      } else if (pcs === 'disconnected' || pcs === 'closed') {
        this.setState('disconnected');
      } else if (pcs === 'failed') {
        // Fallback to signaling while keeping connection responsive
        this.setState('disconnected');
      }
    };

    if (this.role === 'host') {
      this.peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
    }
  }

  private async initiateVisitorOffer() {
    if (!this.peerConnection) return;

    // Create Data Channel
    const dc = this.peerConnection.createDataChannel('portfolio-direct-chat', {
      ordered: true,
    });
    this.setupDataChannel(dc);

    // Create and send SDP Offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this.sendSignal('offer', JSON.stringify(offer));
    this.setState('connecting');
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;

    dc.onopen = () => {
      this.setState('connected');
      this.adjustPollingInterval(6_000);
    };

    dc.onclose = () => {
      this.setState('disconnected');
    };

    dc.onerror = (err) => {
      console.warn('[P2P] DataChannel warning', err);
    };

    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.__type === 'receipt') {
          if (this.onReceiptCallback) {
            this.onReceiptCallback(parsed.messageIds, parsed.status);
          }
          return;
        }
        this.dispatchIncomingMessage(parsed as P2PMessage);
      } catch (err) {
        console.warn('[P2P] Malformed DataChannel payload', err);
      }
    };
  }

  private dispatchIncomingMessage(msg: P2PMessage) {
    if (!msg.id) {
      msg.id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    if (!msg.timestamp) {
      msg.timestamp = Date.now();
    }
    if (this.deliveredMessageIds.has(msg.id)) return;
    this.deliveredMessageIds.add(msg.id);
    this.onMessageCallback(msg);
  }

  private async sendSignal(type: SignalEnvelope['type'], payload: string) {
    try {
      await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-signal',
          channelId: this.channelId,
          from: this.clientId,
          to: this.peerTargetId,
          type,
          payload,
        }),
      });
    } catch (err) {
      console.warn('[P2P] Failed to send signal', err);
    }
  }

  private startPolling(intervalMs = 1200) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      void this.pollSignals();
    }, intervalMs);
  }

  private adjustPollingInterval(intervalMs: number) {
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
          role: this.role,
          clientId: this.clientId,
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
    } catch {
      // Silently retry on next poll tick
    }
  }

  private async handleIncomingSignal(sig: SignalEnvelope) {
    if (this.destroyed) return;

    // Handle instant relay messages (when WebRTC is still negotiating)
    if (sig.type === 'chat-message') {
      try {
        const msg = JSON.parse(sig.payload) as P2PMessage;
        this.dispatchIncomingMessage(msg);
      } catch (err) {
        console.warn('[P2P] Failed to parse chat message signal', err);
      }
      return;
    }

    // Handle delivery / read receipts
    if (sig.type === 'receipt') {
      try {
        const data = JSON.parse(sig.payload) as { messageIds: string[]; status: 'delivered' | 'read' };
        if (this.onReceiptCallback) {
          this.onReceiptCallback(data.messageIds, data.status);
        }
      } catch (err) {
        console.warn('[P2P] Failed to parse receipt signal', err);
      }
      return;
    }

    if (!this.peerConnection) return;

    if (sig.type === 'offer' && this.role === 'host') {
      // Remember which visitor called
      this.peerTargetId = sig.from;

      // Re-init clean peer connection for this visitor
      this.initPeerConnection();

      const offerDesc = new RTCSessionDescription(JSON.parse(sig.payload));
      await this.peerConnection.setRemoteDescription(offerDesc);

      // Flush queued candidates
      await this.flushPendingCandidates();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await this.sendSignal('answer', JSON.stringify(answer));
      this.setState('connecting');
    } else if (sig.type === 'answer' && this.role === 'visitor') {
      this.peerTargetId = sig.from;
      const answerDesc = new RTCSessionDescription(JSON.parse(sig.payload));
      if (this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(answerDesc);
        await this.flushPendingCandidates();
      }
    } else if (sig.type === 'ice-candidate') {
      const candidateInit = JSON.parse(sig.payload) as RTCIceCandidateInit;
      if (this.peerConnection.remoteDescription) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch {
          // Candidate duplicate or stale; safe to ignore
        }
      } else {
        // Queue candidate until setRemoteDescription completes
        this.pendingCandidates.push(candidateInit);
      }
    }
  }

  private async flushPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    for (const cand of this.pendingCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('[P2P] Candidate flush warning', err);
      }
    }
    this.pendingCandidates = [];
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
          }),
        });
      } catch {
        // Retry next interval
      }
    };

    void beat();
    this.heartbeatTimer = setInterval(() => {
      void beat();
    }, 18_000); // Send heartbeat every 18s
  }

  /**
   * Sets visitor name and notifies host.
   */
  setSenderName(name: string) {
    this.senderName = name.trim();
    if (this.role === 'visitor') {
      void this.sendSignal('visitor-intro', JSON.stringify({ name: this.senderName, visitorId: this.clientId }));
    }
  }

  /**
   * Sends a delivery or read receipt for given message IDs.
   */
  sendReceipt(messageIds: string[], status: 'delivered' | 'read') {
    if (messageIds.length === 0) return;
    const payload = JSON.stringify({ messageIds, status });

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ __type: 'receipt', messageIds, status }));
      return;
    }

    void this.sendSignal('receipt', payload);
  }

  /**
   * Sends a chat message.
   * Uses direct RTCDataChannel when connected.
   * If DataChannel is still negotiating, delivers immediately via signal bus!
   */
  sendMessage(text: string, verified = false, senderName?: string): P2PMessage | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const message: P2PMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      sender: this.role,
      senderName: senderName || this.senderName,
      text: trimmed,
      timestamp: Date.now(),
      verified,
      status: 'sent',
    };

    this.deliveredMessageIds.add(message.id);

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      // ⚡ Direct P2P WebRTC DataChannel
      this.dataChannel.send(JSON.stringify(message));
      return message;
    }

    // Fast relay fallback during handshake so message is never delayed
    void this.sendSignal('chat-message', JSON.stringify(message));
    return message;
  }

  /**
   * Sends a voice audio recording.
   */
  sendAudioMessage(audioData: string, duration: number, senderName?: string): P2PMessage | null {
    if (!audioData) return null;

    const dur = Math.max(1, Math.round(duration));
    const message: P2PMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      sender: this.role,
      senderName: senderName || this.senderName,
      text: `🎤 Voice note (${dur}s)`,
      audioData,
      audioDuration: dur,
      timestamp: Date.now(),
      status: 'sent',
    };

    this.deliveredMessageIds.add(message.id);

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(message));
        return message;
      } catch (err) {
        console.warn('[P2P] Failed to send audio via DataChannel, falling back to relay', err);
      }
    }

    void this.sendSignal('chat-message', JSON.stringify(message));
    return message;
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
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
    this.setState('idle');
  }
}
