import test from 'node:test';
import assert from 'node:assert/strict';
import { operationForWire, pointsAppend } from '../src/canvas/sync/itemDelta.js';
import { itemOperations } from '../src/canvas/host/hostOperations.js';
import { ServerCanvasSession } from '../src/canvas/sync/ServerCanvasSession.js';
import { itemSnapshot, changeItems, changedItemIds } from '../src/canvas/itemSnapshots.js';

// Mirrors the C++ broker (CanvasBrokerOperations.hpp, points_append).
function serverApply(items, operation) {
  const old = items[operation.id], item = { ...(old || {}), ...operation.patch };
  for (const field of operation.unset || []) delete item[field];
  if (operation.points_append) {
    const { from, last, points } = operation.points_append, base = old.points;
    const same = (a, b) => a.x === b.x && a.y === b.y && ('pressure' in a) === ('pressure' in b) && (!('pressure' in a) || a.pressure === b.pressure);
    if (!from || from > base.length || !same(base[from - 1], last)) throw new Error('CANVAS_TEXT_CONFLICT');
    item.points = [...base.slice(0, from), ...points];
  }
  return { ...items, [operation.id]: item };
}

test('only an unchanged prefix becomes an append; edits, erases and rebuilt points stay whole', () => {
  const base = [{ x: .1, y: .2, pressure: .5 }, { x: .2, y: .3, pressure: .5 }];
  assert.deepEqual(pointsAppend(base, [...base, { x: .3, y: .4, pressure: .6 }]), { from: 2, last: { x: .2, y: .3, pressure: .5 }, points: [{ x: .3, y: .4, pressure: .6 }] });
  assert.deepEqual(pointsAppend(base, base.map(p => ({ ...p }))).points, [], 'value-equal copies still append');
  assert.equal(pointsAppend(base, [base[0]]), null, 'shorter (erased) points are sent whole');
  assert.equal(pointsAppend(base, [base[0], { x: .2, y: .31, pressure: .5 }, { x: .4, y: .4 }]), null, 'changed prefix');
  assert.equal(pointsAppend(base, [{ x: .1, y: .2 }, base[1]]), null, 'pressure presence is part of identity');
  assert.equal(pointsAppend([], base), null);
  const op = { action: 'patch', id: 's', patch: { points: [...base, { x: 1, y: 1 }], complete: true }, pointsBase: base };
  assert.equal(operationForWire(op, true, false).patch.points.length, 3, 'servers without points_protocol get whole points');
  const wire = operationForWire(op, true, true);
  assert.equal(wire.patch.points, undefined);
  assert.equal(wire.patch.complete, true);
  assert.equal(wire.pointsBase, undefined, 'local base never goes on the wire');
  assert.equal(wire.points_append.from, 2);
  assert.equal(operationForWire({ ...op, action: 'create' }, true, true).patch.points.length, 3);
});

function drawSession(pointDeltas) {
  const sent = [];
  const session = new ServerCanvasSession({ available: () => true, send: message => { sent.push(message); return true; }, publish() {}, status() {}, reject(message) { throw new Error(message); }, receipt() {} });
  session.seed({}, { sync_protocol: 2, edit_protocol: 2, points_protocol: pointDeltas ? 1 : undefined, revision: 0, accepted_count: 0 });
  return { session, sent };
}

test('a stroke drawn with 30 Hz saves reaches the server identical, with merged queue bases kept', (t) => {
  for (const pointDeltas of [false, true]) {
    const { session, sent } = drawSession(pointDeltas);
    assert.equal(session.pointDeltas, pointDeltas);
    let working = itemSnapshot({}), server = {}, wireBytes = 0, revision = 0;
    const live = [];
    const flushServer = () => {
      // Deliver the in-flight request: apply on the "server" and commit back.
      const flight = session.flight;
      if (!flight) return;
      const message = sent.at(-1);
      for (const operation of message.operations) {
        const wire = operationForWire(operation, session.deltaEdits, session.pointDeltas);
        wireBytes += JSON.stringify(wire).length;
        server = serverApply(server, wire);
      }
      session.receiveServer({ type: 'canvas_commit', revision: ++revision, client_id: session.clientId, author_id: undefined, request_count: flight.request_count, items: Object.fromEntries(message.operations.map(op => [op.id, server[op.id]])) });
      session.flight = null;
    };
    for (let i = 0; i < 2000; i++) {
      live.push({ x: i / 4000, y: Math.sin(i / 50) / 4 + .5, pressure: .5 });
      if (i % 4 !== 3) continue;
      const next = changeItems(working, { s: { kind: 'stroke', brush: 'pen', complete: false, points: [...live], color: '#000', strokeWidth: 4 } });
      assert.ok(session.submit(itemOperations(working, next, new Map(), changedItemIds(working, next))));
      working = next;
      // The network is slower than input: several saves merge in the queue.
      if (i % 24 === 23) { session.nextAt = 0; session.sentAt = 0; session.tick(); session.tick(); flushServer(); }
    }
    for (let k = 0; k < 4 && (session.queue.length || session.flight); k++) { session.nextAt = 0; session.sentAt = 0; session.tick(); flushServer(); }
    assert.deepEqual(server.s.points, live, `server stroke is exact (pointDeltas=${pointDeltas})`);
    if (pointDeltas) drawSession.deltaBytes = wireBytes; else drawSession.fullBytes = wireBytes;
  }
  t.diagnostic(`wire bytes: whole ${drawSession.fullBytes}, append ${drawSession.deltaBytes}`);
  assert.ok(drawSession.deltaBytes * 10 < drawSession.fullBytes, `append wire ${drawSession.deltaBytes} vs whole ${drawSession.fullBytes}`);
});
