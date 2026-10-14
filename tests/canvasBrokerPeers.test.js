import test from 'node:test';
import assert from 'node:assert/strict';
import CanvasBrokerPeers from '../src/components/CanvasBrokerPeers.js';

test('canvas changes, cursor and laser use the broker without WebRTC', () => {
  const frames = [], received = [];
  const broker = new CanvasBrokerPeers({ sendSignal: frame => { frames.push(frame); return true; },
    onData: (peer, payload) => received.push([peer, payload]),
    onCursor: (peer, payload) => received.push([peer, payload]),
    onLaser: (peer, payload) => received.push([peer, payload]) });
  broker.setInitialPeers('self', [{ peer_id: 'other', nickname: 'verified', groups: ['a'] }]);
  assert.equal(broker.isPeerConnected('other'), true);
  assert.equal(broker.sendHostData('other', { type: 'host_commit', protocol: 1, term: 't' }), true);
  broker.sendCursor({ type: 'cursor', x: 1, y: 2 });
  broker.sendLaser({ type: 'laser', points: [[1, 2]] });
  broker.sendData({ type: 'editor_presence', item_id: 'item' });
  assert.deepEqual(frames.map(frame => frame.payload.type), ['host_commit', 'cursor', 'laser', 'editor_presence']);
  assert.ok(frames.every(frame => frame.type === 'canvas_relay' && frame.peer_ids[0] === 'other'));
  for (const frame of frames) broker.handleRelay({ peer: { peer_id: 'other', nickname: 'spoofed' }, payload: frame.payload });
  assert.equal(received.length, 4);
  assert.ok(received.every(([peer]) => peer.nickname === 'verified'));
  broker.handleRelay({ peer: { peer_id: 'stranger' }, payload: { type: 'cursor' } });
  assert.equal(received.length, 4);
});

test('recipient permissions, membership reconciliation and closed transport are respected', () => {
  const frames = [];
  const broker = new CanvasBrokerPeers({ sendSignal: frame => { frames.push(frame); return true; } });
  broker.setInitialPeers('self', [{ peer_id: 'a', groups: ['a'] }, { peer_id: 'b', groups: ['b'] }]);
  broker.sendData({ type: 'editor_presence' }, peer => peer.groups.includes('a'));
  assert.deepEqual(frames[0].peer_ids, ['a']);
  broker.setInitialPeers('self', [{ peer_id: 'b' }]);
  assert.equal(broker.getOpenPeerCount(), 1);
  assert.equal(broker.sendHostData('a', { type: 'host_commit' }), false);
  broker.sendData({ type: 'legacy_object_patch' });
  assert.equal(frames.length, 1); // Host session owns persistent replication.
  broker.close();
  assert.equal(broker.sendCursor({ type: 'cursor' }), false);
  assert.equal(broker.getOpenPeerCount(), 0);
});

test('broker backpressure propagates to host retries', () => {
  const broker = new CanvasBrokerPeers({ sendSignal: () => false });
  broker.setInitialPeers('self', [{ peer_id: 'other' }]);
  assert.equal(broker.sendHostData('other', { type: 'host_snapshot' }), false);
});
