import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '@automerge/automerge';
import {captureCollaborativeUndo,undoCollaborativeChanges} from '../src/canvas/sync/collaborativeUndo.js';
import {encodeDocument} from '../src/canvas/host/documentCache.js';
import {CanvasUndoHistory} from '../src/canvas/sync/CanvasUndoHistory.js';
const item=doc=>({kind:'text',text:doc.content,permission:'default',automerge_snapshot:encodeDocument(doc),automerge_changes:[]});
const edit=(doc,index,count,text)=>A.change(A.clone(doc),d=>A.splice(d,['content'],index,count,text));
const action=(before,after)=>captureCollaborativeUndo(item(before),item(after));
test('undo a from ba preserves the remote b, including concurrent insertion',()=>{
 const base=A.from({content:''}),local=edit(base,0,0,'a');
 const sequential=edit(local,0,0,'b');assert.equal(undoCollaborativeChanges(sequential,[action(base,local)]).content,'b');
 const remote=edit(base,0,0,'b'),merged=A.merge(A.clone(local),remote);
 assert.equal(undoCollaborativeChanges(merged,[action(base,local)]).content,'b');
});
test('remote characters inserted inside a local run and identical letters survive',()=>{
 const base=A.from({content:'a'}),local=edit(base,0,0,'aa'),remote=edit(local,1,0,'a');
 assert.equal(undoCollaborativeChanges(remote,[action(base,local)]).content,'aa');
 const empty=A.from({content:''}),abc=edit(empty,0,0,'abc'),mixed=edit(abc,1,0,'X');
 assert.equal(undoCollaborativeChanges(mixed,[action(empty,abc)]).content,'X');
});
test('local deletion and replacement undo preserve remote edits and deleted rich colors',()=>{
 let base=A.from({content:'abcd'});base=A.change(base,d=>A.mark(d,['content'],{start:1,end:3,expand:'none'},'textColor','#ff0000'));
 const local=edit(base,1,2,'XY'),remote=edit(local,0,0,'Z');
 const undone=undoCollaborativeChanges(remote,[action(base,local)]);
 assert.equal(undone.content,'Zabcd');assert.equal(A.marksAt(undone,['content'],2).textColor,'#ff0000');
});
test('remote insertion between deleted characters retains its relative position',()=>{
 const base=A.from({content:'abcd'}),local=edit(base,1,2,''),remote=edit(base,2,0,'X'),merged=A.merge(A.clone(local),remote);
 assert.equal(undoCollaborativeChanges(merged,[action(base,local)]).content,'abXcd');
});
test('grouped insert then replace cancels completely using restored character aliases',()=>{
 const base=A.from({content:''}),a=edit(base,0,0,'a'),b=edit(a,0,1,'b');
 assert.equal(undoCollaborativeChanges(b,[action(base,a),action(a,b)]).content,'');
});
test('undoing multiple history entries follows restored character IDs',()=>{
 const h=new CanvasUndoHistory(),base=A.from({content:''}),a=edit(base,0,0,'a'),b=edit(a,0,1,'b');
 h.record({t:item(base)},{t:item(a)},['t']);h.seal();h.record({t:item(a)},{t:item(b)},['t']);h.seal();
 let result=h.restore({t:item(b)});assert.equal(result.documents.get('t').content,'a');h.pop(result);
 result=h.restore({t:item(result.documents.get('t'))});assert.equal(result.documents.get('t').content,'');
});
test('already remotely deleted local inserts and overlapping remote deletions are not resurrected',()=>{
 const base=A.from({content:'abc'}),local=edit(base,1,1,''),remote=edit(base,1,1,''),merged=A.merge(A.clone(local),remote);
 assert.equal(undoCollaborativeChanges(merged,[action(base,local)]).content,'ac');
 const inserted=edit(base,1,0,'X'),removed=edit(inserted,1,1,'');assert.equal(undoCollaborativeChanges(removed,[action(base,inserted)]).content,'abc');
});
test('emoji, Korean and line breaks retain exact Unicode glyphs',()=>{
 const base=A.from({content:'가😀나\n'}),local=edit(base,1,2,'🙂'),remote=edit(local,0,0,'외');
 assert.equal(undoCollaborativeChanges(remote,[action(base,local)]).content,'외가😀나\n');
});
test('undo own color retains remotely recolored and newly inserted characters',()=>{
 const base=A.from({content:'hello'}),local=A.change(A.clone(base),d=>A.mark(d,['content'],{start:0,end:5,expand:'none'},'textColor','#ff0000'));
 let remote=edit(local,2,0,'X');remote=A.change(remote,d=>A.mark(d,['content'],{start:0,end:1,expand:'none'},'textColor','#0000ff'));
 const undone=undoCollaborativeChanges(remote,[action(base,local)]);assert.equal(undone.content,'heXllo');
 assert.equal(A.marksAt(undone,['content'],0).textColor,'#0000ff');assert.equal(A.marksAt(undone,['content'],1).textColor,undefined);
 assert.equal(A.marksAt(undone,['content'],2).textColor,A.marksAt(remote,['content'],2).textColor);
});
test('grouped local edits separated by remote input undo only local character operations',()=>{
 const h=new CanvasUndoHistory(),base=A.from({content:''}),a=edit(base,0,0,'a'),remote=edit(a,0,0,'b'),c=edit(remote,2,0,'c');
 h.record({t:item(base)},{t:item(a)},['t'],0);h.record({t:item(remote)},{t:item(c)},['t'],100);
 const result=h.restore({t:item(c)});assert.equal(result.documents.get('t').content,'b');
});
test('editor undo skips unrelated newer metadata and never removes the text object',()=>{
 const h=new CanvasUndoHistory(),base=A.from({content:''}),a=edit(base,0,0,'a');
 h.record({}, {t:item(base)},['t']);h.seal();h.record({t:item(base)},{t:item(a)},['t']);h.seal();
 h.record({t:item(a),s:{kind:'shape',x:0}},{t:item(a),s:{kind:'shape',x:1}},['s']);h.seal();
 const result=h.restore({t:item(a),s:{kind:'shape',x:1}},{itemId:'t',textOnly:true});assert.equal(result.index,1);assert.equal(result.documents.get('t').content,'');h.pop(result);
 assert.equal(h.entries.length,2);assert.equal(h.restore({t:item(base),s:{kind:'shape',x:1}},{itemId:'t',textOnly:true}),null);
});
