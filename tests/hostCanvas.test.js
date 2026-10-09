import test from 'node:test';
import assert from 'node:assert/strict';
import * as Automerge from '@automerge/automerge';
import { HostCanvasSession } from '../src/canvas/host/HostCanvasSession.js';
import { electHost, itemOperations, loadItemDoc, reduceHostOperations, storedHostItem } from '../src/canvas/host/hostOperations.js';
import { encodeBase64 } from '../src/canvas/collaborativeSync.js';
import CanvasPeerMesh from '../src/components/CanvasPeerMesh.js';

const peer = id => ({ peer_id: id, groups: ['default'], is_admin: false });
const shape = { kind: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 0.1, height: 0.1, permission: 'default' };
function network(ids = ['a', 'z']) {
  let time = 0; let term = 0;
  const queue = [], sessions = new Map(), saved = [], errors = [], published = [], receipts = [];
  const online = new Set(ids);
  const add = id => {
    online.add(id);
    const session = new HostCanvasSession({
      now: () => time, available: () => online.has(id),
      send: (target, message) => {
        if (!online.has(target)) return false;
        queue.push({ origin: id, target, message: structuredClone(message) }); return true;
      },
      persist: (changes, epoch) => { saved.push({ host: id, time, epoch, changes: structuredClone(changes) }); return true; },
      publish: (items, touched) => published.push({ id, items: structuredClone(items), touched }),
      reject: message => errors.push({ id, message }), status: () => {},
      receipt: result => receipts.push({ id, result: structuredClone(result) }),
    });
    session.seed({ box: shape }); sessions.set(id, session); return session;
  };
  ids.forEach(add);
  const configure = () => {
    const members = [...online].map(peer);
    const host = { protocol: 1, term: `term-${++term}`, peer_id: electHost(members), members };
    for (const id of online) sessions.get(id).configure(id, host);
    return host;
  };
  const deliver = () => {
    for (let count = 0; queue.length; count++) {
      assert.ok(count < 10000, 'protocol must not loop synchronously');
      const { origin, target, message } = queue.shift();
      if (online.has(origin) && online.has(target)) sessions.get(target).receive(origin, message);
    }
  };
  const advance = (ms = 34) => { time += ms; for (const id of online) sessions.get(id).tick(); deliver(); };
  const synchronize = () => { for (let i = 0; i < 6; i++) advance(); for (const id of online) assert.equal(sessions.get(id).ready, true, `${id} synchronizes`); };
  configure(); synchronize();
  return { sessions, saved, errors, published, receipts, queue, online, add, configure, deliver, advance, synchronize };
}

test('highest eligible ID wins; disconnected membership is not silently removed', () => {
  assert.equal(electHost([peer('a'), peer('z')]), 'z');
  assert.equal(electHost([{ ...peer('a'), is_admin: true }, { ...peer('z'), groups: ['private'] }]), 'a');
  assert.equal(electHost([{ ...peer('a'), groups: ['one'] }, { ...peer('z'), groups: ['two'] }]), '');
  const net = network();
  net.online.delete('z'); net.advance();
  assert.equal(net.sessions.get('a').isHost, false);
  assert.equal(net.sessions.get('a').hostId, 'z');
});

test('a follower proposal is not applied before host acceptance', () => {
  const net = network(); const follower = net.sessions.get('a'), host = net.sessions.get('z');
  assert.equal(follower.submit([{ id: 'box', action: 'patch', patch: { x: 20 } }]), true);
  assert.equal(follower.items.box.x, 0); assert.equal(host.items.box.x, 0);
  net.advance();
  assert.equal(follower.items.box.x, 0, 'delivery to host only queues the proposal');
  net.advance();
  assert.equal(host.items.box.x, 20); assert.equal(follower.items.box.x, 20);
  assert.equal(follower.pending.size, 0);
});

test('host and follower proposals are sampled at 30 FPS; only host persists at 10 FPS', () => {
  const net = network(); const host = net.sessions.get('z');
  net.saved.length = 0;
  host.submit([{ id: 'box', action: 'patch', patch: { x: 1 } }]);
  net.advance(1); assert.equal(host.items.box.x, 0);
  net.advance(33); assert.equal(host.items.box.x, 1);
  for (let i = 2; i < 9; i++) { host.submit([{ id: 'box', action: 'patch', patch: { x: i } }]); net.advance(34); }
  assert.ok(net.saved.length > 0);
  assert.ok(net.saved.every(save => save.host === 'z'));
  for (let i = 1; i < net.saved.length; i++) assert.ok(net.saved[i].time - net.saved[i - 1].time >= 100);
});

test('new users wait for a full snapshot barrier and receive unsaved approved changes', () => {
  const net = network(); const host = net.sessions.get('z');
  host.submit([{ id: 'box', action: 'patch', patch: { x: 77 } }]); net.advance();
  const newcomer = net.add('b'); net.configure();
  assert.equal(newcomer.ready, false); assert.equal(newcomer.submit([{ id: 'box', action: 'delete' }]), false);
  assert.equal(host.ready, false);
  net.synchronize();
  assert.equal(newcomer.items.box.x, 77);
});

test('successor preserves accepted updates and tombstones through a host change', () => {
  const net = network(['a', 'b', 'z']); const old = net.sessions.get('z');
  old.submit([{ id: 'box', action: 'delete' }]); net.advance();
  assert.equal(net.sessions.get('a').items.box, undefined);
  net.online.delete('z'); const grant = net.configure();
  assert.equal(grant.peer_id, 'b'); net.synchronize();
  assert.equal(net.sessions.get('b').items.box, undefined);
  assert.ok(net.saved.some(save => save.host === 'b' && save.changes.some(change => change.id === 'box' && change.record.item === null)));
  const late = net.add('c'); net.configure(); net.synchronize();
  assert.equal(late.items.box, undefined, 'stale server snapshot cannot resurrect a deletion');
});

test('duplicates, wrong senders and old terms cannot apply a second write', () => {
  const net = network(); const host = net.sessions.get('z'), follower = net.sessions.get('a');
  const proposal = host.frame('host_proposal', { clientId: follower.clientId, requestCount: 1, requestId: `${follower.clientId}-1`, operations: [{ id: 'box', action: 'patch', patch: { x: 5 } }] });
  host.receive('a', proposal); net.advance(); const sequence = host.sequence;
  host.receive('a', proposal); net.advance(); assert.equal(host.sequence, sequence);
  follower.receive('a', host.frame('host_commits', { commits: [{ sequence: follower.sequence + 1, records: {} }] }));
  assert.equal(follower.sequence, sequence);
  follower.receive('z', { ...host.frame('host_snapshot', { sequence: 100, records: {} }), term: 'old-term' });
  assert.equal(follower.items.box.x, 5);
});

test('a commit gap blocks editing until resynchronization', () => {
  const net = network(); const follower = net.sessions.get('a'), host = net.sessions.get('z');
  follower.receive('z', host.frame('host_commits', { commits: [{ sequence: 9, records: {} }] }));
  assert.equal(follower.ready, false);
  net.deliver(); net.advance();
  assert.equal(follower.ready, true);
});

test('permission denial is atomic and never reaches server storage', () => {
  const net = network(); net.saved.length = 0;
  net.sessions.get('a').submit([{ id: 'box', action: 'patch', patch: { x: 9 } },
    { id: 'secret', action: 'create', patch: { ...shape, permission: 'private' } }]);
  net.advance(); net.advance();
  assert.equal(net.sessions.get('z').items.box.x, 0);
  assert.equal(net.saved.length, 0); assert.ok(net.errors.length);
});

test('persistence failure freezes the session rather than enabling a second host', () => {
  const net = network(); const host = net.sessions.get('z');
  host.abort('storage unavailable'); net.deliver(); net.advance();
  assert.equal(host.ready, false); assert.equal(net.sessions.get('a').ready, false);
  assert.equal(host.submit([{ id: 'box', action: 'delete' }]), false);
});

test('host merges concurrent Automerge branches instead of replacing a newer edit', () => {
  const doc = Automerge.from({ content: 'hello' });
  const base = encodeBase64(Automerge.save(doc));
  const item = { kind: 'text', text: 'hello', x: 0, y: 0, permission: 'default', automerge_snapshot: base, automerge_changes: [] };
  const left = Automerge.change(Automerge.clone(doc), d => Automerge.splice(d, ['content'], 0, 0, 'A'));
  const right = Automerge.change(Automerge.clone(doc), d => Automerge.splice(d, ['content'], 5, 0, 'B'));
  const op = branch => ({ id: 'text', action: 'patch', patch: {}, doc: encodeBase64(Automerge.save(branch)) });
  const first = reduceHostOperations({ text: item }, [op(left)], peer('a'));
  const second = reduceHostOperations(first.items, [op(right)], peer('b'));
  assert.equal(second.items.text.text, 'AhelloB');
  assert.equal(loadItemDoc(second.items.text).content, 'AhelloB');
  assert.equal(itemOperations({ text: item }, { text: { ...item, text: 'Ahello' } }, new Map([['text', left]]))[0].action, 'patch');
});

test('stored versions and deletion markers survive a complete session restart', () => {
  const net = network(); const host = net.sessions.get('z');
  host.submit([{ id: 'box', action: 'delete' }]); net.advance(); net.advance(100);
  const tombstone = storedHostItem(host.records.box);
  const restarted = network(['a']); const fresh = restarted.sessions.get('a');
  fresh.seed({ box: tombstone });
  assert.equal(fresh.items.box, undefined);
  fresh.seed({ box: shape });
  assert.equal(fresh.items.box, undefined, 'unversioned stale baseline cannot restore the object');
  const version = { clock: tombstone.__host_version.clock + 1, actor: 'new-host' };
  fresh.seed({ box: storedHostItem({ item: { ...shape, x: 80 }, version }) });
  assert.equal(fresh.items.box.x, 80);
  fresh.mergeState({ box: host.records.box }, peer('z'));
  assert.equal(fresh.items.box.x, 80, 'stale replica deletion cannot override newer stored state');
});

test('large live commits apply atomically after all ordered parts arrive', () => {
  const net = network(); const host = net.sessions.get('z'), follower = net.sessions.get('a');
  const record = { item: { ...shape, label: 'x'.repeat(3 * 1024 * 1024) }, version: { clock: 999, actor: 'z' }, permission: 'default' };
  assert.equal(host.sendRecords('a', 'host_commit', { first: record, second: record }, { sequence: 1, origin: 'z', requestId: 'large' }), true);
  assert.equal(net.queue.length, 2);
  const first = net.queue.shift(); follower.receive(first.origin, first.message);
  assert.equal(follower.items.first, undefined);
  assert.equal(follower.sequence, 0);
  net.deliver();
  assert.equal(follower.items.first.label.length, 3 * 1024 * 1024);
  assert.equal(follower.items.second.label.length, 3 * 1024 * 1024);
  assert.equal(follower.sequence, 1);
});

test('multipart snapshot resumes after backpressure without replaying queued parts', () => {
  const net = network(); const host = net.sessions.get('z'); const original = host.send;
  const record = { item: { ...shape, label: 'x'.repeat(3 * 1024 * 1024) }, version: { clock: 999, actor: 'z' }, permission: 'default' };
  let sent = 0;
  host.send = (id, frame) => ++sent === 2 ? false : original(id, frame);
  assert.equal(host.sendRecords('a', 'host_snapshot', { first: record, second: record }, { sequence: 0 }), false);
  host.send = original;
  assert.equal(host.sendRecords('a', 'host_snapshot', { first: record, second: record }, { sequence: 0 }), true);
  assert.deepEqual(net.queue.map(entry => entry.message.index), [0, 1]);
  net.deliver(); assert.equal(net.sessions.get('a').items.second.label.length, 3 * 1024 * 1024);
});

test('access eviction does not create a false deletion in successor state', () => {
  const net = network(); const host = net.sessions.get('z'), follower = net.sessions.get('a');
  host.member('z').is_admin = true;
  host.submit([{ id: 'box', action: 'patch', patch: { permission: 'private' } }]); net.advance();
  assert.equal(host.items.box.permission, 'private');
  assert.equal(follower.items.box, undefined);
  assert.equal(follower.records.box, undefined, 'revoked access is not a deletion tombstone');
});

test('partial persistence admission retains records not accepted by the batch', () => {
  const net = network(['z']); const host = net.sessions.get('z');
  host.persist = () => ['one'];
  host.submit([{ id: 'one', action: 'create', patch: shape }, { id: 'two', action: 'create', patch: shape }]);
  net.advance(100);
  assert.equal(host.serverDirty.has('one'), false);
  assert.equal(host.serverDirty.has('two'), true);
});

test('object changes use the host channel while cursor and laser remain direct', () => {
  const mesh = new CanvasPeerMesh({}); const sent = [];
  const channel = label => ({ readyState: 'open', bufferedAmount: 0, send: raw => sent.push({ label, payload: JSON.parse(raw) }) });
  for (const id of ['host', 'other']) mesh.peers.set(id, {
    metadata: peer(id), sync: channel(`${id}:sync`), bulk: channel(`${id}:bulk`), cursor: channel(`${id}:cursor`),
    syncQueue: [], bulkQueue: [], syncQueuedSize: 0, bulkQueuedSize: 0,
  });
  mesh.sendData({ type: 'item_update', item: shape });
  mesh.sendRealtimeData({ type: 'item_update', item: shape });
  assert.equal(sent.length, 0, 'legacy object broadcasts are disabled');
  assert.equal(mesh.sendHostData('host', { type: 'host_proposal', operations: [] }), true);
  assert.deepEqual(sent.map(frame => frame.label), ['host:sync']);
  sent.length = 0;
  mesh.sendRealtimeData({ type: 'cursor', x: 1, y: 2 });
  mesh.sendRealtimeData({ type: 'laser', points: [] });
  assert.deepEqual(sent.map(frame => frame.label), ['host:cursor', 'other:cursor', 'host:cursor', 'other:cursor']);
});

test('host handoff retains unsent and in-flight requests and accepts more work during sync', () => {
  const net = network(['a', 'b', 'z']); const author = net.sessions.get('a');
  author.submit([{ id: 'draft', action: 'create', patch: shape }]);
  author.lastPeerTick = -Infinity; author.tick(); // Sent, but not delivered or approved.
  assert.equal(author.pending.size, 1);
  const requestId = [...author.pending.keys()][0];
  net.online.delete('z'); net.configure();
  assert.equal(author.ready, false); assert.equal(author.editable, true);
  assert.equal(author.submit([{ id: 'draft', action: 'patch', patch: { x: 25 } }]), true);
  assert.equal(author.submit([{ id: 'next', action: 'create', patch: shape }]), true);
  assert.equal([...author.pending.keys()][0], requestId, 'request identity survives election');
  assert.equal(author.items.draft, undefined, 'queued previews are not committed state');
  net.synchronize(); for (let i = 0; i < 6; i++) net.advance();
  for (const id of net.online) {
    assert.equal(net.sessions.get(id).items.draft.x, 25);
    assert.ok(net.sessions.get(id).items.next);
  }
  assert.equal(author.pending.size, 0); assert.equal(author.localQueue.length, 0);
  assert.equal(net.errors.length, 0);
});

test('users can keep editing while an earlier request awaits its commit', () => {
  const net = network(); const author = net.sessions.get('a');
  author.submit([{ id: 'new', action: 'create', patch: shape }]); net.advance();
  assert.equal(author.pending.size, 1);
  assert.equal(author.submit([{ id: 'new', action: 'patch', patch: { x: 12 } }]), true);
  assert.equal(author.submit([{ id: 'box', action: 'patch', patch: { x: 45 } }]), true);
  assert.equal(author.localQueue.length, 2);
  for (let i = 0; i < 5; i++) net.advance();
  assert.equal(author.items.new.x, 12); assert.equal(author.items.box.x, 45);
  const approvals = net.receipts.filter(entry => entry.id === 'a' && entry.result.status === 'accepted');
  assert.equal(approvals.length, 2);
  assert.deepEqual(approvals[0].result.summary, { total: 1, created: 1, updated: 0, deleted: 0 });
  assert.deepEqual(approvals[1].result.summary, { total: 2, created: 0, updated: 2, deleted: 0 });
});

test('a successor learns counters and confirms a creation whose reply was lost without replaying it', () => {
  const net = network(['a', 'b', 'z']); const author = net.sessions.get('a'), old = net.sessions.get('z');
  author.submit([{ id: 'once', action: 'create', patch: shape }]); net.advance();
  const requestId = [...author.pending.keys()][0];
  old.tick(); // Next boundary is needed to approve the host inbox.
  old.lastPeerTick = -Infinity; old.tick();
  net.queue.splice(0, net.queue.length, ...net.queue.filter(frame => frame.target !== 'a'));
  net.deliver();
  assert.ok(net.sessions.get('b').items.once); assert.equal(author.items.once, undefined);
  assert.equal(author.pending.has(requestId), true);
  net.online.delete('z'); net.configure(); net.synchronize();
  assert.ok(author.items.once); assert.equal(author.pending.size, 0);
  assert.equal(net.errors.length, 0, 'replayed create must not be rejected as an existing ID');
  assert.equal(net.sessions.get('b').sequence, 0, 'matching counter acknowledgement retires the request without a second commit');
  assert.ok(net.receipts.some(entry => entry.id === 'a' && entry.result.requestId === requestId && entry.result.status === 'accepted'));
});

test('hosts respond during synchronization, then validate a retry without caching its rejection', () => {
  const net = network(); const host = net.sessions.get('z'), author = net.sessions.get('a');
  host.pause();
  host.receive('a', host.frame('host_proposal', { requestId: 'busy', operations: [{ id: 'box', action: 'delete' }] }));
  assert.equal(net.queue.at(-1).message.type, 'host_retry');
  assert.equal(host.inbox.length, 0);
  net.queue.length = 0; net.advance();
  const proposal = host.frame('host_proposal', { clientId: author.clientId, requestCount: 1, requestId: `${author.clientId}-1`, operations: [{ id: 'box', action: 'patch', patch: { permission: 'private' } }] });
  host.receive('a', proposal);
  assert.equal(net.queue.at(-1).message.type, 'host_received');
  host.lastPeerTick = -Infinity; host.tick();
  const rejection = net.queue.find(frame => frame.message.type === 'host_reject').message;
  assert.equal(rejection.status, 'rejected'); assert.ok(rejection.message);
  net.queue.length = 0; host.receive('a', proposal);
  assert.equal(net.queue.at(-1).message.type, 'host_received');
  host.lastPeerTick = -Infinity; host.tick();
  assert.deepEqual(net.queue.find(frame => frame.message.type === 'host_reject').message, rejection);
  assert.equal(host.lastCounts.get(host.clientKey(peer('a'), author.clientId)), 0);
  assert.equal(host.items.box.permission, 'default');
});

test('the initial loading gate remains closed, and a fault does not discard queued work', () => {
  const net = network(); const fresh = net.add('first'); net.configure();
  assert.equal(fresh.editable, false);
  assert.equal(fresh.submit([{ id: 'box', action: 'delete' }]), false);
  const author = net.sessions.get('a');
  author.submit([{ id: 'box', action: 'patch', patch: { x: 9 } }]);
  author.abort('temporarily unavailable');
  assert.equal(author.editable, false);
  assert.equal(author.localQueue.length, 1);
  assert.equal(author.submit([{ id: 'box', action: 'delete' }]), false);
  net.configure(); assert.equal(author.editable, true);
});

test('offline editing queues without sending and returns a replayed acceptance summary', () => {
  const net = network(); const author = net.sessions.get('a'), host = net.sessions.get('z');
  author.available = () => false; author.tick();
  assert.equal(author.ready, false); assert.equal(author.editable, true);
  assert.equal(author.submit([{ id: 'box', action: 'patch', patch: { x: 90 } }]), true);
  net.advance(100);
  assert.equal(author.localQueue.length, 1); assert.equal(host.items.box.x, 0);
  author.available = () => true;
  net.configure(); net.synchronize(); for (let i = 0; i < 3; i++) net.advance();
  assert.equal(author.items.box.x, 90);
  const approval = net.receipts.find(entry => entry.id === 'a' && entry.result.status === 'accepted').result;
  net.queue.length = 0;
  host.receive('a', host.frame('host_proposal', { clientId: author.clientId, requestCount: approval.requestCount, requestId: approval.requestId, operations: [{ id: 'box', action: 'patch', patch: { x: 0 } }] }));
  assert.equal(net.queue.at(-1).message.type, 'host_ack');
  assert.equal(net.queue.at(-1).message.lastCount, approval.requestCount);
  assert.equal(net.queue.at(-1).message.duplicate, true);
  assert.equal(host.items.box.x, 90);
});

test('queued CRDT branches merge with changes approved during reconnection', () => {
  const net = network(['a', 'b', 'z']); const author = net.sessions.get('a'), successor = net.sessions.get('b');
  const doc = Automerge.from({ content: 'hello' });
  const item = { kind: 'text', text: 'hello', x: 0, y: 0, permission: 'default', automerge_snapshot: encodeBase64(Automerge.save(doc)), automerge_changes: [] };
  for (const session of net.sessions.values()) session.seed({ text: item });
  const left = Automerge.change(Automerge.clone(doc), d => Automerge.splice(d, ['content'], 0, 0, 'A'));
  const right = Automerge.change(Automerge.clone(doc), d => Automerge.splice(d, ['content'], 5, 0, 'B'));
  net.sessions.get('z').submit([{ id: 'text', action: 'patch', patch: {}, doc: encodeBase64(Automerge.save(right)) }]);
  net.advance();
  net.online.delete('z'); net.configure();
  assert.equal(author.submit([{ id: 'text', action: 'patch', patch: {}, doc: encodeBase64(Automerge.save(left)) }]), true);
  net.synchronize(); for (let i = 0; i < 3; i++) net.advance();
  assert.equal(author.items.text.text, 'AhelloB'); assert.equal(successor.items.text.text, 'AhelloB');
});

test('a queued request retains its identity after the client gets a different RTC peer ID', () => {
  const net = network(); const author = net.sessions.get('a');
  author.submit([{ id: 'box', action: 'patch', patch: { x: 19 } }]);
  author.lastPeerTick = -Infinity; author.tick();
  const requestId = [...author.pending.keys()][0];
  const host = { protocol: 1, term: 'rebound', peer_id: 'z', members: [peer('new-a'), peer('z')] };
  author.configure('new-a', host);
  assert.equal(author.editable, true); assert.equal(author.pending.has(requestId), true);
  author.receive('z', author.frame('host_snapshot', { sequence: 0, records: { box: { item: { ...shape, x: 19 }, permission: 'default', version: { clock: 900, actor: 'z' } } },
    counters: [[author.clientKey(peer('new-a'), author.clientId), 1]] }));
  assert.equal(author.pending.size, 1, 'snapshot alone is not a success response');
  author.receive('z', author.frame('host_ack', { requestId, clientId: author.clientId, requestCount: 1, lastCount: 1, sequence: 0, status: 'accepted' }));
  assert.equal(author.pending.size, 0); assert.equal(author.items.box.x, 19);
});

test('a rejection does not advance counters or release the queued next request during handoff', () => {
  const net = network(['a', 'b', 'z']); const author = net.sessions.get('a');
  author.submit([{ id: 'box', action: 'patch', patch: { permission: 'private' } }]);
  net.advance(); const requestId = [...author.pending.keys()][0]; net.advance();
  assert.equal(author.pending.get(requestId).stage, 'rejected');
  author.submit([{ id: 'box', action: 'delete' }]);
  net.online.delete('z'); net.configure(); net.synchronize();
  const successor = net.sessions.get('b');
  assert.equal(author.pending.size, 1); assert.equal(author.localQueue.length, 1);
  assert.equal(author.pending.get(requestId).stage, 'rejected');
  assert.equal(successor.lastCounts.get(successor.clientKey(peer('a'), author.clientId)), 0);
  assert.ok(successor.items.box);
});

test('an approval receipt before its commit leaves the draft pending', () => {
  const net = network(); const author = net.sessions.get('a'), host = net.sessions.get('z');
  author.submit([{ id: 'box', action: 'patch', patch: { x: 15 } }]); net.advance();
  const requestId = [...author.pending.keys()][0];
  host.lastPeerTick = -Infinity; host.tick();
  const ack = net.queue.find(frame => frame.message.type === 'host_ack');
  assert.ok(ack);
  author.receive(ack.origin, ack.message);
  assert.equal(author.pending.has(requestId), true);
  assert.equal(author.items.box.x, 0);
  net.deliver();
  assert.equal(author.pending.has(requestId), false); assert.equal(author.items.box.x, 15);
  assert.equal(net.receipts.filter(entry => entry.id === 'a' && entry.result.status === 'accepted').length, 1);
});

test('a committed change without its matching success response cannot release the next request', () => {
  const net = network(); const author = net.sessions.get('a'), host = net.sessions.get('z');
  author.submit([{ id: 'box', action: 'patch', patch: { x: 10 } }]); net.advance();
  const requestId = [...author.pending.keys()][0];
  author.submit([{ id: 'box', action: 'patch', patch: { x: 20 } }]);
  const send = host.send; let loseAck = true;
  host.send = (target, message) => target === 'a' && message.type === 'host_ack' && loseAck ? true : send(target, message);
  net.advance();
  assert.equal(author.items.box.x, 10, 'broadcast is applied');
  assert.equal(author.pending.has(requestId), true, 'broadcast does not replace the explicit success response');
  assert.equal(author.localQueue.length, 1);
  net.advance(100); assert.equal(host.items.box.x, 10); assert.equal(author.localCounter, 1);
  loseAck = false; net.advance(500);
  assert.equal(author.pending.size, 0); assert.equal(host.items.box.x, 10);
  net.advance(); net.advance();
  assert.equal(host.items.box.x, 20); assert.equal(author.localCounter, 2);
});

test('only an exact request ID, client session, count and applied sequence unlock the next send', () => {
  const net = network(); const author = net.sessions.get('a'), host = net.sessions.get('z');
  author.submit([{ id: 'box', action: 'patch', patch: { x: 8 } }]); net.advance();
  const requestId = [...author.pending.keys()][0];
  const ack = host.frame('host_ack', { requestId, clientId: author.clientId, requestCount: 1, lastCount: 1, sequence: 0, status: 'accepted' });
  for (const invalid of [
    { ...ack, clientId: 'other-client' }, { ...ack, requestId: 'other-request' },
    { ...ack, requestCount: 2 }, { ...ack, lastCount: 2 }, { ...ack, sequence: -1 },
    { ...ack, status: 'received' }, { ...ack, term: 'old-term' },
  ]) author.receive('z', invalid);
  author.receive('a', ack);
  assert.equal(author.pending.has(requestId), true);
  net.advance(); assert.equal(author.pending.size, 0);
});

test('old, equal and skipped counts never reapply a write; the next consecutive count does', () => {
  const net = network(); const author = net.sessions.get('a'), host = net.sessions.get('z');
  for (let count = 1; count <= 2; count++) {
    author.submit([{ id: 'box', action: 'patch', patch: { x: count } }]); net.advance(); net.advance();
  }
  const key = host.clientKey(peer('a'), author.clientId);
  assert.equal(host.lastCounts.get(key), 2); const sequence = host.sequence;
  const proposal = count => host.frame('host_proposal', { clientId: author.clientId, requestCount: count,
    requestId: `${author.clientId}-${count}`, operations: [{ id: 'box', action: 'patch', patch: { x: 100 } }] });
  for (const count of [1, 2, 4, -1, 1.5]) host.receive('a', proposal(count));
  net.advance(); assert.equal(host.sequence, sequence); assert.equal(host.items.box.x, 2);
  assert.equal(host.lastCounts.get(key), 2);
  host.receive('a', proposal(3)); net.advance();
  assert.equal(host.lastCounts.get(key), 3); assert.equal(host.items.box.x, 100);
});

test('count handshakes bind one stable client session to each authenticated peer', () => {
  const net = network(); const author = net.sessions.get('a'), host = net.sessions.get('z');
  assert.equal(author.clientRegistered, true);
  const original = host.peerClients.get('a');
  host.receive('a', host.frame('host_client_hello', { clientId: 'changed-client' }));
  assert.equal(net.queue.at(-1).message.ok, false); assert.equal(host.peerClients.get('a'), original);
  host.receive('a', host.frame('host_proposal', { clientId: 'changed-client', requestCount: 1,
    requestId: 'changed-client-1', operations: [{ id: 'box', action: 'delete' }] }));
  assert.equal(net.queue.at(-1).message.type, 'host_retry'); assert.ok(host.items.box);
});

test('request deduplication keeps one integer per client, regardless of request history length', () => {
  const net = network(['z']); const host = net.sessions.get('z');
  for (let count = 1; count <= 1000; count++) {
    host.submit([{ id: 'box', action: 'patch', patch: { x: count } }]); net.advance();
  }
  assert.equal(host.lastCounts.size, 1);
  assert.deepEqual([...host.lastCounts.values()], [1000]);
  assert.equal(host.receipts, undefined, 'no retained receipt history');
  assert.equal(host.pending.size, 0); assert.equal(host.broadcasts.length, 0);
});

test('a rejected head blocks later work and retries only the same request count', () => {
  const net = network(); const author = net.sessions.get('a'), host = net.sessions.get('z');
  author.submit([{ id: 'box', action: 'patch', patch: { permission: 'private' } }]); net.advance();
  const requestId = [...author.pending.keys()][0];
  author.submit([{ id: 'box', action: 'patch', patch: { x: 99 } }]); net.advance();
  assert.equal(author.pending.get(requestId).stage, 'rejected');
  for (let i = 0; i < 3; i++) net.advance(500);
  assert.equal(host.items.box.x, 0); assert.equal(author.localCounter, 1);
  // An administrator can now approve the exact same previously denied request.
  host.member('a').is_admin = true;
  author.member('a').is_admin = true;
  author.retryRejected(); net.advance(); net.advance();
  assert.equal(author.pending.has(requestId), false);
  assert.equal(author.localCounter, 1, 'retry did not allocate a new count');
  assert.equal(host.lastCounts.get(host.clientKey(peer('a'), author.clientId)), 1);
  // The follow-up remains separate and is sent only after that success.
  assert.equal(author.localQueue.length, 1); assert.equal(host.items.box.x, 0);
});
