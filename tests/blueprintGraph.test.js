import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from '../src/canvas/runtime/blueprintGraph.js';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';

test('only connected code and downstream result objects participate', () => {
  const items = {
    run: { runtimeRole: 'executor' }, code: { kind: 'text', renderMode: 'code' },
    other: { kind: 'code' }, out1: { runtimeRole: 'output' }, out2: { runtimeRole: 'output' },
    a: { kind: 'connector', from: 'run', to: 'code' }, b: { kind: 'connector', from: 'code', to: 'out1' },
    c: { kind: 'connector', from: 'code', to: 'out2' }, d: { kind: 'connector', from: 'code', to: 'out1' },
    reverse: { kind: 'connector', from: 'other', to: 'run' },
  };
  assert.deepEqual(resolveBlueprint(items, 'run'), [{ codeId: 'code', outputIds: ['out1', 'out2'] }]);
  assert.throws(() => resolveBlueprint(items, 'out1'));
});

test('blueprint roles survive export and import and reject invalid roles', () => {
  const item = { kind: 'shape', shapeType: 'rectangle', runtimeRole: 'executor', x: .2, y: .3, width: .2, height: .1, permission: 'default' };
  const manifest = exportManifest({ run: item });
  assert.equal(planManifest(manifest, {}, 'default').creates[0].item.runtimeRole, 'executor');
  manifest.items.run.runtimeRole = 'unexpected';
  assert.throws(() => planManifest(manifest, {}, 'default'), /runtimeRole/);
});
