import test from 'node:test';
import assert from 'node:assert/strict';
import { axisTickLayout, niceAxisStep, formatAxisValue, MAX_AXIS_TICKS } from '../src/canvas/axisTicks.js';
const view={width:1440,height:900};
test('axis intervals use readable 1/2/5 steps and become finer on zoom-in',()=>{
 assert.deepEqual([.08,.11,.21,.51,1,1.1,2.1,5.1].map(niceAxisStep),[.1,.2,.5,1,1,2,5,10]);
 const zooms=[.001,.1,.5,1,2,10,100];let previous=Infinity;
 for(const scale of zooms){const layout=axisTickLayout({scale,x:720-800*scale,y:450-500*scale},view);assert.ok(layout.step<=previous);previous=layout.step;assert.ok(layout.step*scale>=79.999);assert.ok(layout.step*scale<=250);}
});
test('tick values align with the existing centered origin, with positive Y upward',()=>{
 const c={scale:1,x:-80,y:-50},layout=axisTickLayout(c,view);
 for(const t of layout.x)assert.ok(Math.abs(t.position-(layout.originX+t.value*c.scale))<1e-8);
 for(const t of layout.y)assert.ok(Math.abs(t.position-(layout.originY-t.value*c.scale))<1e-8);
 assert.ok(layout.x.some(t=>t.value<0)&&layout.x.some(t=>t.value>0));
 assert.ok(layout.y.some(t=>t.value<0)&&layout.y.some(t=>t.value>0));
 assert.ok([...layout.x,...layout.y].every(t=>t.value!==0));
});
test('panning, offscreen origins and numeric extremes have bounded finite work',()=>{
 for(const scale of [Number.MIN_VALUE,1e-200,.001,1,1e200,Number.MAX_VALUE]){
  const result=axisTickLayout({x:-1000,y:-200,scale},view);
  for(const ticks of [result.x,result.y]){assert.ok(ticks.length<=MAX_AXIS_TICKS);assert.ok(ticks.every(t=>Number.isFinite(t.position)&&Number.isFinite(t.value)));}
 }
 assert.ok(axisTickLayout({x:0,y:2000,scale:1},view).x.length>0);
 assert.ok(axisTickLayout({x:2000,y:0,scale:1},view).y.length>0);
 assert.equal(axisTickLayout({x:0,y:0,scale:0},view).step,null);
});
test('coordinate labels preserve fractional units without floating point noise',()=>{
 assert.equal(formatAxisValue(.1+.2),'0.3');assert.equal(formatAxisValue(-0),'0');
 assert.equal(formatAxisValue(.00002),'0.00002');assert.equal(formatAxisValue(Infinity),'');
});

test('offscreen axes pin to each edge without changing coordinate values',()=>{
 for(const [x,y,edgeX,edgeY] of [[-3000,-3000,8,8],[3000,3000,1432,892]]){
  const c={x,y,scale:1},layout=axisTickLayout(c,view);assert.equal(layout.displayX,edgeX);assert.equal(layout.displayY,edgeY);
  assert.ok(layout.x.length&&layout.y.length);
  for(const t of layout.x)assert.ok(Math.abs(t.position-layout.originX-t.value)<1e-8);
  for(const t of layout.y)assert.ok(Math.abs(t.position-layout.originY+t.value)<1e-8);
 }
});

test('an overscanned strip with the visible step labels the same values as the settled view', () => {
  // Max zoom far from the origin: the wider strip alone would choose a coarser step (10 vs 5).
  const camera = { x: -11000, y: -7000, scale: 16 }, viewport = { width: 800, height: 600 }, overscan = 256;
  const settled = axisTickLayout(camera, viewport);
  const wide = { x: camera.x + overscan, y: camera.y, scale: camera.scale };
  const strip = axisTickLayout(wide, { width: viewport.width + overscan * 2, height: viewport.height }, undefined, settled.step);
  assert.equal(strip.step, settled.step);
  const stripValues = new Set(strip.x.map(row => row.value));
  for (const row of settled.x) {
    assert.ok(stripValues.has(row.value), `strip lacks ${row.label}`);
    const inStrip = strip.x.find(candidate => candidate.value === row.value);
    assert.ok(Math.abs(inStrip.position - overscan - row.position) < 1e-6, `${row.label} position`);
  }
});

test('the step does not flip with sub-pixel camera positions during zoom or pan', () => {
  // Raw edge coordinates like -54.99999375 used to look like long labels and coarsen the step.
  for (const scale of [0.05, 0.3, 1, 1.7, 4, 9.3, 16]) {
    const steps = new Set();
    for (let i = 0; i < 400; i++) steps.add(axisTickLayout({ x: -11000 + i * 0.00731, y: -7000 + i * 0.0137, scale }, { width: 800, height: 600 }).step);
    assert.equal(steps.size, 1, `scale ${scale}: ${[...steps]}`);
  }
});
