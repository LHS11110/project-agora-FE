import assert from 'node:assert/strict';
import test from 'node:test';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';

test('world pixel coordinates round-trip outside the initial frame', () => {
  const source = { version: 1, items: {
    distant: { kind: 'text', x: 24000, y: -12000, width: 8000, height: 3000, text: 'Far away' },
    drawing: { kind: 'stroke', points: [{ x: -4000, y: 15000 }, { x: 20000, y: -8000 }] },
  } };
  const plan = planManifest(source, {}, 'public');
  const items = Object.fromEntries(plan.creates.map(({ id, item }) => [id, item]));
  const exported = exportManifest(items);
  assert.equal(Object.hasOwn(exported, 'canvas'), false);
  for (const id of Object.keys(source.items)) {
    for (const [field, value] of Object.entries(source.items[id])) {
      assert.deepEqual(exported.items[id][field], value);
    }
  }
  assert.equal(planManifest(exported, items, 'public').updates.length, 0);
});

test('legacy dimensions do not constrain or rescale world coordinates', () => {
  const items = { note: { kind: 'note', x: -3200, y: 6000, width: 400, text: 'Note' } };
  const create = canvas => planManifest({ version: 1, canvas, items }, {}, 'public').creates[0].item;
  assert.deepEqual(create({ width: 1600, height: 1000 }), create({ width: 40000, height: 30000 }));
  assert.deepEqual(create({ width: 1600, height: 1000 }), create(undefined));
});

test('moving an existing ID beyond the frame preserves omitted fields', () => {
  const original = { kind: 'text', x: 0.5, y: 0.5, width: 0.25, text: 'Keep this text' };
  const plan = planManifest({ version: 1, items: { existing: { x: -8000, y: 25000 } } }, { existing: original }, 'public');
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.updates.length, 1);
  const item = exportManifest({ existing: plan.updates[0].item }).items.existing;
  assert.equal(item.x, -8000);
  assert.equal(item.y, 25000);
  assert.equal(item.width, 400);
  assert.equal(item.text, original.text);
});
