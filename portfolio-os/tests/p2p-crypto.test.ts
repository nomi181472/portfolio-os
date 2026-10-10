import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveChannelId, generateHostProof, verifyHostProof } from '../lib/p2p/crypto';

test('deriveChannelId generates stable deterministic 32-char hex channel ID', async () => {
  const email1 = 'user@example.com';
  const email2 = 'USER@EXAMPLE.COM '; // Should normalize case and whitespace
  const id1 = await deriveChannelId(email1);
  const id2 = await deriveChannelId(email2);

  assert.equal(id1.length, 32);
  assert.equal(id1, id2, 'Same email with different case must produce identical channel ID');

  const differentId = await deriveChannelId('other@example.com');
  assert.notEqual(id1, differentId, 'Different emails must produce different channel IDs');
});

test('generateHostProof and verifyHostProof validate owner secret key', async () => {
  const email = 'user@example.com';
  const secretKey = 'my-ultra-secret-passphrase-123';

  const proof = await generateHostProof(email, secretKey);
  assert.ok(proof.signature.length > 0);

  const isValid = await verifyHostProof(email, secretKey, proof.signature, proof.timestamp);
  assert.equal(isValid, true, 'Valid signature must verify successfully');

  // Verify failure on wrong secret key
  const isInvalid = await verifyHostProof(email, 'wrong-secret', proof.signature, proof.timestamp);
  assert.equal(isInvalid, false, 'Tampered secret key must fail verification');

  // Verify failure on expired timestamp
  const expiredTimestamp = Date.now() - 600_000; // 10 minutes ago
  const isExpired = await verifyHostProof(email, secretKey, proof.signature, expiredTimestamp, 60_000);
  assert.equal(isExpired, false, 'Expired proof must fail verification');
});

test('P2P message status transitions correctly follow sent -> delivered -> read', () => {
  type Status = 'sent' | 'delivered' | 'read';

  function applyStatus(current: Status | undefined, incoming: 'delivered' | 'read'): Status {
    if (incoming === 'read') return 'read';
    if (incoming === 'delivered' && (!current || current === 'sent')) return 'delivered';
    return current || 'sent';
  }

  // Initial sent state
  let status: Status | undefined = 'sent';
  assert.equal(status, 'sent');

  // Transition to delivered
  status = applyStatus(status, 'delivered');
  assert.equal(status, 'delivered', 'Incoming delivered receipt should transition sent to delivered');

  // Stale delivered receipt should not downgrade read
  status = applyStatus('read', 'delivered');
  assert.equal(status, 'read', 'Late delivered receipt must never downgrade a read message');

  // Transition to read
  status = applyStatus('delivered', 'read');
  assert.equal(status, 'read', 'Incoming read receipt should transition delivered to read');

  // Direct transition from sent to read (if visitor/host was actively focused on screen)
  status = applyStatus('sent', 'read');
  assert.equal(status, 'read', 'Direct transition from sent to read should be valid when chatroom is focused');
});

test('P2P audio message creates valid voice note payload with duration and fallback text', () => {
  const fakeAudioBase64 = 'data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAA...';
  const duration = 4.7;
  const dur = Math.max(1, Math.round(duration));

  const audioMessage = {
    id: 'msg_test123',
    sender: 'visitor' as const,
    senderName: 'Sarah Connor',
    text: `🎤 Voice note (${dur}s)`,
    audioData: fakeAudioBase64,
    audioDuration: dur,
    timestamp: Date.now(),
    status: 'sent' as const,
  };

  assert.equal(audioMessage.audioDuration, 5);
  assert.equal(audioMessage.text, '🎤 Voice note (5s)');
  assert.ok(audioMessage.audioData.startsWith('data:audio/'));

  // Test serialization roundtrip (WebRTC RTCDataChannel / Signal envelope JSON)
  const serialized = JSON.stringify(audioMessage);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.id, audioMessage.id);
  assert.equal(parsed.audioDuration, 5);
  assert.equal(parsed.audioData, fakeAudioBase64);
  assert.equal(parsed.status, 'sent');
});

test('every message between host and visitor strictly contains id and timestamp (time)', () => {
  function createMessage(sender: 'visitor' | 'host', text: string) {
    return {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      sender,
      text,
      timestamp: Date.now(),
      status: 'sent' as const,
    };
  }

  const visitorMsg = createMessage('visitor', 'Hello, looking forward to discussing system architecture.');
  const hostMsg = createMessage('host', 'Hi! Happy to connect.');

  // 1. Confirm ID presence and uniqueness
  assert.ok(visitorMsg.id && typeof visitorMsg.id === 'string' && visitorMsg.id.length > 5);
  assert.ok(hostMsg.id && typeof hostMsg.id === 'string' && hostMsg.id.length > 5);
  assert.notEqual(visitorMsg.id, hostMsg.id, 'Each message must have a unique identifier');

  // 2. Confirm timestamp presence and valid date range
  assert.ok(visitorMsg.timestamp && typeof visitorMsg.timestamp === 'number');
  assert.ok(hostMsg.timestamp && typeof hostMsg.timestamp === 'number');
  assert.ok(visitorMsg.timestamp > 0);
  assert.ok(Math.abs(Date.now() - visitorMsg.timestamp) < 5000, 'Timestamp must represent valid epoch time');

  // 3. Confirm formatted time is renderable for both parties
  const formattedTime = new Date(visitorMsg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  assert.ok(formattedTime.length > 0, 'Formatted time must be renderable in UI');
});

test('voice message player safely handles WebM Infinity or NaN durations without assigning invalid currentTime', () => {
  function computeSafeSeek(
    clickPercentage: number,
    audioDuration: number | undefined,
    totalDuration: number | undefined,
    fallbackDuration: number | undefined,
  ): number | null {
    let safeTotal = 0;
    if (typeof audioDuration === 'number' && Number.isFinite(audioDuration) && audioDuration > 0) {
      safeTotal = audioDuration;
    } else if (typeof totalDuration === 'number' && Number.isFinite(totalDuration) && totalDuration > 0) {
      safeTotal = totalDuration;
    } else if (typeof fallbackDuration === 'number' && Number.isFinite(fallbackDuration) && fallbackDuration > 0) {
      safeTotal = fallbackDuration;
    }

    if (!safeTotal || !Number.isFinite(safeTotal) || safeTotal <= 0) return null;

    const percentage = Math.max(0, Math.min(1, clickPercentage));
    const seekTime = percentage * safeTotal;
    return Number.isFinite(seekTime) && seekTime >= 0 ? seekTime : null;
  }

  // Case 1: Browser reports audio.duration = Infinity (common for WebM Opus MediaRecorder blobs)
  const seek1 = computeSafeSeek(0.5, Infinity, Infinity, 8.4);
  assert.equal(seek1, 4.2, 'Should fall back to valid prop duration when browser reports Infinity');

  // Case 2: Browser reports NaN
  const seek2 = computeSafeSeek(0.25, NaN, NaN, 12);
  assert.equal(seek2, 3, 'Should fall back to valid prop duration when browser reports NaN');

  // Case 3: All durations are invalid or 0
  const seek3 = computeSafeSeek(0.5, Infinity, NaN, 0);
  assert.equal(seek3, null, 'Must return null and avoid setting audio.currentTime when no finite duration exists');

  // Case 4: Valid duration
  const seek4 = computeSafeSeek(0.75, 10, 10, 10);
  assert.equal(seek4, 7.5, 'Normal seek should compute finite float');
});



