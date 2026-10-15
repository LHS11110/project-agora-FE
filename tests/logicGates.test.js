import test from 'node:test';
import assert from 'node:assert/strict';
import { logicGateCatalog,logicGateGeometry,logicPorts,logicPortPosition } from '../src/canvas/logicGates.js';
import { shapeOutlinePaths,shapeFillPaths } from '../src/canvas/shapeGeometry.js';
import { connectorGeometry } from '../src/components/connectorGeometry.js';
import { planManifest,exportManifest } from '../src/canvas/asCode/manifest.js';
import { generateAdderCanvas,rippleAdder8 } from '../scripts/generate-adder-canvas.mjs';
import { drawVectorItems } from '../src/canvas/drawVectorItems.js';
const world={width:1600,height:1000};
test('all nine logic symbols share finite outlines, separate closed fills and correctly directed pins',()=>{
 assert.equal(logicGateCatalog.length,9);
 for(const {id} of logicGateCatalog){
  const g=logicGateGeometry(id,140,100);assert.deepEqual(shapeOutlinePaths(id,140,100),g.paths);assert.deepEqual(shapeFillPaths(id,140,100),g.fills);
  assert.ok(g.paths.flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-1e-8&&p.x<=140+1e-8&&p.y>=-1e-8&&p.y<=100+1e-8));
  assert.ok(g.fills.every(path=>Math.hypot(path[0].x-path.at(-1).x,path[0].y-path.at(-1).y)<1e-8));
  assert.ok(g.paths.length>g.fills.length,'open leads and XOR back arcs are not filled');
  assert.ok(logicPorts(id).some(p=>p.direction==='input'));assert.ok(logicPorts(id).some(p=>p.direction==='output'));
 }
});
test('logic wires attach exactly to selected pins after move/resize/rotation and retain normal connector behavior',()=>{
 let items={a:{kind:'shape',shapeType:'logic-xor',x:.1,y:.2,width:.1,height:.08},b:{kind:'shape',shapeType:'logic-and',x:.4,y:.3,width:.1,height:.08}};
 const wire={kind:'connector',from:'a',to:'b',fromPort:'out',toPort:'b',startHead:'none',endHead:'none',bend:0};
 for(const rotation of [0,90,215]){
  items={...items,a:{...items.a,x:.1+rotation/1000,width:.15,rotation}};
  const geometry=connectorGeometry(wire,items,1600,1000);
  for(const [actual,expected] of [[geometry.start,logicPortPosition(items.a,'out',world)],[geometry.end,logicPortPosition(items.b,'b',world)]])assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-8);
  assert.equal(geometry.heads.length,0);
 }
 const custom=connectorGeometry({...wire,bendPointCount:2,bendPoints:[{x:0,y:.3},{x:0,y:-.3}]},items,1600,1000);
 assert.equal(custom.controlHandles.length,2);assert.ok(custom.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 const raw={...items,w:wire};assert.equal(planManifest(exportManifest(raw),{},'default').creates.find(e=>e.id==='w').item.toPort,'b');
 for(const patch of [{fromPort:'a'},{toPort:'out'},{toPort:'missing'}])assert.throws(()=>planManifest(exportManifest({...items,w:{...wire,...patch}}),{},'default'));
});
test('sketch rendering never hatches open gate leads or XOR back arcs',()=>{
 const fills=[],strokes=[],g={clear(){},poly(p){this.path=p;return this;},moveTo(){},lineTo(){},fill(p){fills.push(p);return this;},stroke(p){strokes.push(p);return this;}};
 const item={kind:'shape',shapeType:'logic-xnor',x:0,y:0,width:.1,height:.08,fill:'#ff0000',strokeEnabled:false};
 drawVectorItems(g,{a:item},1600,1000);assert.equal(fills.length,2,'only the body and inversion bubble are filled');
 drawVectorItems(g,{a:{...item,visualStyle:'sketch'}},1600,1000);assert.ok(strokes.length>0);
});
test('rendered full-adder gate wiring matches its truth table and every 8-bit input combination',()=>{
 const manifest=generateAdderCanvas();const items=planManifest(manifest,{},'default').creates.map(e=>[e.id,e.item]);
 const graph=Object.fromEntries(items),wires=Object.values(graph).filter(i=>i.kind==='connector');
 const incoming=new Map();for(const wire of wires)incoming.set(wire.to+':'+(wire.toPort||''),wire);
 function read(id,port,inputs,memo=new Map()){
  if(Object.hasOwn(inputs,id))return inputs[id];const key=id+':'+(port||'');if(memo.has(key))return memo.get(key);
  const node=graph[id],input=name=>{const wire=incoming.get(id+':'+name);assert.ok(wire,'missing input '+id+':'+name);return read(wire.from,wire.fromPort,inputs,memo);};
  let value;
  if(node.shapeType==='logic-xor')value=input('a')^input('b');
  else if(node.shapeType==='logic-and')value=input('a')&input('b');
  else if(node.shapeType==='logic-or')value=input('a')|input('b');
  else {const wire=incoming.get(id+':');assert.ok(wire,'missing junction '+id);value=read(wire.from,wire.fromPort,inputs,memo);}
  memo.set(key,value);return value;
 }
 for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let cin=0;cin<2;cin++){
  const inputs={'fa-A':a,'fa-B':b,'fa-Cin':cin};assert.equal(read('fa-S',null,inputs),(a+b+cin)&1);assert.equal(read('fa-Cout',null,inputs),(a+b+cin)>>1);
 }
 for(let i=0;i<8;i++){
  assert.equal(graph['rca-fa-'+i].shapeType,'logic-full-adder');
  for(const name of ['a','b','cin'])assert.ok(incoming.has('rca-fa-'+i+':'+name));
  if(i){const carry=incoming.get('rca-fa-'+i+':cin');assert.equal(carry.from,'rca-fa-'+(i-1));assert.equal(carry.fromPort,'cout');}
  const sum=incoming.get('rca-S'+i+':');assert.equal(sum.from,'rca-fa-'+i);assert.equal(sum.fromPort,'sum');
 }
 for(let a=0;a<256;a++)for(let b=0;b<256;b++)for(let cin=0;cin<2;cin++){
  const actual=rippleAdder8(a,b,cin),expected=a+b+cin;assert.equal(actual.sum,expected&255);assert.equal(actual.cout,expected>>8);
 }
});
