import test from 'node:test';import assert from 'node:assert/strict';
import {createValue,validValue,valueDefinition,displayedValue} from '../src/canvas/values/valueData.js';
import {isRuntimeOnlyOperation,validRuntimeState,validMediaState} from '../src/canvas/runtime/sharedState.js';
import {assertObjectOperations} from '../src/canvas/locks/objectLock.js';
import {assertAccessOperations} from '../src/canvas/permissions/access.js';
test('continuous and discrete values have finite bounded shared representations',()=>{
 for(const type of ['real','integer','button','select','text'])assert.equal(validValue(createValue(type)),true,type);
 const real=createValue();assert.equal(validValue({...real,valueNumber:.123456}),true);for(const n of [NaN,Infinity,-1,2])assert.equal(validValue({...real,valueNumber:n}),false);
 assert.equal(validValue({...createValue('integer'),valueNumber:1.2}),false);assert.equal(validValue({...createValue('button'),valueNumber:2}),false);assert.equal(validValue({...createValue('select'),valueNumber:3}),false);
 assert.equal(displayedValue({...createValue('select'),valueNumber:1}),'B');assert.equal(displayedValue({...createValue('text'),valueText:'공동 값'}),'공동 값');
});
test('range changes clamp atomically and reject invalid definitions',()=>{
 const item={...createValue(),valueNumber:.8};assert.equal(valueDefinition(item,{valueMax:.5,valueStep:.1}).valueNumber,.5);
 assert.equal(valueDefinition(item,{valueMin:2}),null);assert.equal(valueDefinition(createValue('integer'),{valueStep:.1}),null);
 assert.equal(validValue({...createValue('select'),valueOptions:Array(33).fill('x')}),false);
});
test('shared playback and runtime states reject invalid fields',()=>{
 assert.ok(validMediaState({paused:false,time:1,updatedAt:1,actor:'client'}));assert.equal(validMediaState({paused:false,time:-1,updatedAt:1,actor:'client'}),false);
 assert.ok(validRuntimeState({kind:'text',renderMode:'code',runtimeState:{running:true,status:'running',updatedAt:1}}));assert.equal(validRuntimeState({kind:'value',runtimeState:{running:true,updatedAt:1}}),false);
});
test('execute-only users can share runtime status on locked code without editing content',()=>{
 const items={a:{kind:'text',renderMode:'code',text:'print(1)',locked:true,permission:['g']}};const state={action:'patch',id:'a',patch:{runtimeState:{running:true,status:'running',updatedAt:1}},unset:[]};
 assert.ok(isRuntimeOnlyOperation(items.a,state));assert.doesNotThrow(()=>assertObjectOperations(items,[state]));assert.doesNotThrow(()=>assertAccessOperations(items,[state],{groups:['g'],execute_groups:['g'],write_groups:[]}));
 const edit={...state,patch:{...state.patch,text:'changed'}};assert.equal(isRuntimeOnlyOperation(items.a,edit),false);assert.throws(()=>assertObjectOperations(items,[edit]));assert.throws(()=>assertAccessOperations(items,[edit],{groups:['g'],execute_groups:['g'],write_groups:[]}));
});
