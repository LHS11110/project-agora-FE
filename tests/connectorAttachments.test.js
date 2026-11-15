import test from 'node:test';import assert from 'node:assert/strict';
import {connectorGeometry} from '../src/components/connectorGeometry.js';
const world={width:1600,height:1000};
const box=(x,y,width=.1,height=.1,extra={})=>({kind:'shape',shapeType:'rectangle',x,y,width,height,...extra});
function geometry(headSize,extra={}){const items={a:box(0,0),b:box(.4,0),...extra};const link={kind:'connector',from:'a',to:'b',headSize,strokeWidth:2};return connectorGeometry(link,items,world.width,world.height);}
test('large arrowheads do not pull attachment tips away from object boundaries',()=>{const small=geometry(8),large=geometry(128);assert(small&&large);assert.deepEqual(large.start,small.start);assert.deepEqual(large.end,small.end);assert(large.start.x-160<5);assert(640-large.end.x<5);});
test('detours keep a small endpoint gap while using separate obstacle clearance',()=>{const route=geometry(24,{wall:box(.2,-.06,.08,.22)});assert(route?.routed);for(const [point,x] of [[route.start,0],[route.end,640]]){const dx=Math.max(x-point.x,0,point.x-(x+160)),dy=Math.max(-point.y,0,point.y-100);assert(Math.hypot(dx,dy)<6,'Tip must remain near its actual object');}});
test('thick object outlines are included in the attachment gap',()=>{const items={a:box(0,0,.1,.1,{strokeWidth:30}),b:box(.4,0)};const route=connectorGeometry({kind:'connector',from:'a',to:'b',strokeWidth:2},items,1600,1000);assert(route.start.x>=178&&route.start.x<180);});
test('rotated endpoint attachment stays aligned with the rotated boundary',()=>{const a=box(0,0,.1,.1,{rotation:45}),b=box(.4,0);const route=connectorGeometry({kind:'connector',from:'a',to:'b',headSize:100,strokeWidth:2},{a,b},1600,1000);const dx=route.start.x-80,dy=route.start.y-50,c=Math.SQRT1_2;const local={x:dx*c+dy*c,y:-dx*c+dy*c};assert(Math.abs(Math.abs(local.y)-50)<5);});

import {codePreviewHeight} from '../src/canvas/codePreviewMetrics.js';
import {objectBounds} from '../src/components/CanvasSpatialBTree.js';
const code=(x,y,source,extra={})=>({kind:'code',language:'python',x,y,width:.24,code:source,...extra});
test('unmounted automatic-height code connects at its rendered lower edge, not the generic 200px box',()=>{
 const a=code(0,0,'print(1)'),b=code(0,.7,'print(2)');const link={kind:'connector',from:'a',to:'b',strokeWidth:2};
 const route=connectorGeometry(link,{a,b},1600,1000);assert(route);assert(Math.abs(route.start.y-codePreviewHeight(a)-3)<.01);assert(Math.abs(route.end.y-697)<.01);
 const bounds=objectBounds(a,{a,b},1600,1000);assert(Math.abs(route.start.y-bounds.maxY*1000-3)<.01);
});
test('long and large-font code uses the same obstacle and attachment box as rendering',()=>{
 for(const extra of [{},{fontSize:26},{height:.3},{rotation:30}]){
  const a=code(0,0,Array(12).fill('print(1)').join('\n'),extra),b=code(.5,.65,'print(2)');const route=connectorGeometry({kind:'connector',from:'a',to:'b',strokeWidth:2},{a,b},1600,1000);assert(route);
  const h=codePreviewHeight(a),cx=a.width*800,cy=h/2,angle=-(a.rotation||0)*Math.PI/180,dx=route.start.x-cx,dy=route.start.y-cy;
  const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
  const distance=Math.min(Math.abs(Math.abs(x)-a.width*800),Math.abs(Math.abs(y)-h/2));assert(distance<4);
 }
});
test('text objects displayed as code use code preview bounds and update with source length',()=>{
 const a={kind:'text',renderMode:'code',language:'python',x:0,y:0,width:.24,text:'print(1)'},b=code(0,.8,'print(2)');const link={kind:'connector',from:'a',to:'b'};
 const first=connectorGeometry(link,{a,b},1600,1000),updated={...a,text:Array(15).fill('print(1)').join('\n')};
 const second=connectorGeometry(link,{a:updated,b},1600,1000);assert(first&&second);assert(second.start.y>first.start.y+200);
});
test('short code obstacles do not force detours through their old invisible default box',()=>{
 const a=box(0,.16,.05,.04),b=box(.5,.16,.05,.04),wall=code(.2,0,'print(1)',{width:.1});
 const route=connectorGeometry({kind:'connector',from:'a',to:'b',headSize:8},{a,b,wall},1600,1000);assert(route);assert.equal(route.routed,false);
});
test('code connections agree with spatial bounds at alternative world dimensions',()=>{
 const a=code(0,0,'print(1)'),b=code(0,1,'print(2)');for(const height of [600,1000,1500]){
  const route=connectorGeometry({kind:'connector',from:'a',to:'b',strokeWidth:2},{a,b},1200,height);const bounds=objectBounds(a,{a,b},1200,height);assert(route);assert(Math.abs(route.start.y-bounds.maxY*height-3)<.01);
 }
});
test('diagonal code connections meet rounded visible corners rather than empty bounding-box corners',()=>{
 const a=code(0,0,'print(1)',{width:.125,height:.2}),b=code(.4,.64,'print(2)',{width:.125,height:.2});
 const link={kind:'connector',from:'a',to:'b',strokeWidth:2};const rounded=connectorGeometry(link,{a,b},1600,1000),sharp=connectorGeometry(link,{a:{...a,cornerStyle:'sharp'},b},1600,1000);
 assert(rounded&&sharp);const expected=176+24/Math.sqrt(2)+3/Math.sqrt(2);assert(Math.abs(rounded.start.x-expected)<.01);assert(Math.abs(rounded.start.y-expected)<.01);assert(rounded.start.x<sharp.start.x-6);
});
