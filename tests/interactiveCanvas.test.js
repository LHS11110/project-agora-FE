import test from 'node:test';
import assert from 'node:assert/strict';
import * as Automerge from '@automerge/automerge';
import { itemSnapshot,changeItems,changedItemIds,itemCount } from '../src/canvas/itemSnapshots.js';
import { HostCanvasView } from '../src/canvas/host/HostCanvasView.js';
import { itemOperations,reduceHostOperations } from '../src/canvas/host/hostOperations.js';
import { encodeBase64 } from '../src/canvas/collaborativeSync.js';
import SceneViewModel from '../src/canvas/SceneViewModel.js';
import MinimapMarkers from '../src/canvas/MinimapMarkers.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import StableSpatialQuery from '../src/canvas/StableSpatialQuery.js';
const shape={kind:'shape',shapeType:'rectangle',x:0,y:0,width:.1,height:.1,permission:'default',shadowEnabled:false};
const peer={is_admin:true,groups:['default']},world={width:1600,height:1000};

test('item snapshots update one item without copying or enumerating the whole immutable dictionary',()=>{
 let scans=0;const source=new Proxy(Object.fromEntries(Array.from({length:100000},(_,i)=>['s'+i,shape])),{ownKeys(target){scans++;return Reflect.ownKeys(target)}});
 const before=itemSnapshot(source),after=changeItems(before,{s20:{...shape,x:1}});
 assert.equal(scans,1);assert.equal(before.s20.x,0);assert.equal(after.s20.x,1);
 assert.equal(after.s99999,before.s99999);assert.deepEqual(changedItemIds(before,after),['s20']);assert.equal(itemCount(after),100000);
 const edited=changeItems(after,{extra:shape},['s20']);assert.equal(edited.s20,undefined);assert.equal(itemCount(edited),100000);
 assert.equal(Object.hasOwn(edited,'extra'),true);assert.equal(Object.hasOwn(edited,'s20'),false);
 assert.deepEqual(JSON.parse(JSON.stringify(changeItems(itemSnapshot({a:shape}),{b:shape},['a']))),{b:shape});
});
test('known-ID operation diff and host validation never enumerate unrelated objects',()=>{
 const current=new Proxy({box:shape},{ownKeys(){throw Error('full scene scan')}});
 const next=Object.create(current);next.box={...shape,x:1};
 const operations=itemOperations(current,next,new Map(),['box']);
 const reduced=reduceHostOperations(current,operations,peer,new Map());
 assert.equal(reduced.items.box.x,1);assert.equal(current.box.x,0);
 assert.throws(()=>reduceHostOperations(current,[{id:'box',action:'patch',patch:{width:-1}}],peer,new Map()));
});
test('scoped host validation preserves connector graph deletion constraints and atomic rejection',()=>{
 const items={a:shape,b:{...shape,x:1},line:{kind:'connector',from:'a',to:'b',permission:'default'}};
 const deps=new Map([['a',new Set(['line'])],['b',new Set(['line'])]]);
 assert.throws(()=>reduceHostOperations(items,[{id:'a',action:'delete'}],peer,deps),/from\/to/);
 assert.ok(reduceHostOperations(items,[{id:'a',action:'delete'},{id:'line',action:'delete'}],peer,deps));
 const patched=reduceHostOperations(items,[{id:'b',action:'patch',patch:{x:2}}],peer,deps);
 assert.throws(()=>reduceHostOperations(patched.items,[{id:'a',action:'delete'}],peer),/from\/to/);
 assert.equal(items.b.x,1);
});
test('optimistic text rebase keeps unrelated parsed documents and does not resurrect deleted objects',()=>{
 const view=new HostCanvasView(),items={a:{kind:'text',text:'hello'},b:{kind:'text',text:'untouched'}};
 view.rebase(items,['a','b'],[]);const retained=view.docs.get('b'),before=view.items;
 const doc=Automerge.change(view.docs.get('a'),draft=>{draft.content+='!'}),operation={id:'a',action:'patch',patch:{},doc:encodeBase64(Automerge.save(doc))};
 view.rebase(items,[],[operation]);assert.equal(view.items.a.text,'hello!');assert.equal(before.a.text,'hello');
 assert.equal(view.docs.get('b'),retained);assert.equal(view.stats.documentsLoaded,2);
 view.rebase({b:items.b},['a'],[operation]);assert.equal(view.items.a,undefined);
});
test('typing and incomplete stroke frames retain static vectors and unchanged minimap markers',()=>{
 const text={kind:'text',text:'one',renderMode:'plain',x:.2,y:.2,width:.2,height:.1};
 let items=itemSnapshot({a:shape,t:text}),index=new CanvasSpatialBTree(items,world),query=new StableSpatialQuery();
 const bounds={minX:-1,minY:-1,maxX:2,maxY:2},entries=query.query(index,bounds),scene=new SceneViewModel(),markers=new MinimapMarkers();
 scene.update(entries,items,world,1,new Set(['t']),new Set(),index.stats.boundsCalculated,index);
 const vectors=scene.depthLayers[0].vectors,oldMarkers=markers.update(entries,items,1600,1000,index);
 items=changeItems(items,{t:{...text,text:'two'}});index.update(items,world);
 assert.equal(query.query(index,bounds),entries);
 scene.update(entries,items,world,1,new Set(['t']),new Set(),index.stats.boundsCalculated,index);
 assert.equal(scene.depthLayers[0].vectors,vectors);assert.equal(scene.depthLayers[0].domObjects[0][1].text,'two');
 assert.equal(markers.update(entries,items,1600,1000,index),oldMarkers);
 assert.equal(index.stats.boundsCalculated,2);
});

test('repeated optimistic rebases retain the writer actor and leave the approved base unchanged',()=>{
 const view=new HostCanvasView(),items={a:{kind:'text',text:'hello'}};view.rebase(items,['a'],[]);
 const actor=Automerge.getActorId(view.docs.get('a')),operations=[];
 for(let i=0;i<8;i++){
  const doc=Automerge.change(view.docs.get('a'),draft=>{draft.content+='!'});
  operations.push({id:'a',action:'patch',patch:{},doc:encodeBase64(Automerge.save(doc))});
  view.rebase(items,[],operations);
  assert.equal(Automerge.getActorId(view.docs.get('a')),actor);
  assert.equal(view.docs.get('a').content,'hello'+'!'.repeat(i+1));
  assert.equal(view.approvedDocs.get('a').content,'hello');
 }
});
