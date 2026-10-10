/**
 * lib/p2p/types.ts
 *
 * Types for browser-to-browser Peer-to-Peer (WebRTC) direct communication.
 * Supports 1-to-N multi-visitor isolation and delivery/read receipts
 * (single tick, double tick, blue tick).
 */

export type PeerRole = 'visitor' | 'host';

export type PresenceStatus = 'online' | 'away' | 'offline';

export type ConnectionState =
  | 'idle'
  | 'checking-presence'
  | 'signaling'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

export type P2PMessageStatus = 'sent' | 'delivered' | 'read';

export interface P2PMessage {
  id: string;
  sender: PeerRole;
  senderName?: string; // Visitor's custom name or Host label
  text: string;
  audioData?: string; // Base64 data URL e.g. "data:audio/webm;base64,..."
  audioDuration?: number; // Duration in seconds
  timestamp: number;
  verified?: boolean; // Cryptographically signed by host secret key
  status?: P2PMessageStatus; // 'sent' (✓), 'delivered' (✓✓), 'read' (✓✓ blue)
}

export type SignalType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'chat-message'
  | 'visitor-intro'
  | 'receipt'
  | 'ping-host'
  | 'leave';

export interface ReceiptPayload {
  messageIds: string[];
  status: 'delivered' | 'read';
}

export interface SignalEnvelope {
  id: string;
  channelId: string;
  from: string;
  to: string;
  type: SignalType;
  payload: string; // Serialized payload (offer, answer, candidate, chat-message, receipt)
  timestamp: number;
}

export interface ChannelPresence {
  channelId: string;
  hostOnline: boolean;
  lastSeenHost: number;
  activeVisitors: number;
}

export interface HostCredentials {
  email: string;
  secretKey: string;
}

export interface VisitorSession {
  id: string; // unique visitor session ID (e.g. 'visitor_8f2a')
  label: string; // friendly display name (e.g. 'Sarah Connor' or 'Guest #8F2A')
  p2pConnected: boolean;
  messages: P2PMessage[];
  lastActivity: number;
  unreadCount: number;
}
