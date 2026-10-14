import test from 'node:test';
import assert from 'node:assert/strict';
import { objectShadow, shadowFilter } from '../src/canvas/objectShadow.js';
import { rasterDescriptor, acquireGpuSlot } from '../src/canvas/rasterObjectCache.js';
import { canvasObjectPropsEqual } from '../src/canvas/canvasRenderEquality.js';
import { planManifest, exportManifest } from '../src/canvas/asCode/manifest.js';

test('shadow settings keep defaults, clamp invalid values and round trip through canvas code', () => {
  assert.deepEqual(objectShadow(),{enabled:true,blur:6,opacity:.15,x:0,y:2});
  assert.equal(shadowFilter({shadowEnabled:false}),'none');
  assert.equal(objectShadow({shadowBlur:999,shadowOpacity:-1}).blur,24);
  const items={s:{kind:'shape',x:.1,y:.2,shadowEnabled:false,shadowBlur:10,shadowOpacity:.3,shadowOffsetX:-2,shadowOffsetY:4}};
  assert.deepEqual(planManifest(exportManifest(items),{},'default').creates[0].item,{permission:'default',...items.s});
  assert.throws(()=>planManifest({version:1,items:{s:{kind:'shape',x:10,y:10,shadowOpacity:2}}},{},'default'),/shadowOpacity/);
});

test('moving and rotating vectors reuse raster geometry while shape or shadow changes invalidate it', () => {
  const world={width:1600,height:1000};
  const shape={kind:'shape',x:.2,y:.3,width:.1,height:.1,visualStyle:'sketch'};
  const before=rasterDescriptor('s',shape,world,{});
  assert.equal(rasterDescriptor('s',{...shape,x:.6,y:.8,rotation:30},world,{}).key,before.key);
  assert.notEqual(rasterDescriptor('s',{...shape,width:.2},world,{}).key,before.key);
  assert.notEqual(rasterDescriptor('s',{...shape,shadowEnabled:false},world,{}).key,before.key);
  const stroke={kind:'stroke',points:[{x:.1,y:.2,pressure:.4},{x:.3,y:.4,pressure:.6}]};
  const shifted={...stroke,points:stroke.points.map(p=>({...p,x:p.x+.2,y:p.y+.1}))};
  assert.equal(rasterDescriptor('ink',stroke,world,{}).key,rasterDescriptor('ink',shifted,world,{}).key);
});

test('GPU context budget is bounded and releases are idempotent', () => {
  const slots=Array.from({length:4},()=>acquireGpuSlot());
  assert.ok(slots.every(Boolean)); assert.equal(acquireGpuSlot(),null);
  slots[0]();slots[0]();const replacement=acquireGpuSlot();assert.ok(replacement);assert.equal(acquireGpuSlot(),null);
  replacement();slots.slice(1).forEach(release=>release());
});

test('memoized objects ignore CRDT envelopes but retain content, selection, geometry and action changes', () => {
  const action=()=>{},props={item:{kind:'text',text:'Hello',automerge_snapshot:'a'},selected:false,bounds:{minX:0,maxX:1},onPointerDown:action};
  assert.ok(canvasObjectPropsEqual(props,{...props,item:{...props.item,automerge_snapshot:'b'}}));
  assert.ok(!canvasObjectPropsEqual(props,{...props,item:{...props.item,text:'Updated'}}));
  assert.ok(!canvasObjectPropsEqual(props,{...props,selected:true}));
  assert.ok(!canvasObjectPropsEqual(props,{...props,onPointerDown:()=>{}}));
});
