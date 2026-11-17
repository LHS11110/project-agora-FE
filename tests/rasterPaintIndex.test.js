import test from 'node:test';
import assert from 'node:assert/strict';
import RasterPaintIndex from '../src/canvas/RasterPaintIndex.js';
import {overlaps} from '../src/canvas/renderDamage.js';
const record=(x,y)=>({paintedBounds:{minX:x,minY:y,maxX:x+5,maxY:y+5}});
test('sparse repaint retains painter order and includes overlapping shadows',()=>{
 const index=new RasterPaintIndex(),ordered=Array.from({length:1000},(_,i)=>record(i*10,0));
 ordered.forEach((r,i)=>index.update(r,i));
 const region={minX:205,minY:0,maxX:315,maxY:5};
 assert.deepEqual(index.query(region,ordered),ordered.filter(r=>overlaps(r.paintedBounds,region)));
 ordered[50].paintedBounds={minX:200,minY:0,maxX:210,maxY:5};index.update(ordered[50],50);
 assert.deepEqual(index.query(region,ordered),ordered.filter(r=>overlaps(r.paintedBounds,region)));
 index.remove(ordered[50]);ordered[50]=null;
 assert.ok(!index.query(region,ordered).includes(null));
});
test('hiding, moving, and depth changes invalidate indexed entries',()=>{
 const index=new RasterPaintIndex(),ordered=Array.from({length:100},(_,i)=>record(i*10,0));
 ordered.forEach((r,i)=>index.update(r,i));
 const region={minX:0,minY:0,maxX:25,maxY:5};
 ordered[1].hidden=true;index.update(ordered[1],1);
 index.update(ordered[0],3);index.update(ordered[2],0);
 assert.deepEqual(index.query(region,ordered),[ordered[2],ordered[0]]);
 ordered[2].paintedBounds={minX:1000,minY:0,maxX:1005,maxY:5};index.update(ordered[2],0);
 assert.deepEqual(index.query(region,ordered),[ordered[0]]);
});
test('full view reuses ordered records without sorting',()=>{
 const index=new RasterPaintIndex(),ordered=[record(0,0),record(10,0)];ordered.forEach((r,i)=>index.update(r,i));
 assert.equal(index.query({minX:-1,minY:-1,maxX:20,maxY:10},ordered),ordered);
});
