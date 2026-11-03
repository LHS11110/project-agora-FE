import test from 'node:test';
import assert from 'node:assert/strict';
import * as Automerge from '@automerge/automerge';
import {CanvasUndoHistory} from '../src/canvas/sync/CanvasUndoHistory.js';
import {makeCollaborativeItem} from '../src/canvas/collaborativeSync.js';
import {loadItemDoc} from '../src/canvas/host/hostOperations.js';
import {encodeDocument} from '../src/canvas/host/documentCache.js';
const box={kind:'shape',shapeType:'rectangle',x:0,y:0,width:.1,height:.1,permission:'default'};
test('history has no five-entry cap and restores creation, edits and deletion',()=>{
 const h=new CanvasUndoHistory();let current={};
 for(let i=0;i<12;i++){const next={...current,['b'+i]:box};h.record(current,next,['b'+i]);h.seal();current=next;}
 assert.equal(h.entries.length,12);
 for(let i=11;i>=0;i--){current=h.restore(current).items;h.pop();assert.equal(current['b'+i],undefined);}
 assert.equal(h.restore(current),null);
 const before={a:box},after={};h.record(before,after,['a']);assert.deepEqual(h.restore(after).items.a,box);
});
test('gesture combines multiple objects and drawing frames into one step',()=>{
 const h=new CanvasUndoHistory();h.begin();h.record({}, {a:box},['a'],0);h.record({a:box},{a:box,b:box},['b'],2000);h.record({a:box,b:box},{a:{...box,x:.8},b:box},['a'],4000);h.seal();
 assert.equal(h.entries.length,1);assert.equal(Object.keys(h.restore({a:{...box,x:.8},b:box}).items).length,0);
});
test('undo preserves unrelated remote edits and refuses conflicting remote edits',()=>{
 const h=new CanvasUndoHistory(),after={a:{...box,x:.2}};h.record({a:box},after,['a']);
 assert.equal(h.restore({a:{...after.a,fill:'#ff0000'},remote:box}).items.a.fill,'#ff0000');
 assert.equal(h.restore({a:{...after.a,fill:'#ff0000'},remote:box}).items.remote,box);
 assert.throws(()=>h.restore({a:{...after.a,x:.5}}),/다른 사용자/);
 assert.equal(h.entries.length,1);
});
test('text color changes are recorded by semantic marks and restored separately',()=>{
 const item=makeCollaborativeItem({kind:'text',text:'hello',permission:'default'}),doc=Automerge.change(Automerge.clone(loadItemDoc(item)),d=>Automerge.mark(d,['content'],{start:0,end:5,expand:'none'},'textColor','#ff0000'));
 const colored={...item,automerge_snapshot:encodeDocument(doc),automerge_changes:[]};
 const h=new CanvasUndoHistory();h.record({a:item},{a:colored},['a']);
 assert.equal(h.entries.length,1);const result=h.restore({a:colored});assert.deepEqual(Automerge.marks(result.documents.get('a'),['content']),[]);assert.equal('__undoColors' in result.items.a,false);
});
test('a field first touched after a remote edit retains that remote baseline',()=>{
 const h=new CanvasUndoHistory(),a={a:box},moved={a:{...box,x:.2}},remote={a:{...box,x:.2,fill:'#ff0000'}},local={a:{...remote.a,fill:'#0000ff'}};
 h.record(a,moved,['a'],0);h.record(remote,local,['a'],100);
 const result=h.restore(local).items.a;assert.equal(result.x,0);assert.equal(result.fill,'#ff0000');
});
