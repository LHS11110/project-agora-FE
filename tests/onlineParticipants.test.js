import test from 'node:test';
import assert from 'node:assert/strict';
import { onlineCanvasParticipants } from '../src/canvas/onlineParticipants.js';
import { mobilePanelVisibility } from '../src/canvas/panels/panelLayout.js';
const user={nickname:'self',tag_number:1};
test('online profiles come only from connected broker peers, not canvas membership',()=>{
 const profiles=[user,{nickname:'member-only',tag_number:2},{nickname:'online',tag_number:3,profile_image:'/avatar'}];
 const peers=[{nickname:'online',tag_number:3,connected:true},{nickname:'gone',tag_number:4,connected:false}];
 const result=onlineCanvasParticipants(user,peers,profiles,true);
 assert.deepEqual(result.map(p=>p.nickname),['self','online']);
 assert.equal(result[0].isSelf,true);assert.equal(result[1].profile_image,'/avatar');
 assert.deepEqual(onlineCanvasParticipants(user,peers,profiles,false),[]);
});
test('multiple tabs count as one user and leaving peers disappear',()=>{
 const peers=[{...user,connected:true},{nickname:'other',tag_number:2,connected:true},{nickname:'other',tag_number:2,connected:true},{nickname:'invalid',tag_number:'NaN',connected:true}];
 assert.equal(onlineCanvasParticipants(user,peers,[],true).length,2);
 assert.deepEqual(onlineCanvasParticipants(user,[],[],true).map(p=>p.nickname),['self']);
});
test('compact layouts expose at most one expanded content panel',()=>{
 assert.deepEqual(mobilePanelVisibility({tools:false,inspector:false,chat:false}),{tools:true,inspector:false,chat:true});
 assert.deepEqual(mobilePanelVisibility({tools:false,inspector:true,chat:false}),{tools:false,inspector:true,chat:true});
 assert.deepEqual(mobilePanelVisibility({tools:true,inspector:true,chat:false}),{tools:true,inspector:true,chat:false});
 assert.deepEqual(mobilePanelVisibility({tools:true,inspector:true,chat:true}),{tools:true,inspector:true,chat:true});
});

test('routine sync success is silent, while pending saves and recovery failures remain visible',async()=>{
 const {canvasNeedsAttention}=await import('../src/canvas/syncAttention.js');
 const healthy={ready:true,blocked:false,queued:0};
 assert.equal(canvasNeedsAttention(healthy,{status:'accepted'}),false);
 assert.equal(canvasNeedsAttention({...healthy,queued:1}),true);
 assert.equal(canvasNeedsAttention({...healthy,ready:false}),true);
 assert.equal(canvasNeedsAttention({...healthy,blocked:true}),true);
 assert.equal(canvasNeedsAttention(healthy,{status:'rejected'}),true);
});
