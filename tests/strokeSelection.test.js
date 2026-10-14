import test from 'node:test';
import assert from 'node:assert/strict';
import { strokeSelectionGeometry } from '../src/canvas/strokeSelection.js';

test('stroke selection follows world points with padding for thin lines and dots', () => {
  const geometry = strokeSelectionGeometry({ strokeWidth: 2, points: [{x:.1,y:.2},{x:.3,y:.4}] }, {width:1000,height:500});
  assert.deepEqual([geometry.x,geometry.y,geometry.width,geometry.height], [93,93,214,114]);
  assert.deepEqual(geometry.points, [{x:7,y:7},{x:207,y:107}]);
  const dot = strokeSelectionGeometry({ strokeWidth: 2, points: [{x:-.1,y:0}] }, {width:1000,height:500});
  assert.equal(dot.width,14); assert.equal(dot.height,14);
  assert.equal(strokeSelectionGeometry({points:[]},{width:1000,height:500}),null);
});
