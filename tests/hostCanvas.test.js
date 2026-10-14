import test from 'node:test';
import assert from 'node:assert/strict';
import * as Automerge from '@automerge/automerge';
import { HostCanvasSession } from '../src/canvas/host/HostCanvasSession.js';
import { electHost, itemOperations, loadItemDoc, reduceHostOperations, storedHostItem } from '../src/canvas/host/hostOperations.js';
import { encodeBase64 } from '../src/canvas/collaborativeSync.js';
import CanvasBrokerPeers from '../src/components/CanvasBrokerPeers.js';

const peer = id => ({ peer_id: id, groups: ['default'], is_admin: false });
const shape = { kind: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 0.1, height: 0.1, permission: 'default' };
function network(ids = ['a', 'z'], initialItems = { box: shape }) {
  let time = 0; let term = 0;
  const queue = [], sessions = new Map(), saved = [], errors = [], published = [], receipts = [], sent = [];
  const online = new Set(ids);
  const add = id => {
    online.add(id);
    const session = new HostCanvasSession({
      now: () => time, available: () => online.has(id),
      send: (target, message) => {
        if (!online.has(target)) return false;
        sent.push({origin:id,target,message:structuredClone(message)});
        queue.push({ origin: id, target, message: structuredClone(message) }); return true;
      },
      persist: (changes, epoch) => { saved.push({ host: id, time, epoch, changes: structuredClone(changes) }); return true; },
      publish: (items, touched) => published.push({ id, items: structuredClone(items), touched }),
      reject: message => errors.push({ id, message }), status: () => {},
      receipt: result => receipts.push({ id, result: structuredClone(result) }),
    });
    session.seed(initialItems); sessions.set(id, session); return session;
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
  return { sessions, saved, errors, published, receipts, sent, queue, online, add, configure, deliver, advance, synchronize };
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

test('a server without host protocol fails visibly instead of waiting forever', () => {
  const net = network(['a']);
  const session = net.sessions.get('a');
  let status;
  session.status = next => { status = next; };
  session.configure('a', undefined);
  assert.equal(session.ready, false);
  assert.equal(session.editable, false);
  assert.match(status.message, /프로토콜을 지원하지/);
  net.configure(); net.synchronize();
  assert.equal(session.editable, true);
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
  const net = network(); const host = net.sessions.get('z'), follower = net.sessions.get('a');host.partAckPeers.clear();
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
  const net = network(); const host = net.sessions.get('z'); const original = host.send;host.partAckPeers.clear();
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

test('object changes use host commits while cursor and laser use broker broadcasts', () => {
  const sent = [];
  const mesh = new CanvasBrokerPeers({ sendSignal: frame => { sent.push(frame); return true; } });
  mesh.setInitialPeers('self', [peer('host'), peer('other')]);
  mesh.sendData({ type: 'item_update', item: shape });
  mesh.sendRealtimeData({ type: 'item_update', item: shape });
  assert.equal(sent.length, 0, 'legacy object broadcasts are disabled');
  assert.equal(mesh.sendHostData('host', { type: 'host_proposal', operations: [] }), true);
  assert.deepEqual(sent[0].peer_ids, ['host']);
  sent.length = 0;
  mesh.sendRealtimeData({ type: 'cursor', x: 1, y: 2 });
  mesh.sendRealtimeData({ type: 'laser', points: [] });
  assert.deepEqual(sent.map(frame => frame.payload.type), ['cursor', 'laser']);
  assert.ok(sent.every(frame => frame.peer_ids.join(',') === 'host,other'));
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

test('duplicate proposals consume one host inbox slot before approval', () => {
  const net = network(); const follower = net.sessions.get('a'), host = net.sessions.get('z');
  follower.submit([{ id: 'box', action: 'patch', patch: { x: 8 } }]);
  net.advance();
  assert.equal(host.inbox.length, 1);
  const entry = host.inbox[0];
  for (let i = 0; i < 1000; i++) host.receive('a', host.frame('host_proposal', {
    clientId: entry.clientId, requestCount: entry.requestCount, requestId: entry.requestId, operations: entry.operations,
  }));
  assert.equal(host.inbox.length, 1);
  net.advance();
  assert.equal(host.items.box.x, 8);
  assert.equal(host.sequence, 1);
});

test('unavailable broker drops ephemeral updates and reports failed sends', () => {
  const mesh = new CanvasBrokerPeers({ sendSignal: () => false });
  mesh.setInitialPeers('self', [peer('other')]);
  assert.equal(mesh.sendCursor({ type: 'cursor', x: 1 }), false);
  assert.equal(mesh.sendLaser({ type: 'laser', x: 2 }), false);
});

test('a slow peer bounds commit retention and resumes every queued edit in order', () => {
  const net = network(); const host = net.sessions.get('z'), follower = net.sessions.get('a');
  const send = host.send; let congested = true;
  host.send = (id, data) => congested && data.type === 'host_commit' ? false : send(id, data);
  for (let x = 1; x <= 300; x++) {
    host.submit([{ id: 'box', action: 'patch', patch: { x } }]); net.advance();
  }
  assert.equal(host.broadcasts.length, 256);
  assert.ok(host.pendingOperations.length > 0);
  assert.ok(host.inbox.length <= 1, 'local retries must not fill the inbox');
  congested = false;
  for (let i = 0; i < 10; i++) net.advance();
  assert.equal(host.pendingOperations.length, 0);
  assert.equal(host.broadcasts.length, 0);
  assert.equal(host.items.box.x, 300);
  assert.equal(follower.items.box.x, 300);
});

test('drawing frames and eraser tombstones reach late joiners before the next persistence tick', async () => {
  const { applyStrokeFrame } = await import('../src/canvas/strokeFrameChanges.js');
  const net = network();
  const author = net.sessions.get('a'), host = net.sessions.get('z');
  const persistedBefore = net.saved.length;
  host.persist = () => false; // Simulate storage backpressure throughout joining.
  const stroke = { kind: 'stroke', points: [{ x: 0.1, y: 0.1 }], color: '#222222', strokeWidth: 3, complete: false, permission: 'default' };
  const apply = frame => {
    const previous = author.items;
    assert.equal(author.submit(itemOperations(previous, applyStrokeFrame(previous, frame), new Map())), true);
    net.advance(); net.advance();
  };
  apply([{ id: 'live-stroke', payload: { type: 'item_update', item: stroke } }]);
  const points = [...stroke.points, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.2 }];
  apply([{ id: 'live-stroke', payload: { type: 'item_update', item: { ...stroke, points } } }]);
  assert.equal(host.items['live-stroke'].complete, false);
  assert.equal(host.items['live-stroke'].points.length, 3);
  assert.ok(host.items.box, 'frame updates preserve unrelated items');
  const newcomer = net.add('b');
  net.configure();
  assert.equal(newcomer.editable, false);
  net.synchronize();
  assert.deepEqual(newcomer.items['live-stroke'].points, points);
  apply([{ id: 'live-stroke', payload: { type: 'item_delete' } }]);
  assert.equal(newcomer.items['live-stroke'], undefined);
  assert.equal(host.records['live-stroke'].item, null);
  assert.equal(net.saved.length, persistedBefore, 'joining must use approved live state, not wait for storage');
  const later = net.add('c'); net.configure(); net.synchronize();
  assert.equal(later.items['live-stroke'], undefined, 'a deleted drawing cannot reappear in a late snapshot');
});

test('local text queue coalesces causal successors but preserves independent branches',()=>{
 const net=network(['z']),host=net.sessions.get('z');
 const base=Automerge.from({content:'a'}),first=Automerge.change(Automerge.clone(base),d=>{d.content+='b'}),second=Automerge.change(first,d=>{d.content+='c'});
 const op=doc=>({id:'text',action:'patch',patch:{text:doc.content},doc:encodeBase64(Automerge.save(doc))});
 // first is now a historical view; serialize its exact heads via a fork.
 const earlier=Automerge.clone(first);
 host.submit([op(earlier)]);host.submit([op(second)]);assert.equal(host.localQueue.length,1);assert.equal(host.localQueue[0].patch.text,'abc');
 const independent=Automerge.change(Automerge.clone(base),d=>{d.content+='x'});
 host.submit([op(independent)]);assert.equal(host.localQueue.length,2);
});

test('group translation proposals and commits contain only IDs and one displacement, including strokes and text', () => {
  const doc=Automerge.from({content:'unchanged collaborative text'});
  const fixtures={box:shape,other:{...shape,x:.3},text:{kind:'text',text:doc.content,x:.2,y:.1,width:.2,height:.1,permission:'default',automerge_snapshot:encodeBase64(Automerge.save(doc)),automerge_changes:[]},ink:{kind:'stroke',points:[{x:.1,y:.2,pressure:.7},{x:.2,y:.3,pressure:.5}],strokeWidth:3,permission:'default'},image:{kind:'image',src:'data:image/png;base64,'+'a'.repeat(100000),x:0,y:0,width:.1,height:.1,permission:'default'}};
  const net=network(['a','z'],fixtures),author=net.sessions.get('a'),host=net.sessions.get('z');net.sent.length=0;
  assert.equal(author.hostSupportsTranslations,true);
  author.submit([{action:'translate',ids:Object.keys(fixtures),dx:.05,dy:-.02}]);net.advance();net.advance();
  const proposal=net.sent.find(e=>e.message.type==='host_proposal').message;
  const commit=net.sent.find(e=>e.message.type==='host_commit').message;
  assert.equal(JSON.stringify(proposal).length<1000,true);assert.equal(JSON.stringify(commit).length<1000,true);
  assert.equal(commit.records,undefined);assert.deepEqual(commit.translations,[{ids:Object.keys(fixtures),dx:.05,dy:-.02}]);
  assert.deepEqual(author.items,host.items);assert.equal(host.items.box.x,.05);
  assert.equal(host.items.ink.points[0].x,.1+.05);
  assert.equal(host.items.ink.points[0].pressure,.7);assert.equal(host.items.text.text,doc.content);
  assert.equal(host.items.text.automerge_snapshot,fixtures.text.automerge_snapshot);assert.equal(host.items.image.src,fixtures.image.src);
  author.receive('z',structuredClone(commit));assert.equal(author.items.box.x,.05,'duplicate commits do not move twice');
  net.advance(110);assert.ok(net.saved.some(save=>save.changes.some(change=>change.id==='ink'&&change.record.item.points[0].x===host.items.ink.points[0].x)));
});

test('translations coalesce between 100ms samples and flush the final displacement immediately', () => {
  const net=network(['z']),host=net.sessions.get('z');
  host.submit([{action:'translate',ids:['box'],dx:.01,dy:.02}]);net.advance();assert.equal(host.items.box.x,.01);
  for(let i=0;i<3;i++){host.submit([{action:'translate',ids:['box'],dx:.01,dy:.02}]);net.advance(10);}
  assert.equal(host.items.box.x,.01);assert.equal(host.localQueue.length,1);
  assert.equal(host.localQueue[0].dx,.03);host.flushMoves();
  assert.equal(host.items.box.x,.04);assert.equal(host.items.box.y,.08);
});

test('simultaneous relative moves compose and a new user receives their latest absolute positions', () => {
  const net=network(['a','b','z']);
  net.sessions.get('a').submit([{action:'translate',ids:['box'],dx:.1,dy:.2}]);
  net.sessions.get('b').submit([{action:'translate',ids:['box'],dx:.3,dy:-.1}]);
  net.advance();net.advance();
  for(const session of net.sessions.values()){assert.equal(session.items.box.x,.4);assert.equal(session.items.box.y,.1);}
  const newcomer=net.add('c');net.configure();net.synchronize();assert.equal(newcomer.items.box.x,.4);
});

test('movement ACL rejection is atomic and a deleted target cannot be resurrected', () => {
  const items={box:shape,secret:{...shape,permission:'secret'}};
  assert.throws(()=>reduceHostOperations(items,[{action:'translate',ids:['box','secret'],dx:1,dy:1}],peer('a'),new Map()),/권한/);
  assert.equal(items.box.x,0);
  assert.throws(()=>reduceHostOperations(items,[{action:'translate',ids:['box','missing'],dx:1,dy:1}],peer('a'),new Map()),/이동할/);
  assert.throws(()=>reduceHostOperations(items,[{action:'translate',ids:['box','box'],dx:1,dy:1}],peer('a'),new Map()),/벡터/);
  assert.throws(()=>reduceHostOperations(items,[{action:'translate',ids:['box'],dx:Infinity,dy:1}],peer('a'),new Map()),/벡터/);
});

test('movement commit filters inaccessible IDs and keeps full-record compatibility with older clients', () => {
  const net=network(),host=net.sessions.get('z'),follower=net.sessions.get('a');
  host.seed({secret:{...shape,permission:'secret'}});host.member('z').is_admin=true;
  host.submit([{action:'translate',ids:['box','secret'],dx:.1,dy:.2}]);net.advance();
  const commit=net.sent.filter(e=>e.message.type==='host_commit').at(-1).message;
  assert.deepEqual(commit.translations[0].ids,['box']);assert.equal(follower.items.secret,undefined);assert.equal(follower.items.box.x,.1);
  host.translationPeers.delete('a');host.submit([{action:'translate',ids:['box'],dx:.2,dy:0}]);host.flushMoves();net.deliver();
  const legacy=net.sent.filter(e=>e.message.type==='host_commit').at(-1).message;
  assert.ok(legacy.records.box);assert.equal(legacy.translations,undefined);assert.equal(follower.items.box.x,host.items.box.x);
});

test('relative optimistic movement is not replayed when its commit arrives before the ACK', () => {
  const net=network(),author=net.sessions.get('a'),host=net.sessions.get('z');
  author.submit([{action:'translate',ids:['box'],dx:.1,dy:0}]);net.advance();
  const pending=[...author.pending.keys()][0];host.accept(host.inbox.shift());
  const ack=net.queue.splice(0).find(entry=>entry.message.type==='host_ack');
  const approved=host.broadcasts.at(-1);
  author.receive('z',host.frame('host_commit',{sequence:approved.sequence,origin:'a',requestId:pending,counter:approved.counter,translations:approved.translations,version:approved.version}));
  assert.equal(author.items.box.x,.1);assert.equal(author.pending.size,1,'confirmation remains required');
  assert.equal(author.pendingOperations.length,0,'the relative offset has already been applied');
  author.receive('z',ack.message);assert.equal(author.pending.size,0);
});

test('accepted relative movement survives host replacement without replay after a missing ACK', () => {
  const net=network(['a','b','z']),author=net.sessions.get('a');
  author.submit([{action:'translate',ids:['box'],dx:.3,dy:.2}]);net.advance();
  net.sessions.get('z').tick();net.advance();
  assert.equal(author.items.box.x,.3);
  // A new request is accepted but its confirmation is lost before failover.
  author.submit([{action:'translate',ids:['box'],dx:.1,dy:0}]);net.advance(110);
  const host=net.sessions.get('z');host.accept(host.inbox.shift());
  net.queue.splice(0,net.queue.length,...net.queue.filter(e=>e.message.type!=='host_ack'));
  net.advance();assert.equal(author.pending.size,1);assert.equal(author.items.box.x,.4);
  net.online.delete('z');net.configure();net.synchronize();
  for(let i=0;i<4;i++)net.advance();
  assert.equal(author.items.box.x,.4);assert.equal(net.sessions.get('b').items.box.x,.4);
  assert.equal(author.pending.size,0);
});

test('large snapshot credit waits for receiver ACKs, retries blocked ACKs and reuses its partition plan',()=>{
 const net=network(),host=net.sessions.get('z'),follower=net.sessions.get('a');
 let scans=0;const records=new Proxy(Object.fromEntries(Array.from({length:20},(_,i)=>['large'+i,{item:{...shape,label:'x'.repeat(100000)},version:{clock:999,actor:'z'},permission:'default'}])),{ownKeys(target){scans++;return Reflect.ownKeys(target)}});
 let block=true;const send=follower.send;follower.send=(peer,frame)=>frame.type==='host_part_ack'&&block?false:send(peer,frame);
 assert.equal(host.sendRecords('a','host_snapshot',records,{sequence:0}),false);
 assert.equal(net.queue.filter(e=>e.message.type==='host_state_part').length,4);
 net.deliver();assert.equal(follower.items.large0,undefined,'partial snapshots never publish');assert.equal(follower.ackQueue.size,4);
 net.advance();assert.equal(host.outgoingStates.get('a:host_snapshot:0'),4,'slow receiver holds the window');
 block=false;for(let i=0;i<12;i++)net.advance();
 assert.equal(follower.items.large19.label.length,100000);assert.equal(follower.ackQueue.size,0);
 assert.equal(scans,1);assert.equal(host.recordTransfers.size,0);assert.equal(host.transferFields.size,0);
 const parts=net.sent.filter(e=>e.message.type==='host_state_part');assert.equal(parts.length,10);
 assert.deepEqual(parts.map(e=>e.message.index),Array.from({length:10},(_,i)=>i));
});

test('ready heartbeats remain low rate and recover a missing final commit',()=>{
 const net=network(),host=net.sessions.get('z'),follower=net.sessions.get('a');net.sent.length=0;
 for(let i=0;i<60;i++)net.advance();
 assert.ok(net.sent.filter(e=>e.message.type==='host_ready').length<=1);
 follower.receive('z',host.frame('host_ready',{sequence:follower.sequence+1,translateV1:true}));
 assert.equal(follower.ready,false);assert.ok(net.queue.some(e=>e.message.type==='host_resync'));
 net.deliver();net.advance();assert.equal(follower.ready,true);
});

test('definite persistence overload retries the current record without replacing a newer edit',()=>{
 const net=network(['z']),host=net.sessions.get('z');host.submit([{id:'box',action:'patch',patch:{x:1}}]);net.advance(110);
 const old={id:'box',record:host.records.box,previous:shape};host.serverDirty.clear();host.restorePersistence([old]);assert.equal(host.serverDirty.get('box'),old);
 host.submit([{id:'box',action:'patch',patch:{x:2}}]);net.advance(110);host.serverDirty.clear();
 host.restorePersistence([old]);assert.equal(host.serverDirty.size,0,'stale rejected saves never overwrite newer records');
});
