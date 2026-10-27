import test from 'node:test';
import assert from 'node:assert/strict';
import { readPenStyle } from '../src/canvas/usePenStyle.js';

test('new users get a writing pen while existing brush and opacity preferences are retained', () => {
  assert.deepEqual(readPenStyle(null), { brush: 'pen', opacity: 1 });
  assert.deepEqual(readPenStyle({ getItem: () => JSON.stringify({ brush: 'ink', opacity: .7 }) }), { brush: 'ink', opacity: .7 });
  assert.deepEqual(readPenStyle({ getItem: () => '{invalid' }), { brush: 'pen', opacity: 1 });
  assert.deepEqual(readPenStyle({ getItem: () => JSON.stringify({ brush: 'unknown', opacity: 1 }) }), { brush: 'pen', opacity: 1 });
  assert.deepEqual(readPenStyle({ getItem: () => { throw new Error('storage unavailable'); } }), { brush: 'pen', opacity: 1 });
});
