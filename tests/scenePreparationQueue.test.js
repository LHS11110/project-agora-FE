import test from 'node:test';
import assert from 'node:assert/strict';
import ScenePreparationQueue from '../src/canvas/ScenePreparationQueue.js';

test('a 100k scene is enumerated once and preparation resumes without visiting its prefix again', () => {
  let enumerations = 0;
  const raw = Object.fromEntries(Array.from({ length: 100000 }, (_, i) => ['s' + i, { kind: 'shape' }]));
  const items = new Proxy(raw, { ownKeys(target) { enumerations++; return Reflect.ownKeys(target); } });
  const queue = new ScenePreparationQueue(); queue.setItems(items);
  let clock = 0, count = 0;
  while (queue.pending) {
    assert.equal(queue.setItems(items), false);
    const visited = queue.run((id, item, index) => {
      assert.equal(id, 's' + count); assert.equal(index, count++); clock += 1;
    }, 8, () => clock);
    assert.ok(visited <= 8);
  }
  assert.equal(count, 100000); assert.equal(enumerations, 1);
});
test('replacing a partially prepared scene discards stale work and preserves the new order', () => {
  const queue = new ScenePreparationQueue(), seen = [];
  queue.setItems({ a: 1, b: 2, c: 3 });
  queue.run(id => seen.push(id), 0, () => 0);
  assert.deepEqual(seen, ['a']);
  queue.setItems({ c: 30, a: 10, d: 40 });
  assert.equal(queue.ids.has('b'), false);
  queue.run((id, item, index) => seen.push([id, item, index]), Infinity);
  assert.deepEqual(seen.slice(1), [['c', 30, 0], ['a', 10, 1], ['d', 40, 2]]);
  assert.equal(queue.pending, false);
});
test('quality passes restart the cursor without enumerating the scene again', () => {
  const queue = new ScenePreparationQueue(); const items = { a: {}, b: {} };
  queue.setItems(items); queue.run(() => {}, Infinity); queue.restart();
  const seen = []; queue.run(id => seen.push(id), Infinity);
  assert.deepEqual(seen, ['a', 'b']); assert.equal(queue.enumerations, 1);
});
test('an expensive object still makes progress and a failed visit is not silently skipped', () => {
  const queue = new ScenePreparationQueue(); queue.setItems({ a: {}, b: {} });
  let clock = 0;
  assert.equal(queue.run(() => { clock += 20; }, 8, () => clock), 1);
  assert.equal(queue.cursor, 1);
  assert.throws(() => queue.run(() => { throw Error('raster failed'); }), /raster failed/);
  assert.equal(queue.cursor, 1);
  queue.run(() => {}, Infinity); assert.equal(queue.pending, false);
});

import { itemSnapshot,changeItems } from '../src/canvas/itemSnapshots.js';
test('single-vector edits prepare only the dirty object and retain the original draw slot',()=>{
 const queue=new ScenePreparationQueue(),before=itemSnapshot(Object.fromEntries(Array.from({length:10000},(_,i)=>['s'+i,{x:i}])));
 queue.setItems(before);queue.run(()=>{},Infinity);const enumerations=queue.enumerations;
 const after=changeItems(before,{s5000:{x:20}});queue.setItems(after);queue.invalidate(queue.changedIds);
 const visited=[];queue.run((id,item,index)=>visited.push([id,item.x,index]),Infinity);
 assert.deepEqual(visited,[['s5000',20,5000]]);assert.equal(queue.enumerations,enumerations);assert.equal(queue.pending,false);
});
test('dirty vector edits do not discard the remaining initial preparation work',()=>{
 const queue=new ScenePreparationQueue(),before=itemSnapshot({a:{x:0},b:{x:0},c:{x:0}});
 queue.setItems(before);queue.run(()=>{},0);queue.setItems(changeItems(before,{a:{x:1}}));queue.invalidate(queue.changedIds);
 const visited=[];queue.run(id=>visited.push(id),Infinity);assert.deepEqual(visited,['a','b','c']);
});
