import test from 'node:test';
import assert from 'node:assert/strict';
import {researchSymbolCatalog,researchSymbolGeometry} from '../src/canvas/researchSymbols.js';
import {shapeCatalog,shapeCreationSize} from '../src/canvas/shapeCatalog.js';
import {shapeOutlinePaths,shapeFillPaths} from '../src/canvas/shapeGeometry.js';
import {researchTemplates,researchTemplateManifest,findResearchTemplatePosition} from '../src/canvas/researchTemplates.js';
import {planManifest,exportManifest} from '../src/canvas/asCode/manifest.js';
import {connectorGeometry} from '../src/components/connectorGeometry.js';
import {drawVectorItems} from '../src/canvas/drawVectorItems.js';

test('all research symbols have finite shared geometry, accurate bounds and closed fill regions',()=>{
 assert.equal(new Set(shapeCatalog.map(s=>s.id)).size,shapeCatalog.length);
 for(const s of researchSymbolCatalog)for(const [w,h] of [[240,120],[3,7],[800,600]]){
  const g=researchSymbolGeometry(s.id,w,h);assert.ok(g.paths.length,s.id);
  assert.deepEqual(g.paths,shapeOutlinePaths(s.id,w,h));assert.deepEqual(g.fills,shapeFillPaths(s.id,w,h));
  const points=g.paths.flat();assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-1e-8&&p.y>=-1e-8&&p.x<=w+1e-8&&p.y<=h+1e-8),s.id);
  for(const path of g.fills){assert.ok(path.length>=4,s.id);assert.deepEqual(path[0],path.at(-1),s.id);}
  const size=shapeCreationSize(s.id,{width:1600,height:1000});assert.ok(Math.abs(size.width*1600/(size.height*1000)-s.aspect)<1e-8);
 }
 assert.equal(researchSymbolGeometry('unknown',10,10),null);
});

test('electrical and mathematical line symbols never receive accidental polygon fill',()=>{
 for(const id of ['eng-resistor','eng-capacitor','eng-inductor','eng-ground','eng-battery','eng-spring','eng-damper','math-axes','math-number-line','math-vector','math-angle','math-matrix','math-venn','science-wave'])assert.equal(shapeFillPaths(id,200,100).length,0,id);
});

test('every editable diagram has valid references, independent node groups and routable connectors',()=>{
 for(const t of researchTemplates){
  const m=researchTemplateManifest(t.id,{prefix:'test-'+t.id,x:-200,y:130,permission:'default'});
  const plan=planManifest(m,{},'default');assert.ok(plan.creates.length>=6,t.id);
  const normalized=Object.fromEntries(plan.creates.map(({id,item})=>[id,item]));
  for(const item of Object.values(normalized))if(item.kind==='connector'){
   assert.ok(normalized[item.from]&&normalized[item.to],t.id);
   assert.ok(connectorGeometry(item,normalized,1600,1000),`${t.id}: ${item.from} -> ${item.to}`);
  }
  const imported=planManifest(exportManifest(normalized),{},'default');assert.equal(imported.creates.length,plan.creates.length,t.id);
  const b=researchTemplateManifest(t.id,{prefix:'second-'+t.id});assert.ok(Object.keys(b.items).every(id=>!m.items[id]));
 }
 assert.throws(()=>researchTemplateManifest('unknown',{prefix:'test'}));
});

test('GPU path accepts every research symbol in both visual styles',()=>{
 const g={};for(const key of ['clear','moveTo','lineTo','poly','circle','fill','stroke'])g[key]=()=>g;
 for(const style of ['standard','sketch']){
  const items=Object.fromEntries(researchSymbolCatalog.map((s,i)=>['symbol-'+i,{kind:'shape',shapeType:s.id,x:i*.2,y:0,width:.14,height:.14,fill:'#edf3f8',color:'#123456',visualStyle:style}]));
  assert.doesNotThrow(()=>drawVectorItems(g,items,1600,1000));
 }
});


test('template insertion searches nearby empty regions without scanning the whole canvas',()=>{
 const preset={width:1000,height:500},center={x:300,y:400};let calls=0;
 const first=findResearchTemplatePosition(preset,center,()=>false);assert.deepEqual(first,{x:-200,y:150});
 const second=findResearchTemplatePosition(preset,center,r=>{calls++;return r.x<900&&r.x+r.width>-300&&r.y<700&&r.y+r.height>100;});
 assert.ok(second.x!==first.x||second.y!==first.y);assert.ok(calls<=81);
 assert.throws(()=>findResearchTemplatePosition(preset,center,()=>true),/빈 공간/);
});


test('circuit connections start beyond the external terminal rather than an internal component line',()=>{
 for(const shapeType of researchSymbolCatalog.filter(s=>s.category==='engineering').map(s=>s.id)){
  const refs={a:{kind:'shape',shapeType,x:.1,y:.1,width:.1,height:.1},b:{kind:'shape',shapeType:'rectangle',x:.6,y:.1,width:.1,height:.1}};
  const g=connectorGeometry({kind:'connector',from:'a',to:'b',endHead:'triangle'},refs,1600,1000);
  assert.ok(g&&g.start.x>=320,shapeType);
 }
});
