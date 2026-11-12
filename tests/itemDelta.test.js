import test from 'node:test';
import assert from 'node:assert/strict';
import {applyItemDelta,operationForWire,textDelta,applyTextDelta} from '../src/canvas/sync/itemDelta.js';
test('nested cell delta preserves siblings and handles array operations without modifying the base',()=>{
 const old={notebookCells:[{id:'a',source:'first'},{id:'b',source:'second'}],x:1};
 const next=applyItemDelta(old,[{op:'replace',path:'/notebookCells/1/source',value:'edited'},{op:'add',path:'/notebookCells/2',value:{id:'c',source:''}}]);
 assert.equal(old.notebookCells[1].source,'second');assert.equal(next.notebookCells[0].source,'first');assert.equal(next.notebookCells[1].source,'edited');assert.equal(next.notebookCells.length,3);
 assert.throws(()=>applyItemDelta(old,[{op:'add',path:'/__proto__/polluted',value:true}]));
 assert.throws(()=>applyItemDelta(old,[{op:'replace',path:'/notebookCells/9/source',value:'bad'}]));
});
test('ordinary cell edit transmits only that cell and retains full values locally for rebase',()=>{
 const before=[{id:'a',cellType:'code',source:'a'.repeat(60000)},{id:'b',cellType:'code',source:'x'}];
 const after=[before[0],{...before[1],source:'xy'}];
 const operation={id:'notebook',action:'patch',notebookBase:before,patch:{notebookCells:after},unset:[]};
 const wire=operationForWire(operation);
 assert.equal(wire.patch.notebookCells,undefined);assert.equal(wire.notebook_edits[0].id,'b');assert.deepEqual(wire.notebook_edits[0].patch,{});assert.equal(applyTextDelta('x',wire.notebook_edits[0].source_delta),'xy');assert.ok(JSON.stringify(wire).length<250);assert.equal(operation.patch.notebookCells,after);
 const structural=operationForWire({...operation,patch:{notebookCells:after.slice(1)}});assert.equal(structural.patch.notebookCells,undefined);assert.deepEqual(structural.notebook_structure.remove,['a']);
});

test('text splices preserve Korean, emoji and multibyte boundaries and reject a stale base',()=>{
 for(const [before,after] of [['가나다','가각다'],['a😀b','a😃b'],['😀끝','😀앞끝'],['','안녕'],['전체','']]){const edit=textDelta(before,after);assert.equal(applyTextDelta(before,edit),after);assert.throws(()=>applyTextDelta(before+'!',edit));}
 const before='x'.repeat(60000);const wire=operationForWire({action:'patch',id:'code',textBase:{text:before},snapshotKnown:true,knownChanges:[],patch:{text:before+'!',automerge_snapshot:'large-base'}});
 assert.equal(wire.patch.text,undefined);assert.equal(wire.patch.automerge_snapshot,undefined);assert.ok(JSON.stringify(wire).length<250);assert.equal(applyTextDelta(before,wire.text_edits.text),before+'!');
});

test('rebasing an edited notebook cell preserves remote changes to other cells',async()=>{
 const {HostCanvasView}=await import('../src/canvas/host/HostCanvasView.js');
 const before=[{id:'a',cellType:'code',source:'old a'},{id:'b',cellType:'code',source:'old b'}];
 const committed={n:{kind:'shape',runtimeRole:'notebook',notebookCells:[{...before[0],source:'remote a'},before[1]]}};
 const view=new HostCanvasView();const draft=view.rebase(committed,['n'],[{action:'patch',id:'n',notebookBase:before,patch:{notebookCells:[before[0],{...before[1],source:'local b'}]}}]);
 assert.equal(draft.n.notebookCells[0].source,'remote a');assert.equal(draft.n.notebookCells[1].source,'local b');
});

test('new cells and result updates omit existing source and unrelated outputs',()=>{
 const before=[{id:'a',cellType:'code',source:'x'.repeat(60000)}];const after=[...before,{id:'b',cellType:'code',source:'new'}];
 const wire=operationForWire({action:'patch',id:'n',notebookBase:before,notebookResultBase:{a:{outputs:['large output']}},patch:{notebookCells:after,notebookResults:{a:{outputs:['large output']},b:{outputs:['new output']}}}});
 assert.equal(wire.patch.notebookCells,undefined);assert.equal(wire.patch.notebookResults,undefined);assert.deepEqual(wire.notebook_structure.insert,[after[1]]);assert.deepEqual(Object.keys(wire.notebook_results.set),['b']);assert.ok(JSON.stringify(wire).length<500);
});

test('queued edits retain the earliest cell base and send all locally modified cells',async()=>{
 const {ServerCanvasSession}=await import('../src/canvas/sync/ServerCanvasSession.js');
 const before=[{id:'a',cellType:'code',source:'a'},{id:'b',cellType:'code',source:'b'}];const middle=[{...before[0],source:'aa'},before[1]],after=[middle[0],{...before[1],source:'bb'}];
 const session=new ServerCanvasSession({available:()=>true,send:()=>true,publish:()=>{},status:()=>{},reject:()=>{}});session.seed({n:{kind:'shape',runtimeRole:'notebook',notebookCells:before}},{sync_protocol:2,edit_protocol:2,revision:0,accepted_count:0});
 session.submit([{action:'patch',id:'n',notebookBase:before,patch:{notebookCells:middle},unset:[]}]);session.submit([{action:'patch',id:'n',notebookBase:middle,patch:{notebookCells:after},unset:[]}]);
 const wire=operationForWire(session.queue[0]);assert.deepEqual(wire.notebook_edits.map(e=>e.id),['a','b']);assert.equal(wire.patch.notebookCells,undefined);
 const fallback=operationForWire(session.queue[0],false);assert.deepEqual(fallback.patch.notebookCells,after);assert.equal(fallback.notebookBase,undefined);
});
