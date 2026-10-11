import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  InMemorySignalingStore,
  UpstashRedisSignalingStore,
  getSignalingStore,
  matchesRecipient,
} from '../lib/p2p/signalingStore';
import type { SignalEnvelope } from '../lib/p2p/types';

test('matchesRecipient correctly routes signals to host, all, or specific visitor clientId', () => {
  const signalToHost: SignalEnvelope = {
    id: 's1',
    channelId: 'chan1',
    from: 'visitor_123',
    to: 'host',
    type: 'offer',
    payload: '{}',
    timestamp: 1000,
  };

  const signalToVisitor: SignalEnvelope = {
    id: 's2',
    channelId: 'chan1',
    from: 'host',
    to: 'visitor_123',
    type: 'answer',
    payload: '{}',
    timestamp: 2000,
  };

  // Host should receive signalToHost
  assert.equal(matchesRecipient(signalToHost, 'host'), true);
  // Host should NOT receive signal directed to visitor_123
  assert.equal(matchesRecipient(signalToVisitor, 'host'), false);

  // Visitor with clientId 'visitor_123' should receive signalToVisitor
  assert.equal(matchesRecipient(signalToVisitor, 'visitor', 'visitor_123'), true);
  // Another visitor should NOT receive it
  assert.equal(matchesRecipient(signalToVisitor, 'visitor', 'visitor_999'), false);

  // Timestamp 'since' filter
  assert.equal(matchesRecipient(signalToHost, 'host', undefined, 1500), false);
  assert.equal(matchesRecipient(signalToHost, 'host', undefined, 500), true);
});

test('InMemorySignalingStore handles heartbeats, presence, and signal exchange', async () => {
  const store = new InMemorySignalingStore();
  const channelId = 'test-chan-memory';

  // 1. Initial presence is 0
  assert.equal(await store.getHostLastSeen(channelId), 0);

  // 2. Record heartbeat
  const now = Date.now();
  await store.recordHostHeartbeat(channelId, now);
  assert.equal(await store.getHostLastSeen(channelId), now);

  // 3. Push visitor offer
  const offer: SignalEnvelope = {
    id: 'sig_offer_1',
    channelId,
    from: 'visitor_abc',
    to: 'host',
    type: 'offer',
    payload: JSON.stringify({ sdp: 'fake-offer-sdp' }),
    timestamp: now,
  };
  await store.pushSignal(channelId, offer);

  // 4. Host polls and finds offer
  const hostSignals = await store.pollSignals(channelId, 'host');
  assert.equal(hostSignals.length, 1);
  assert.equal(hostSignals[0]?.id, 'sig_offer_1');

  // 5. Host replies with answer
  const answer: SignalEnvelope = {
    id: 'sig_answer_1',
    channelId,
    from: 'host',
    to: 'visitor_abc',
    type: 'answer',
    payload: JSON.stringify({ sdp: 'fake-answer-sdp' }),
    timestamp: now + 50,
  };
  await store.pushSignal(channelId, answer);

  // 6. Visitor polls and finds answer
  const visitorSignals = await store.pollSignals(channelId, 'visitor', 'visitor_abc', now + 10);
  assert.equal(visitorSignals.length, 1);
  assert.equal(visitorSignals[0]?.id, 'sig_answer_1');
});

test('UpstashRedisSignalingStore executes pipeline commands against REST API protocol', async () => {
  // In-process mock server mimicking Upstash Redis REST pipeline endpoint
  const recordedCommands: Array<Array<string | number>> = [];
  const mockStorage = new Map<string, unknown>();

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      assert.equal(req.headers.authorization, 'Bearer test-mock-token');

      if (req.url === '/pipeline') {
        const commands = JSON.parse(body) as Array<Array<string | number>>;
        const results = commands.map((cmd) => {
          recordedCommands.push(cmd);
          const op = String(cmd[0]).toUpperCase();
          const key = String(cmd[1]);

          if (op === 'SET') {
            mockStorage.set(key, cmd[2]);
            return { result: 'OK' };
          }
          if (op === 'GET') {
            return { result: mockStorage.get(key) ?? null };
          }
          if (op === 'RPUSH') {
            const current = (mockStorage.get(key) as string[]) || [];
            current.push(String(cmd[2]));
            mockStorage.set(key, current);
            return { result: current.length };
          }
          if (op === 'EXPIRE' || op === 'LTRIM') {
            return { result: 'OK' };
          }
          if (op === 'LRANGE') {
            return { result: (mockStorage.get(key) as string[]) || [] };
          }
          return { result: null };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const mockUrl = `http://127.0.0.1:${address.port}`;

  try {
    const redisStore = new UpstashRedisSignalingStore(mockUrl, 'test-mock-token');
    assert.equal(redisStore.backend, 'upstash');

    const channelId = 'test-chan-upstash';
    const ts = Date.now();

    // Test heartbeat SET EX
    await redisStore.recordHostHeartbeat(channelId, ts);
    const seen = await redisStore.getHostLastSeen(channelId);
    assert.equal(seen, ts);

    // Test signal RPUSH + EXPIRE + LTRIM
    const testSignal: SignalEnvelope = {
      id: 'sig_test_upstash',
      channelId,
      from: 'visitor_xyz',
      to: 'host',
      type: 'offer',
      payload: '{"type":"offer"}',
      timestamp: ts,
    };
    await redisStore.pushSignal(channelId, testSignal);

    // Test pollSignals LRANGE
    const polled = await redisStore.pollSignals(channelId, 'host');
    assert.equal(polled.length, 1);
    assert.equal(polled[0]?.id, 'sig_test_upstash');

    // Confirm pipeline commands were dispatched
    const hasRpush = recordedCommands.some((c) => c[0] === 'RPUSH' && c[1] === `p2p:signals:${channelId}`);
    const hasExpire = recordedCommands.some((c) => c[0] === 'EXPIRE' && c[1] === `p2p:signals:${channelId}`);
    assert.ok(hasRpush, 'Must execute RPUSH');
    assert.ok(hasExpire, 'Must execute EXPIRE');
  } finally {
    server.close();
  }
});

test('getSignalingStore factory selects appropriate backend based on options and env', () => {
  // Case 1: Explicit memory mode
  const memStore = getSignalingStore({ mode: 'memory' });
  assert.equal(memStore.backend, 'memory');

  // Case 2: Memory mode forced even if url/token present
  const forcedMem = getSignalingStore({
    mode: 'memory',
    url: 'https://example.upstash.io',
    token: 'fake-token',
  });
  assert.equal(forcedMem.backend, 'memory');

  // Case 3: Upstash mode when url & token provided
  const upstashStore = getSignalingStore({
    mode: 'auto',
    url: 'https://example.upstash.io',
    token: 'fake-token',
  });
  assert.equal(upstashStore.backend, 'upstash');

  // Case 4: Default fallback with no credentials is memory
  const fallbackStore = getSignalingStore({
    mode: 'auto',
    url: '',
    token: '',
  });
  assert.equal(fallbackStore.backend, 'memory');
});
