import test from 'node:test';
import assert from 'node:assert/strict';
import ConnectionIndex from '../src/canvas/clipboard/ConnectionIndex.js';
import {collectCopyObjects,captureObjects} from '../src/canvas/clipboard/objectClipboard.js';
import {itemSnapshot,changeItems} from '../src/canvas/itemSnapshots.js';
import {quickCopy,sameCopy,cacheCopy} from '../src/canvas/clipboard/copyJob.js';
const shape={kind:'shape',shapeType:'rectangle',x:.1,y:.1,width:.1,height:.1};
test('indexed copying never enumerates unrelated canvas objects and includes only the relevant edges',()=>{
 let scans=0;const items=new Proxy({a:shape,b:{...shape,x:.4},c:{...shape,x:.8},ab:{kind:'connector',from:'a',to:'b'},bc:{kind:'connector',from:'b',to:'c'}},{ownKeys:target=>{scans++;return Reflect.ownKeys(target);}});
 const index=new ConnectionIndex().update(items);scans=0;
 assert.deepEqual(Object.keys(collectCopyObjects(items,['a','b'],'c',false,index).originals).sort(),['a','ab','b']);
 assert.deepEqual(Object.keys(collectCopyObjects(items,['b'],'c',true,index).originals).sort(),['ab','b','bc']);
 assert.equal(scans,0);
 assert.equal(JSON.parse(captureObjects(items,['a'],'c',false,index).text).items.a.x,160);
 assert.equal(scans,0);
});
test('endpoint index tracks edits and deletion incrementally, including transitions to ordinary objects',()=>{
 let items=itemSnapshot({a:shape,b:shape,c:shape,wire:{kind:'connector',from:'a',to:'b'}}),index=new ConnectionIndex().update(items);
 const count=index.stats.visited;
 items=changeItems(items,{wire:{kind:'connector',from:'b',to:'c'}});index.update(items);
 assert.deepEqual([...index.related(['a'])],[]);assert.deepEqual([...index.related(['c'])],['wire']);
 assert.equal(index.stats.visited,count+1);assert.equal(index.stats.fullBuilds,1);
 items=changeItems(items,{wire:shape});index.update(items);assert.deepEqual([...index.related(['c'])],[]);
 items=changeItems(items,{wire:{kind:'connector',from:'a',to:'a'}});index.update(items);assert.equal(index.connections.get('a').size,1);
 items=changeItems(items,{},['wire']);index.update(items);assert.equal(index.connections.size,0);
});
test('copy limits, locked cuts and immutable result cache checks preserve behavior',()=>{
 const items={a:shape,b:shape,wire:{kind:'connector',from:'a',to:'b',locked:true}},index=new ConnectionIndex().update(items);
 assert.throws(()=>collectCopyObjects(items,['a'],'c',true,index),/잠긴 객체/);
 const snapshot=collectCopyObjects(items,['a'],'c',false,index);assert.ok(quickCopy(snapshot));
 assert.ok(sameCopy({...snapshot,text:'cached'},snapshot));const cached=cacheCopy({...snapshot,text:'cached'});assert.ok(cached.originals.a instanceof WeakRef);assert.ok(sameCopy(cached,snapshot));
 assert.equal(sameCopy(snapshot,{...snapshot,originals:{a:{...shape}}}),false);
 assert.equal(sameCopy(snapshot,{...snapshot,canvasId:'other'}),false);
 assert.equal(quickCopy({originals:{a:{kind:'stroke',points:new Array(5000)}}}),false);
 assert.equal(quickCopy({originals:Object.fromEntries(Array.from({length:33},(_,i)=>[i,shape]))}),false);
});
