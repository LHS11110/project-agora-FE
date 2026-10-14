import test from 'node:test';
import assert from 'node:assert/strict';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import { AtlasPageSlots } from '../src/canvas/textureAtlas.js';
import { mergeDamage, overlaps, paintBounds } from '../src/canvas/renderDamage.js';

const world={width:1600,height:1000};
const fixture=()=>Object.fromEntries(Array.from({length:1000},(_,i)=>['s'+i,{kind:'shape',x:i%50*.1,y:Math.floor(i/50)*.1,width:.025,height:.025,shadowEnabled:false}]));

test('RBush limits a thousand-object document to overlapping viewport entries',()=>{
  const items=fixture(),index=new CanvasSpatialBTree(items,world);
  const result=index.query({minX:0,minY:0,maxX:.25,maxY:.25});
  assert.equal(result.length,9);
  assert.equal(index.stats.boundsCalculated,1000);
  for(let i=0;i<100;i++)index.query({minX:2,minY:1,maxX:2.25,maxY:1.25});
  assert.equal(index.stats.boundsCalculated,1000,'panning must not recalculate offscreen bounds');
});

test('moving one object updates only its bounds and preserves the rest of the spatial index',()=>{
  const items=fixture(),index=new CanvasSpatialBTree(items,world),unchanged=index.entries.get('s999');
  const moved={...items,s0:{...items.s0,x:10,y:10}};
  index.update(moved,world);
  assert.equal(index.stats.boundsCalculated,1001);
  assert.equal(index.entries.get('s999'),unchanged);
  assert.ok(!index.query({minX:0,minY:0,maxX:.03,maxY:.03}).some(e=>e.id==='s0'));
  assert.equal(index.query({minX:10,minY:10,maxX:10.03,maxY:10.03})[0].id,'s0');
  const without={...moved};delete without.s0;index.update(without,world);
  assert.equal(index.query({minX:10,minY:10,maxX:10.03,maxY:10.03}).length,0);
});

test('shadow fringe stays visible at viewport edges and style changes do not rebuild geometry',()=>{
  const items={s:{kind:'shape',x:.5,y:.5,width:.1,height:.1,shadowBlur:20,shadowOffsetX:10,shadowOpacity:.4}};
  const index=new CanvasSpatialBTree(items,world),before=index.stats.boundsCalculated;
  assert.equal(index.query({minX:.63,minY:.5,maxX:.64,maxY:.6}).length,1);
  index.update({s:{...items.s,shadowEnabled:false}},world);
  assert.equal(index.stats.boundsCalculated,before);
  assert.equal(index.query({minX:.63,minY:.5,maxX:.64,maxY:.6}).length,0);
});

test('connectors follow moved endpoints and measured geometry invalidations',()=>{
  const items={a:{kind:'shape',x:.1,y:.1,width:.1,height:.1},b:{kind:'shape',x:.4,y:.1,width:.1,height:.1},c:{kind:'connector',from:'a',to:'b'}};
  const index=new CanvasSpatialBTree(items,world),before=index.entries.get('c').bounds.maxX;
  index.update({...items,b:{...items.b,x:.8}},world);
  assert.ok(index.entries.get('c').bounds.maxX>before);
  const count=index.stats.boundsCalculated;index.update(index.items,world,1);
  assert.ok(index.stats.boundsCalculated>count);
});

test('atlas packing shares pages, reuses released slots and never overlaps live frames',()=>{
  const page=new AtlasPageSlots(128),slots=[];
  for(let i=0;i<64;i++)slots.push(page.allocate(16,16));
  assert.ok(slots.every(Boolean));assert.equal(page.allocate(16,16),null);
  assert.equal(new Set(slots.map(s=>s.x+':'+s.y)).size,64);
  page.release(slots[10]);assert.deepEqual(page.allocate(12,12),slots[10]);
  assert.equal(page.allocate(129,1),null);
});

test('damage contains old/new rotated paint and overlapping neighbors only',()=>{
  const raster={left:-2,top:-2,width:24,height:14};
  const descriptor={x:100,y:100,centerX:10,centerY:5,rotation:90};
  const before=paintBounds(descriptor,raster),after=paintBounds({...descriptor,x:120},raster);
  const dirty=mergeDamage([before,after]);
  assert.ok(overlaps(before,dirty)&&overlaps(after,dirty));
  assert.ok(!overlaps({minX:0,minY:0,maxX:20,maxY:20},dirty));
  assert.equal(mergeDamage([]),null);
});
