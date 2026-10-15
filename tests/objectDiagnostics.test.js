import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectDiagnostics, updateObjectDiagnostics } from '../src/canvas/diagnostics/objectDiagnostics.js';
import { itemSnapshot, changeItems } from '../src/canvas/itemSnapshots.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import { connectorGeometry } from '../src/components/connectorGeometry.js';
import { planManifest } from '../src/canvas/asCode/manifest.js';
import { generateAdderCanvas } from '../scripts/generate-adder-canvas.mjs';
const world={width:1600,height:1000};
test('full spatial rebuild clears old diagnostics even with identical item references',()=>{
 const items=itemSnapshot({a:{kind:'shape',shapeType:'rectangle',x:.1,y:.1,width:.1,height:.1}});
 const index={entries:new Map(),stats:{boundsCalculated:0},changedIds:null},cache=createObjectDiagnostics();
 assert.equal(updateObjectDiagnostics(cache,items,index).length,1);
 index.entries.set('a',{bounds:{minX:.1,minY:.1,maxX:.2,maxY:.2}});index.stats.boundsCalculated++;
 assert.deepEqual(updateObjectDiagnostics(cache,items,index),[]);
});
test('all 46 adder wires render and have no recovery warning, including after spatial rebuild and pin movement',()=>{
 let items=itemSnapshot(Object.fromEntries(planManifest(generateAdderCanvas(),{},'default').creates.map(e=>[e.id,e.item])));
 const index=new CanvasSpatialBTree(),cache=createObjectDiagnostics();
 index.update(items,world);assert.deepEqual(updateObjectDiagnostics(cache,items,index),[]);
 const wires=Object.values(items).filter(item=>item.kind==='connector');assert.equal(wires.length,46);
 for(const wire of wires){const g=connectorGeometry(wire,items,1600,1000);assert.ok(g);assert.ok(g.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
 items=changeItems(items,{'rca-fa-7':{...items['rca-fa-7'],rotation:90,x:.8}});
 index.update(items,world);assert.deepEqual(updateObjectDiagnostics(cache,items,index),[]);
 index.update(items,world,1);assert.equal(index.changedIds,null);assert.deepEqual(updateObjectDiagnostics(cache,items,index),[]);
});
test('invalid endpoints remain visible as problems and are cleared when the target arrives',()=>{
 const a={kind:'shape',shapeType:'logic-and',x:.1,y:.2,width:.1,height:.1},wire={kind:'connector',from:'a',to:'b',fromPort:'out',toPort:'a',startHead:'none',endHead:'none'};
 let items=itemSnapshot({a,w:wire});const index=new CanvasSpatialBTree(),cache=createObjectDiagnostics();
 index.update(items,world);assert.equal(updateObjectDiagnostics(cache,items,index).find(p=>p.id==='w').reason,'연결 대상이 없거나 잘못된 화살표');
 items=changeItems(items,{b:{...a,x:.4}});index.update(items,world);assert.deepEqual(updateObjectDiagnostics(cache,items,index),[]);
});
test('pin routes use direct endpoint lookup without treating the enclosing board as an obstacle',()=>{
 const base={a:{kind:'shape',shapeType:'logic-and',x:.1,y:.1,width:.1,height:.1},b:{kind:'shape',shapeType:'logic-or',x:.3,y:.1,width:.1,height:.1}};
 const view=Object.assign(Object.create(base),{board:{kind:'shape',shapeType:'rectangle',x:0,y:0,width:1,height:1}});
 assert.ok(connectorGeometry({kind:'connector',from:'a',to:'b',fromPort:'out',toPort:'a',startHead:'none',endHead:'none'},view,1600,1000));
});
