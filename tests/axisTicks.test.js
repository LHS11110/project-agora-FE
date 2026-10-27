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
 assert.equal(axisTickLayout({x:0,y:2000,scale:1},view).x.length,0);
 assert.equal(axisTickLayout({x:2000,y:0,scale:1},view).y.length,0);
 assert.equal(axisTickLayout({x:0,y:0,scale:0},view).step,null);
});
test('coordinate labels preserve fractional units without floating point noise',()=>{
 assert.equal(formatAxisValue(.1+.2),'0.3');assert.equal(formatAxisValue(-0),'0');
 assert.equal(formatAxisValue(.00002),'0.00002');assert.equal(formatAxisValue(Infinity),'');
});
