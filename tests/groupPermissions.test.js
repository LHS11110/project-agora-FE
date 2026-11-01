import test from 'node:test';import assert from 'node:assert/strict';
import {canUseItem,canUseCanvas,assertAccessOperations} from '../src/canvas/permissions/access.js';
const box={kind:'shape',permission:'default'},viewer={groups:['default'],write_groups:[],execute_groups:[],is_admin:false};
test('read does not imply write or execution; rights combine across groups',()=>{
 assert.equal(canUseItem(box,viewer,'read'),true);assert.equal(canUseItem(box,viewer),false);assert.equal(canUseCanvas(viewer,'execute'),false);
 const operator={...viewer,execute_groups:['default']};assert.equal(canUseItem(box,operator,'execute'),true);assert.equal(canUseItem(box,operator),false);
 const writer={...viewer,write_groups:['other','default']};assert.equal(canUseItem(box,writer),true);assert.equal(canUseItem(box,writer,'execute'),false);
});
test('central mutation checks protect create, patch, delete, translation and ACL reassignment',()=>{
 for(const op of [{action:'create',id:'new',patch:box},{action:'patch',id:'box',patch:{x:2}},{action:'delete',id:'box'},{action:'translate',ids:['box'],dx:1,dy:0}])assert.throws(()=>assertAccessOperations({box},[op],viewer),/쓰기 권한/);
 assert.doesNotThrow(()=>assertAccessOperations({box},[{action:'patch',id:'box',patch:{x:2}}],{...viewer,is_admin:true}));
});
test('execution-only access can publish output without gaining object edit access',()=>{
 const output={kind:'shape',runtimeRole:'output',permission:'default'},operator={...viewer,execute_groups:['default']};
 assert.doesNotThrow(()=>assertAccessOperations({output},[{action:'patch',id:'output',patch:{runtimeResults:[]}}],operator));
 assert.throws(()=>assertAccessOperations({output},[{action:'patch',id:'output',patch:{runtimeResults:[],x:2}}],operator),/쓰기 권한/);
 assert.throws(()=>assertAccessOperations({output},[{action:'patch',id:'output',patch:{runtimeResults:[]}}],{...viewer,write_groups:['default']}),/실행 권한/);
});
