import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStrokeFrame } from '../src/canvas/strokeFrameChanges.js';
import { itemSnapshot, changedItemIds } from '../src/canvas/itemSnapshots.js';

const base = itemSnapshot({ a: { kind: 'stroke', points: [] }, b: { kind: 'shape' }, c: { kind: 'shape' } });

test('stroke frames keep the snapshot delta so the scene updates incrementally', () => {
  const next = applyStrokeFrame(base, [{ id: 'a', payload: { type: 'item_update', item: { kind: 'stroke', points: [[0, 0]] } } }]);
  assert.deepEqual(changedItemIds(base, next), ['a']);
  assert.equal(next.b, base.b);
});

test('the last stroke change in a frame wins', () => {
  const item = { kind: 'stroke', points: [[1, 1]] };
  const recreated = applyStrokeFrame(base, [{ id: 'a', payload: { type: 'item_delete' } }, { id: 'a', payload: { type: 'item_update', item } }]);
  assert.equal(recreated.a, item);
  const removed = applyStrokeFrame(base, [{ id: 'a', payload: { type: 'item_update', item } }, { id: 'a', payload: { type: 'item_delete' } }]);
  assert.equal('a' in removed, false);
  assert.deepEqual(Object.keys(removed), ['b', 'c']);
});
