import test from 'node:test';
import assert from 'node:assert/strict';
import { planBatchDeletion } from '../src/canvas/deleteObjects.js';
import { ServerCanvasSession } from '../src/canvas/sync/ServerCanvasSession.js';
import { HostCanvasView } from '../src/canvas/host/HostCanvasView.js';
import { CanvasUndoHistory } from '../src/canvas/sync/CanvasUndoHistory.js';
import { itemOperations, operationIds } from '../src/canvas/host/hostOperations.js';
import { changeItems } from '../src/canvas/itemSnapshots.js';

const shape = (extra = {}) => ({
  kind: 'shape',
  shapeType: 'rectangle',
  x: 0.1,
  y: 0.1,
  width: 0.1,
  height: 0.1,
  permission: 'default',
  ...extra,
});

const conn = (from, to, extra = {}) => ({
  kind: 'connector',
  from,
  to,
  permission: 'default',
  ...extra,
});

test('planBatchDeletion cascades connectors while isolating locked or read-only items', () => {
  const items = {
    a: shape(),
    b: shape({ locked: true }),
    c: shape({ permission: 'restricted' }),
    d: shape(),
    e: shape(),
    f: shape(),
    ca: conn('a', 'b'),
    cd: conn('d', 'e', { locked: true }),
    'chat-room': { type: 'chat_room', text: 'keep' },
  };
  const plan = planBatchDeletion(items, ['b', 'c', 'a', 'd', 'e', 'f', 'chat-room'], {
    canWriteItem: (item) => item?.permission !== 'restricted',
  });
  assert.deepEqual(new Set(plan.removed), new Set(['a', 'ca', 'f']));
  assert.deepEqual(plan.remaining, ['b', 'c', 'd', 'e']);
  assert.deepEqual(plan.changes, {});
});

test('planBatchDeletion handles frames, portfolio cursor, and simultaneous member deletion', () => {
  const items = {
    frame1: { kind: 'frame', x: 0, y: 0, width: 0.5, height: 0.5, permission: 'default' },
    m1: shape({ frameId: 'frame1' }),
    m2: shape({ frameId: 'frame1' }),
    cf: conn('frame1', 'm2'),
    frameLocked: { kind: 'frame', x: 0.6, y: 0, width: 0.3, height: 0.3, permission: 'default' },
    lockedMember: shape({ frameId: 'frameLocked', locked: true }),
    'portfolio-settings': {
      kind: 'portfolio',
      permission: 'default',
      portfolioCursor: { frameId: 'frame1', step: 0 },
    },
  };
  // Delete frame1 AND m2 together (in frame-first order), plus frameLocked
  const plan = planBatchDeletion(items, ['frame1', 'm2', 'frameLocked']);
  assert.deepEqual(new Set(plan.removed), new Set(['frame1', 'cf', 'm2']));
  assert.equal(plan.changes.m1?.frameId, undefined);
  assert.equal(plan.changes.m2, undefined);
  assert.equal(plan.changes['portfolio-settings']?.portfolioCursor, undefined);
  assert.deepEqual(plan.remaining, ['frameLocked']);
});

test('planBatchDeletion handles notebooks, cells, and project board/issue hierarchies', () => {
  const items = {
    nb1: { kind: 'shape', runtimeRole: 'notebook', notebookCellIds: ['cell1', 'cell2'], permission: 'default' },
    cell1: { kind: 'text', runtimeRole: 'notebook-cell', notebookId: 'nb1', text: 'a', permission: 'default' },
    cell2: { kind: 'text', runtimeRole: 'notebook-cell', notebookId: 'nb1', text: 'b', permission: 'default' },
    cCell1: conn('cell1', 'nb1'),
    board1: { kind: 'project', projectType: 'board', title: 'B', permission: 'default' },
    issue1: { kind: 'project', projectType: 'issue', projectBoard: 'board1', projectDependencies: [], permission: 'default' },
    survivingIssue: { kind: 'project', projectType: 'issue', projectBoard: 'otherBoard', projectDependencies: ['issue1'], permission: 'default' },
  };
  // Delete two cells when notebook stays; deleting board1 requires admin
  const nonAdminPlan = planBatchDeletion(items, ['cell1', 'cell2', 'board1'], { canAdmin: () => false });
  assert.deepEqual(new Set(nonAdminPlan.removed), new Set(['cell1', 'cCell1', 'cell2']));
  assert.deepEqual(nonAdminPlan.changes.nb1.notebookCellIds, []);
  assert.deepEqual(nonAdminPlan.remaining, ['board1']);

  const adminPlan = planBatchDeletion(items, ['board1'], { canAdmin: () => true });
  assert.deepEqual(new Set(adminPlan.removed), new Set(['board1', 'issue1']));
  assert.deepEqual(adminPlan.changes.survivingIssue.projectDependencies, []);
  assert.deepEqual(adminPlan.remaining, []);
});

test('bulk deletion of 5,000 objects + 2,500 connectors runs in O(N), batches <= 512 ops, and supports 1-step undo', () => {
  const initial = {};
  const ids = [];
  for (let i = 0; i < 5000; i++) {
    const id = `item-${i}`;
    ids.push(id);
    initial[id] = shape({ x: (i % 100) * 0.01, y: Math.floor(i / 100) * 0.01 });
  }
  for (let i = 0; i < 2500; i++) {
    initial[`conn-${i}`] = conn(`item-${i * 2}`, `item-${i * 2 + 1}`);
  }

  const sent = [];
  const view = new HostCanvasView({ lazyPlainDocuments: true });
  const history = new CanvasUndoHistory();
  let working = view.items;
  const session = new ServerCanvasSession({
    available: () => true,
    send: (msg) => {
      sent.push(structuredClone(msg));
      return true;
    },
    publish: (committed, touched) => {
      working = view.rebase(committed, touched, session.viewOperations);
    },
    status: () => {},
    reject: (msg) => { throw new Error(msg); },
  });
  session.seed(initial, { sync_protocol: 2, revision: 0, accepted_count: 0, sync_user_id: 1 });

  const startedAt = performance.now();
  const plan = planBatchDeletion(working, ids);
  assert.equal(plan.removed.length, 7500);
  assert.equal(plan.remaining.length, 0);

  const previous = working;
  const next = changeItems(previous, plan.changes, plan.removed);
  const ops = itemOperations(previous, next, view.docs, plan.removed);
  assert.equal(ops.length, 7500);
  assert.equal(session.submit(ops), true);
  session.redraw();
  history.record(previous, working, ops.flatMap(operationIds));
  const elapsedMs = performance.now() - startedAt;

  assert.ok(elapsedMs < 2000, `Expected bulk delete < 2000ms, got ${elapsedMs.toFixed(1)}ms`);
  assert.equal(Object.keys(working).length, 0);
  assert.equal(history.entries.length, 1);
  assert.equal(session.queue.length, 7500);

  // Flush in <=512 batches and commit each one
  let rev = 0;
  let now = 1000;
  const origNow = Date.now;
  Date.now = () => now;
  try {
    while (session.queue.length || session.flight) {
      session.tick();
      assert.ok(session.flight, 'Expected an in-flight batch');
      assert.ok(session.flight.operations.length <= 512);
      const flight = sent.at(-1);
      rev += 1;
      const commitItems = Object.fromEntries(flight.operations.map((op) => [op.id, null]));
      session.receiveServer({
        type: 'canvas_commit',
        client_id: flight.client_id,
        author_id: 1,
        request_count: flight.request_count,
        request_id: flight.request_id,
        revision: rev,
        items: commitItems,
      });
      now += 40;
    }
  } finally {
    Date.now = origNow;
  }

  assert.equal(sent.length, Math.ceil(7500 / 512));
  assert.equal(Object.keys(session.items).length, 0);
  assert.equal(session.queuedBytes, 0);

  // Verify 1-step Undo restores all 7,500 items cleanly
  const restored = history.restore(working);
  assert.equal(Object.keys(restored.items).length, 7500);
});

test('ServerCanvasSession supports bulk queues above 20,000 delete operations and clears queuedBytes on drain', () => {
  const initial = {};
  const ops = [];
  for (let i = 0; i < 22000; i++) {
    const id = `d-${i}`;
    initial[id] = shape();
    ops.push({ id, action: 'delete' });
  }
  const sent = [];
  const errors = [];
  const session = new ServerCanvasSession({
    available: () => true,
    send: (msg) => { sent.push(msg); return true; },
    publish: () => {},
    status: () => {},
    reject: (msg) => errors.push(msg),
  });
  session.seed(initial, { sync_protocol: 2, revision: 0, accepted_count: 0, sync_user_id: 2 });

  assert.equal(session.submit(ops), true);
  assert.deepEqual(errors, []);
  assert.equal(session.queue.length, 22000);

  let rev = 0;
  let now = 5000;
  const origNow = Date.now;
  Date.now = () => now;
  try {
    while (session.queue.length || session.flight) {
      session.tick();
      const flight = sent.at(-1);
      rev += 1;
      session.receiveServer({
        type: 'canvas_commit',
        client_id: flight.client_id,
        author_id: 2,
        request_count: flight.request_count,
        request_id: flight.request_id,
        revision: rev,
        items: Object.fromEntries(flight.operations.map((o) => [o.id, null])),
      });
      now += 40;
    }
  } finally {
    Date.now = origNow;
  }
  assert.equal(sent.length, Math.ceil(22000 / 512));
  assert.equal(session.queuedBytes, 0);
  assert.equal(Object.keys(session.items).length, 0);
});
