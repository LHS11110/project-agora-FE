import test from 'node:test';
import assert from 'node:assert/strict';
import {assertObjectOperations} from '../src/canvas/locks/objectLock.js';
import {itemOperations,reduceHostOperations} from '../src/canvas/host/hostOperations.js';
import {exportManifest,planManifest} from '../src/canvas/asCode/manifest.js';
import {HostCanvasView} from '../src/canvas/host/HostCanvasView.js';
import {ServerCanvasSession} from '../src/canvas/sync/ServerCanvasSession.js';
import {captureObjects} from '../src/canvas/clipboard/objectClipboard.js';
const box={kind:'shape',shapeType:'rectangle',x:0,y:0,width:.2,height:.2,permission:'default',locked:true};
const state={box},peer={groups:['default'],is_admin:false};
test('locked objects reject translation, deletion, edits and combined unlock/edit',()=>{
 for(const op of [{action:'delete',id:'box'},{action:'translate',ids:['box'],dx:1,dy:0},{action:'patch',id:'box',patch:{x:1}},{action:'patch',id:'box',patch:{locked:false,x:1}},{action:'patch',id:'box',patch:{},unset:['locked']}]){
  assert.throws(()=>assertObjectOperations(state,[op]),/잠긴 객체/);
  assert.throws(()=>reduceHostOperations(state,[op],peer),/잠긴 객체/);
 }
 const ops=[{action:'patch',id:'box',patch:{locked:false}},{action:'translate',ids:['box'],dx:1,dy:0}];
 assert.doesNotThrow(()=>assertObjectOperations(state,ops));assert.equal(reduceHostOperations(state,ops,peer).items.box.x,1);
});
test('lock persists in manifests and typed patches; invalid lock metadata rejected',()=>{
 const manifest=exportManifest(state);assert.equal(manifest.items.box.locked,true);
 assert.equal(planManifest(manifest,{},'default').creates[0].item.locked,true);
 const wrong=structuredClone(manifest);wrong.items.box.locked='true';assert.throws(()=>planManifest(wrong,{},'default'),/locked/);
 const ops=itemOperations({box:{...box,locked:false}},state);assert.deepEqual(ops,[{id:'box',action:'patch',patch:{locked:true},unset:[]}]);
});
test('remote lock cancels stale optimistic changes without losing committed data',()=>{
 const view=new HostCanvasView();const result=view.rebase(state,['box'],[{action:'patch',id:'box',patch:{x:9}},{action:'translate',ids:['box'],dx:3,dy:2}]);
 assert.equal(result.box.x,0);assert.equal(result.box.locked,true);
});
test('unlock and subsequent edits are not merged into an invalid combined operation',()=>{
 const session=new ServerCanvasSession({available:()=>true,send:()=>true,publish:()=>{},status:()=>{},reject:()=>{}});
 session.seed(state,{sync_protocol:2,revision:0,accepted_count:0});
 session.submit([{id:'box',action:'patch',patch:{locked:false}}]);session.submit([{id:'box',action:'patch',patch:{x:1}}]);
 assert.equal(session.pendingOperations.length,2);
});
test('copy preserves lock but cut rejects locked originals and connectors',()=>{
 assert.ok(captureObjects(state,['box'],'fixture').text.includes('"locked":true'));
 assert.throws(()=>captureObjects(state,['box'],'fixture',true),/잠긴 객체/);
});
