import {test} from 'node:test';import assert from 'node:assert/strict';
import {viewportPreloadPadding,preloadImageSources,PreloadImageSelector} from '../src/canvas/viewportPreload.js';
import {renderWindow,containsViewport} from '../src/canvas/renderWindow.js';
const world={width:1600,height:1000};
const view=(width,height,scale=1)=>({minX:0,minY:0,maxX:width/scale/world.width,maxY:height/scale/world.height});
test('preparation ring follows viewport dimensions and remains in screen pixels through zoom',()=>{
 for(const viewport of [{width:360,height:800},{width:1920,height:1080},{width:3840,height:2160}])for(const scale of [.1,.75,1,3]){
  const visible=view(viewport.width,viewport.height,scale),window=renderWindow(visible,world,scale,viewport),p=viewportPreloadPadding(viewport);
  assert.ok((visible.minX-window.bounds.minX)*world.width*scale>=p.x-1e-6);
  assert.ok((window.bounds.maxY-visible.maxY)*world.height*scale>=p.y-1e-6);
  assert.ok(containsViewport(window.bounds,visible,world,scale,viewport));
 }
});
test('nearest visible image wins over offscreen entries, with duplicates and inline sources skipped',()=>{
 const entry=(src,x,kind='image')=>({item:kind==='pdf'?{kind,thumbnail:src}:{kind,src},bounds:{minX:x,minY:0,maxX:x+.01,maxY:.1}});
 const visible={minX:0,minY:0,maxX:1,maxY:1};
 assert.deepEqual(preloadImageSources([entry('far',3),entry('repeat',4),entry('near',1.1),entry('repeat',.5),entry('pdf',.25,'pdf'),entry('data:x',.5)],visible,3),['repeat','pdf','near']);
 const s=new PreloadImageSelector(visible,4);for(let i=0;i<10000;i++)s.add(entry('image'+i,10000-i));assert.equal(s.rows.length,4);assert.equal(s.bySource.size,4);
});

test('spatial lookup includes nearby offscreen objects but excludes distant canvas regions for each screen size',async()=>{
 const {default:Index}=await import('../src/components/CanvasSpatialBTree.js');
 const index=new Index({near:{kind:'shape',x:.3,y:.1,width:.02,height:.02},desktop:{kind:'shape',x:.7,y:.1,width:.02,height:.02},wide:{kind:'shape',x:3,y:.1,width:.02,height:.02},far:{kind:'shape',x:5,y:.1,width:.02,height:.02}},world);
 for(const [width,expected] of [[360,['near']],[1920,['desktop','near']],[3840,['desktop','near','wide']]]){
  const viewport={width,height:800},window=renderWindow(view(width,800),world,1,viewport);
  assert.deepEqual(index.query(window.bounds).map(e=>e.id).sort(),expected);
 }
});
