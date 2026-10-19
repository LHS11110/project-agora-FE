import test from 'node:test';
import assert from 'node:assert/strict';
import {arrowPathGeometry,normalizeArrowHead} from '../src/components/arrowheadGeometry.js';
import {arrowheadStrokeParts} from '../src/canvas/vectorStyle.js';
import {exportManifest,planManifest} from '../src/canvas/asCode/manifest.js';
const types=['erd-one','erd-zero-one','erd-one-many','erd-zero-many'];

test('all ERD cardinalities survive native canvas export and import',()=>{
 for(const startHead of types)for(const endHead of types){
  assert.equal(normalizeArrowHead(startHead),startHead);
  const items={a:{kind:'shape',shapeType:'rectangle',x:0,y:0},b:{kind:'shape',shapeType:'rectangle',x:500,y:200},r:{kind:'connector',from:'a',to:'b',startHead,endHead,headSize:24}};
  const result=planManifest(exportManifest(items),{},'default');
  const item=result.creates.find(o=>o.id==='r').item;
  assert.equal(item.startHead,startHead);assert.equal(item.endHead,endHead);
 }
});

test('ERD markers mirror at both ends and remain finite on short curved links',()=>{
 for(const type of types)for(const points of [[{x:0,y:0},{x:100,y:0}],[{x:0,y:0},{x:0,y:0},{x:2,y:1},{x:4,y:0}]]){
  const g=arrowPathGeometry(points,{startHead:type,endHead:type,headSize:128});
  assert.equal(g.heads.length,2);
  assert.ok(g.heads.flatMap(h=>h.points).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.ok(g.points[0].x>0);assert.ok(g.points.at(-1).x<points.at(-1).x);
  for(const h of g.heads)assert.ok(h.parts.every(p=>p.filled===false));
 }
});

test('optional ERD circles remain hollow and the central shaft never crosses them',()=>{
 for(const type of ['erd-zero-one','erd-zero-many']){
  const g=arrowPathGeometry([{x:0,y:0},{x:200,y:0}],{startHead:type,endHead:type,headSize:30});
  for(const h of g.heads){
   const circle=h.parts.find(p=>p.center);assert.ok(circle);assert.equal(circle.filled,false);
   for(const p of h.parts.filter(p=>!p.center&&p.points.length===2&&p.points.every(v=>v.y===0))){
    const lo=Math.min(...p.points.map(v=>v.x)),hi=Math.max(...p.points.map(v=>v.x));
    assert.ok(hi<=circle.center.x-circle.radius+1e-9||lo>=circle.center.x+circle.radius-1e-9);
   }
   for(const style of ['standard','sketch']){
    const parts=arrowheadStrokeParts(h,style,'erd-test');assert.equal(parts.length,h.parts.length);
    assert.ok(parts.every(p=>p.hatches.length===0&&p.strokes.length>0));
   }
  }
 }
});
