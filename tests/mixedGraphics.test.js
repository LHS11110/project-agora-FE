import test from 'node:test';import assert from 'node:assert/strict';
import SceneViewModel from '../src/canvas/SceneViewModel.js';
import {graphicsLodScale} from '../src/canvas/graphicsQuality.js';
import {isOverviewProxy,overviewProxy} from '../src/canvas/sceneRepresentation.js';
import {hasRenderedAnimation,defaultAnimation} from '../src/canvas/portfolio/portfolioModel.js';
import {itemSnapshot} from '../src/canvas/itemSnapshots.js';
const world={width:1600,height:1000};
test('quality changes rich-object detail; heightless code and runtime shapes participate',()=>{
 const image={kind:'image',width:.025,height:.035};assert.equal(isOverviewProxy(image,world,1,'low'),true);assert.equal(isOverviewProxy(image,world,1,'high'),false);
 assert.equal(isOverviewProxy({kind:'shape',runtimeRole:'output',width:.2,height:.2},world,.01),true);
 const code={kind:'code',width:.2,code:'print(1)',renderMode:'code'};assert.equal(isOverviewProxy(code,world,.01),true);
 assert.equal(overviewProxy(code,world,.001).kind,'shape');
 const e={id:'image',item:image,bounds:{minX:0,minY:0,maxX:.025,maxY:.035}},model=new SceneViewModel(),items={image};
 model.update([e],items,world,1,new Set(),new Set(),0,null,'low');assert.equal(model.depthLayers[0].domObjects.length,0);
 model.update(model.entries,items,world,1,new Set(),new Set(),0,null,'high');assert.equal(model.depthLayers[0].domObjects.length,1);
 assert.ok(graphicsLodScale(1,200000,'low')<graphicsLodScale(1,200000,'high'));
});
test('200,000 mixed objects use bounded rich DOM and selected objects regain full interaction',()=>{
 const entries=Array.from({length:200000},(_,i)=>{const kind=['shape','code','image','link','link'][i%5];const item={kind,shapeType:'rectangle',x:(i%500)*.02,y:Math.floor(i/500)*.02,width:.018,height:.016,code:'print(42)',renderMode:'code',src:'https://example.invalid/image.png',mediaType:i%5===3?'youtube':'video',url:'https://example.invalid/media.mp4',shadowEnabled:false};return {id:String(i),item,bounds:{minX:item.x,minY:item.y,maxX:item.x+item.width,maxY:item.y+item.height}};});
 const items=itemSnapshot(Object.fromEntries(entries.map(e=>[e.id,e.item]))),scene=new SceneViewModel(),scale=graphicsLodScale(.04,entries.length,'low'),start=performance.now();
 scene.update(entries,items,world,scale,new Set(['3']),new Set(['3']),0,null,'low');
 assert.equal(scene.depthLayers.reduce((n,l)=>n+l.domObjects.length,0),1);assert.equal(Object.values(scene.depthLayers[0].vectors).length,199999);
 const prepared=performance.now()-start,revision=scene.revision;
 const reuse=performance.now();for(let i=0;i<60;i++)scene.update(entries,items,world,scale,new Set(['3']),new Set(['3']),0,null,'low');
 assert.equal(scene.revision,revision);console.log(JSON.stringify({objects:entries.length,initialSceneMs:prepared,cachedSceneMeanMs:(performance.now()-reuse)/60,domObjects:1}));
});

test('dormant animation effects do not force individual DOM renderers',()=>{const item={animation:{...defaultAnimation(),effect:'pulse'}};assert.equal(hasRenderedAnimation(item),false);assert.equal(hasRenderedAnimation({...item,animationPlayback:{action:'play',startedAt:Date.now()}}),true);assert.equal(hasRenderedAnimation({...item,animationPlayback:{action:'stop',startedAt:Date.now()}}),false);});
test('zooming restores text detail instead of retaining the tiny-object silhouette',()=>{
 const item={kind:'code',renderMode:'code',code:'print(42)',width:.1,height:.1},entry={id:'code',item,bounds:{minX:0,minY:0,maxX:.1,maxY:.1}},items={code:item},scene=new SceneViewModel(),entries=[entry];
 scene.update(entries,items,world,.02,new Set(),new Set());assert.equal(scene.depthLayers[0].vectors.code.kind,'shape');
 scene.update(entries,items,world,.04,new Set(),new Set());assert.equal(scene.depthLayers[0].vectors.code.kind,'text');
});
