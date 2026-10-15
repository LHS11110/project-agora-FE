import test from 'node:test';
import assert from 'node:assert/strict';
import { observeGpuContextLoss } from '../src/canvas/gpuLayerLifecycle.js';

test('removed depth layers ignore queued GPU context loss events', () => {
  const canvas = new EventTarget();
  let disposed = false, lost = 0;
  const stop = observeGpuContextLoss(canvas, () => disposed, () => lost++);
  canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(lost, 1);
  disposed = true;
  canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(lost, 1);
  stop(); disposed = false;
  canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(lost, 1);
});

test('destroying one layer does not detach another layer recovery handler', () => {
  const first = new EventTarget(), second = new EventTarget();
  let recovered = 0;
  const stopFirst = observeGpuContextLoss(first, () => false, () => { throw Error('Destroyed renderer accessed'); });
  const stopSecond = observeGpuContextLoss(second, () => false, () => recovered++);
  stopFirst(); first.dispatchEvent(new Event('webglcontextlost'));
  second.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(recovered, 1);
  stopSecond();
});
