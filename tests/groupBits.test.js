import test from 'node:test';
import assert from 'node:assert/strict';
import {compileGroupBits,groupMask,groupMaskHex,groupCapabilityBits,canAccessGroupBits,registerGroupLayout} from '../src/canvas/permissions/groupBits.js';
import {canUseItem} from '../src/canvas/permissions/access.js';
import {canPeerAccessItem} from '../src/canvas/collaborativeSync.js';
test('all 64 group bits retain exact precision including bit 63',()=>{
 const layout=Object.fromEntries(Array.from({length:64},(_,i)=>['g'+i,i]));const index=compileGroupBits(layout);
 assert.equal(groupMask(['g63'],index),1n<<63n);assert.equal(groupMaskHex(['g0','g63'],index),'8000000000000001');
 const identity={group_bits:layout,groups:['g63'],write_groups:['g0'],execute_groups:['g63']};
 const item={permission:['g63']};assert.equal(canUseItem(item,identity,'read'),true);assert.equal(canUseItem(item,identity,'write'),false);assert.equal(canUseItem(item,identity,'execute'),true);
 assert.equal(canPeerAccessItem(item,identity),true);assert.equal(canPeerAccessItem({permission:['g1']},identity),false);
 assert.equal(canAccessGroupBits({permission:['missing']},identity),false);
 assert.equal(JSON.stringify({mask:groupMaskHex(['g63'],index)}),'{"mask":"8000000000000000"}');
});
test('read/write/execute use three capability bits and preserve legacy policy inputs',()=>{
 for(const n of [0,1,3,5,7])assert.equal(groupCapabilityBits(n),n);
 assert.equal(groupCapabilityBits({read:true,write:true,execute:false}),3);
 assert.equal(groupCapabilityBits({read:true,write:false,execute:true}),5);
 assert.equal(groupCapabilityBits({read:false,write:true,execute:true}),0);
 assert.equal(groupCapabilityBits(8),0);
});
test('invalid indices cannot alias another group and legacy peers remain supported',()=>{
 assert.equal(compileGroupBits({a:0,b:0}),null);assert.equal(compileGroupBits({a:64}),null);
 assert.equal(compileGroupBits(Object.fromEntries(Array.from({length:65},(_,i)=>['g'+i,i]))),null);
 assert.equal(canPeerAccessItem({permission:['shared']},{groups:['shared']}),true);
 const index=compileGroupBits({shared:63});assert.equal(groupMask({shared:false},index),0n);assert.equal(groupMask({shared:true},index),1n<<63n);
});
test('new layout and immutable membership arrays do not retain stale masks after role changes',()=>{
 const first={group_bits:{a:0,b:63},groups:['a']},item={permission:['a']};assert.equal(canPeerAccessItem(item,first),true);
 const revoked={...first,groups:['b']};assert.equal(canPeerAccessItem(item,revoked),false);
 const renamed={group_bits:{renamed:0,b:63},groups:['renamed']};assert.equal(canPeerAccessItem({permission:['renamed']},renamed),true);assert.equal(canPeerAccessItem(item,renamed),false);
});

test('local drawing peer checks reuse the authenticated layout through their membership array',()=>{
 const groups=['high'],layout={high:63};registerGroupLayout(groups,layout);
 assert.equal(canAccessGroupBits({permission:['high']},{groups}),true);
 assert.equal(canAccessGroupBits({permission:['other']},{groups}),false);
});
