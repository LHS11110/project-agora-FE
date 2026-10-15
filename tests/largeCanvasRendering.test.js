import { minimapBitmapProjection } from '../src/canvas/minimapBitmapProjection.js';
import { gridProjection } from '../src/canvas/gridProjection.js';
import { flatRectangleTint,tintRasterItem } from '../src/canvas/flatShapeTint.js';
import { rasterViewportRegion } from '../src/canvas/rasterViewportRegion.js';
import { probeHardwareWebGL } from '../src/canvas/gpuCapability.js';
import { cachedCameraProjection } from '../src/canvas/cachedCameraProjection.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import SharedRasterCache from '../src/canvas/SharedRasterCache.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import { hitTestVector, needsVectorDom } from '../src/canvas/vectorHitTest.js';
import { rasterDescriptor } from '../src/canvas/rasterObjectCache.js';
import { renderWindow } from '../src/canvas/renderWindow.js';
import { plainTextLayout, isRasterText } from '../src/canvas/plainTextRaster.js';
import { buildDepthLayers } from '../src/canvas/itemDepth.js';
import { isOverviewProxy } from '../src/canvas/sceneRepresentation.js';
import { measureConnectorObject, connectorMetricsRevision, connectorObjectSize, inheritConnectorObjectSize } from '../src/canvas/connectors/objectMetrics.js';
import StableSpatialQuery from '../src/canvas/StableSpatialQuery.js';
const world={width:1600,height:1000};

test('12000 objects use nearby hit candidates, respect depth and keep unselected vectors out of DOM',()=>{
  const items=Object.fromEntries(Array.from({length:12000},(_,i)=>['s'+i,{kind:'shape',x:i%120,y:Math.floor(i/120),width:.1,height:.1,shadowEnabled:false}]));
  items.front={...items.s0,depth:3};
  const index=new CanvasSpatialBTree(items,world);
  assert.equal(hitTestVector(index,{x:.05,y:.05},world).id,'front');
  assert.equal(hitTestVector(index,{x:.5,y:.5},world),null);
  assert.equal(index.stats.boundsCalculated,12001);
  assert.equal(needsVectorDom('s0',items.s0,new Set(),null,null),false);
  assert.equal(needsVectorDom('s0',items.s0,new Set(['s0']),null,null),true);
  assert.equal(needsVectorDom('text',{kind:'text'},new Set(),null,null),true);
});
test('hit testing ignores shadow fringe and inverse-rotates rectangular hit areas',()=>{
  const items={s:{kind:'shape',x:.2,y:.2,width:.2,height:.02,rotation:90,shadowBlur:24}};
  const index=new CanvasSpatialBTree(items,world);
  assert.equal(hitTestVector(index,{x:.3,y:.3},world)?.id,'s');
  assert.equal(hitTestVector(index,{x:.4,y:.3},world),null);
});
test('repeated standard shapes share appearance keys while sketch seeds remain distinct',()=>{
  const shape={kind:'shape',shapeType:'rectangle',width:.1,height:.1};
  assert.equal(rasterDescriptor('a',shape,world,{}).key,rasterDescriptor('b',{...shape,x:2,rotation:80},world,{}).key);
  assert.notEqual(rasterDescriptor('a',{...shape,visualStyle:'sketch'},world,{}).key,rasterDescriptor('b',{...shape,visualStyle:'sketch'},world,{}).key);
});
test('shared resources survive partial releases, reuse idle pixels and evict without destroying live textures',()=>{
  const disposed=[],cache=new SharedRasterCache(r=>disposed.push(r.key),100,2);
  let creates=0;const create=()=>{creates++;return{canvas:{width:10,height:10}}};
  const a=cache.acquire('a',create),same=cache.acquire('a',create);
  assert.equal(a,same);assert.equal(creates,1);cache.release(a);assert.deepEqual(disposed,[]);
  cache.release(same);assert.equal(cache.acquire('a',create),a);assert.equal(creates,1);
  const b=cache.acquire('b',create),c=cache.acquire('c',create);
  cache.release(b);cache.release(c);assert.deepEqual(disposed,['b']);assert.equal(a.refs,1);
  cache.release(a);assert.deepEqual(disposed,['b','c']);cache.destroy();assert.deepEqual(disposed,['b','c','a']);
});
test('overscan membership is stable for small pans and always contains the visible bounds',()=>{
  const bounds={minX:.1,minY:.1,maxX:.9,maxY:.8},first=renderWindow(bounds,world,1);
  const next=renderWindow({...bounds,minX:.101,maxX:.901},world,1);
  assert.equal(first.key,next.key);
  assert.ok(first.bounds.minX<bounds.minX && first.bounds.maxX>bounds.maxX);
  assert.notEqual(first.key,renderWindow({...bounds,minX:1,maxX:1.8},world,1).key);
});
test('plain text preserves newlines, wraps oversized words and switches back to DOM for editing',()=>{
  const item={kind:'text',text:'ABCD\nEF',width:30/1600,height:200/1000,fontSize:13};
  const context={measureText:text=>({width:text.length*3})};
  assert.deepEqual(plainTextLayout(context,item,world,'serif').lines,['A','B','C','D','E','F']);
  assert.equal(isRasterText(item),true);
  assert.equal(isRasterText({...item,renderMode:'markdown'}),false);
  const entries=[['t',item]];
  assert.equal(buildDepthLayers(entries)[0].vectors.t,item);
  assert.equal(buildDepthLayers(entries,new Set(['t']))[0].vectors.t,undefined);
  assert.equal(needsVectorDom('t',item,new Set(),null,null),false);
  assert.equal(needsVectorDom('t',item,new Set(), 't',null),true);
});
test('rich content uses lightweight previews only at unreadable sizes and always restores when selected',()=>{
  const item={kind:'code',code:'const answer = 42;',x:.1,y:.1,width:.2,height:.2};
  assert.equal(isOverviewProxy(item,world,1),false);
  assert.equal(isOverviewProxy(item,world,.05),true);
  assert.equal(needsVectorDom('c',item,new Set(),null,null,world,.05),false);
  assert.equal(needsVectorDom('c',item,new Set(['c']),null,null,world,.05),true);
  const proxy=buildDepthLayers([['c',item]],new Set(),world,.05)[0].vectors.c;
  assert.equal(proxy.kind,'text');assert.equal(proxy.text,item.code);assert.equal(item.code,'const answer = 42;');
});
test('known drag changes update the index without enumerating the 12000-object dictionary',()=>{
  const items=Object.fromEntries(Array.from({length:12000},(_,i)=>['s'+i,{kind:'shape',x:i,y:0,width:.1,height:.1}]));
  const index=new CanvasSpatialBTree(items,world),retained=index.entries.get('s11999');
  const moved=new Proxy({...items,s0:{...items.s0,x:12001}}, {ownKeys(){throw Error('Full scene scan during a known geometry update');}});
  index.update(moved,world,0,['s0']);index.update(moved,world);
  assert.equal(index.stats.boundsCalculated,12001);assert.equal(index.entries.get('s11999'),retained);
  assert.equal(index.query({minX:12001,minY:0,maxX:12001.1,maxY:.1})[0].id,'s0');
});
test('immutable item movement retains measurements without publishing global size invalidations',()=>{
  const savedFrame=globalThis.requestAnimationFrame,savedWindow=globalThis.window,frames=[];
  globalThis.requestAnimationFrame=callback=>{frames.push(callback);return 1};globalThis.window={dispatchEvent(){}};
  try{
    const element={offsetWidth:160,offsetHeight:100},item={kind:'shape',x:0,width:.1,height:.1},before=connectorMetricsRevision();
    measureConnectorObject(item,element);const moved={...item,x:1};measureConnectorObject(moved,element);
    assert.equal(connectorMetricsRevision(),before+1);assert.deepEqual(connectorObjectSize(moved),{width:160,height:100});
    element.offsetWidth=200;measureConnectorObject({...moved},element);assert.equal(connectorMetricsRevision(),before+2);
    frames.forEach(callback=>callback());
  }finally{globalThis.requestAnimationFrame=savedFrame;globalThis.window=savedWindow;}
});
test('moving auto-height text carries measured bounds while resizing does not',()=>{
  const savedFrame=globalThis.requestAnimationFrame,savedWindow=globalThis.window,frames=[];
  globalThis.requestAnimationFrame=callback=>{frames.push(callback);return 1};globalThis.window={dispatchEvent(){}};
  try{
    const item={kind:'text',text:'Long wrapped text',width:.2},element={offsetWidth:320,offsetHeight:200};
    measureConnectorObject(item,element);const moved={...item,x:1};inheritConnectorObjectSize(item,moved);
    assert.deepEqual(connectorObjectSize(moved),{width:320,height:200});
    const resized={...item,width:.3};inheritConnectorObjectSize(item,resized);assert.equal(connectorObjectSize(resized),undefined);
    frames.forEach(callback=>callback());
  }finally{globalThis.requestAnimationFrame=savedFrame;globalThis.window=savedWindow;}
});
test('crossing overscan cells retains scene identity when only R-tree traversal order changes',()=>{
  const a={id:'a'},b={id:'b'},query=new StableSpatialQuery();let entries=[a,b];
  const index={query:()=>entries},first=query.query(index,{});
  entries=[b,a];assert.equal(query.query(index,{}),first);
  entries=[{id:'b'},a];assert.notEqual(query.query(index,{}),first);
});
test('large selection outlines stay in the raster layer without mutating persisted objects',()=>{
  const item={kind:'shape',width:.1,height:.1},entries=[['s',item]],selected=new Set(['s']);
  const layers=buildDepthLayers(entries,new Set(),world,1,selected);
  assert.equal(layers[0].vectors.s.__selectionOutline,true);
  assert.equal(item.__selectionOutline,undefined);
  assert.notEqual(rasterDescriptor('s',item,world,{}).key,rasterDescriptor('s',layers[0].vectors.s,world,{}).key);
  assert.equal(buildDepthLayers(entries,selected,world,1,selected)[0].vectors.s.__selectionOutline,undefined);
});

test('cached camera projection keeps world points aligned for pan and anchored zoom and refuses exposed edges',()=>{
  const cached={x:20,y:40,scale:1},camera={x:-50,y:-80,scale:1.2},margin=256;
  const projection=cachedCameraProjection(cached,camera,1000,600,margin);
  assert.ok(projection);
  for(const point of [{x:0,y:0},{x:400,y:300}]){
    assert.ok(Math.abs((point.x*cached.scale+cached.x+margin)*projection.scale+projection.x-(point.x*camera.scale+camera.x))<1e-9);
    assert.ok(Math.abs((point.y*cached.scale+cached.y+margin)*projection.scale+projection.y-(point.y*camera.scale+camera.y))<1e-9);
  }
  assert.equal(cachedCameraProjection(cached,{...camera,x:4000},1000,600),null);
  assert.equal(cachedCameraProjection(cached,{...camera,scale:.1},1000,600),null);
  assert.equal(cachedCameraProjection(null,camera,1000,600),null);
});

test('GPU capability preflight avoids software initialization and releases its probe context',()=>{
  let releases=0;
  const canvas=adapter=>({getContext:()=>({getExtension:name=>name==='WEBGL_debug_renderer_info'?{UNMASKED_RENDERER_WEBGL:1}:name==='WEBGL_lose_context'?{loseContext:()=>releases++}:null,getParameter:()=>adapter})});
  assert.equal(probeHardwareWebGL(()=>canvas('ANGLE SwiftShader')),false);
  assert.equal(probeHardwareWebGL(()=>canvas('NVIDIA RTX')),true);
  assert.equal(releases,2);
  assert.equal(probeHardwareWebGL(()=>({getContext:()=>null})),false);
  assert.equal(probeHardwareWebGL(()=>{throw Error('disabled')}),false);
});

test('raster output retains painted bounds while cropping transparent and offscreen pixels',()=>{
  const b={minX:200,minY:300,maxX:1200,maxY:800},camera={x:-100,y:-100,scale:1};
  const region=rasterViewportRegion(b,camera,1600,1000);
  assert.ok(region.x<=100 && region.y<=200 && region.x+region.width>=1100 && region.y+region.height>=700);
  assert.ok(region.width*region.height<1600*1000);
  assert.deepEqual(rasterViewportRegion(b,camera,1600,1000),rasterViewportRegion(b,{...camera,x:-101},1600,1000));
  assert.equal(rasterViewportRegion(b,{...camera,x:3000},1600,1000),null);
  assert.equal(rasterViewportRegion(null,camera,1600,1000),null);
});

test('opaque rectangle fills share geometry without recoloring outlines or shadows',()=>{
  const item={kind:'shape',shapeType:'rectangle',width:.2,height:.1,fill:'#123456',strokeEnabled:false,shadowEnabled:false};
  const tint=flatRectangleTint(item);assert.equal(tint,0x123456);
  const a=rasterDescriptor('a',tintRasterItem(item,tint),world,{});
  const next={...item,fill:'#abcdef'};
  assert.equal(a.key,rasterDescriptor('b',tintRasterItem(next,flatRectangleTint(next)),world,{}).key);
  assert.equal(item.fill,'#123456');
  assert.equal(flatRectangleTint({...item,fill:'#000000'}),0);
  for(const patch of [{strokeEnabled:true},{shadowEnabled:true},{visualStyle:'sketch'},{__selectionOutline:true},{fill:'transparent'},{fill:'#12345680'},{shapeType:'arrow'},{width:undefined},{height:0}])assert.equal(flatRectangleTint({...item,...patch}),null);
});

test('composited dot tiles preserve the world origin and cover the viewport throughout zoom bands',()=>{
  for(const scale of [.0001,.1,.7,1,1.35,2,1000])for(const x of [-2000,-11,0,125]){
    const p=gridProjection({x,y:x/2,scale});
    assert.ok(p.spacing>=12-1e-8 && p.spacing<=24+1e-8);
    const factor=p.spacing/24,origin=12*factor+p.x-p.spacing*2;
    assert.ok(Math.abs((origin-x)/p.spacing-Math.round((origin-x)/p.spacing))<1e-8);
    assert.ok((1800*2+128)*factor+p.x-p.spacing*2>=1800);
  }
});

test('minimap bitmap zoom preserves world positions and identifies uncovered neighborhoods',()=>{
  const old={minX:-400,minY:-250,width:2400,height:1500},next={minX:-100,minY:0,width:1800,height:1125};
  const p=minimapBitmapProjection(old,next,180,120);
  assert.equal(p.covers,true);
  for(const point of [{x:100,y:220},{x:1200,y:900}]){
    const oldX=(point.x-old.minX)/old.width*180+32,oldY=(point.y-old.minY)/old.height*120+32;
    assert.ok(Math.abs(p.x+oldX*p.scaleX-(point.x-next.minX)/next.width*180)<1e-8);
    assert.ok(Math.abs(p.y+oldY*p.scaleY-(point.y-next.minY)/next.height*120)<1e-8);
  }
  assert.equal(minimapBitmapProjection(old,{...old,minX:10000},180,120).covers,false);
});
