import test from 'node:test';
import assert from 'node:assert/strict';
import * as Automerge from '@automerge/automerge';
import {restoreOperations} from '../src/canvas/github/branchRestore.js';
import {loadItemDoc} from '../src/canvas/host/hostOperations.js';
import {encodeBase64} from '../src/canvas/collaborativeSync.js';
import {textColorRanges} from '../src/canvas/content/textColors.js';
const box={kind:'shape',shapeType:'rectangle',x:0,y:0,width:.1,height:.1,permission:'default'};
test('restore removes absent fields/objects and orders endpoints before wires',()=>{
 const manifest={version:1,items:{a:{...box,x:160,width:160,height:100},b:{...box,x:320,width:160,height:100},wire:{kind:'connector',from:'a',to:'b',permission:'default'}}};
 const operations=restoreOperations(manifest,{a:{...box,shadowEnabled:true},gone:{...box},oldwire:{kind:'connector',from:'a',to:'gone'}});
 assert.equal(operations[0].id,'oldwire');assert.equal(operations[0].action,'delete');assert.equal(operations.at(-1).id,'gone');assert.ok(operations.find(o=>o.id==='a').unset.includes('shadowEnabled'));assert.ok(operations.findIndex(o=>o.id==='b')<operations.findIndex(o=>o.id==='wire'));
});
test('restore keeps CRDT ancestry while restoring text and color marks',()=>{
 const base=Automerge.from({content:'old text'}),old={kind:'text',text:'old text',x:0,y:0,width:.1,permission:'default',automerge_snapshot:encodeBase64(Automerge.save(base))};
 const [op]=restoreOperations({version:1,items:{t:{kind:'text',text:'new 한글',x:0,y:0,width:160,permission:'default',textColors:[{start:0,end:3,color:'#ff0000'}]}}},{t:old});
 const stored={...old,...op.patch};assert.equal(loadItemDoc(stored).content,'new 한글');assert.deepEqual(textColorRanges(stored),[{start:0,end:3,color:'#ff0000'}]);
});
test('restore refuses locked edits before sending any mutations',()=>{
 assert.throws(()=>restoreOperations({version:1,items:{}},{locked:{...box,locked:true}}),/잠긴/);
});
