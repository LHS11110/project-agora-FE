import test from 'node:test';
import assert from 'node:assert/strict';
import CanvasVoiceCall from '../src/canvas/voice/CanvasVoiceCall.js';
test('leaving during the microphone permission prompt releases a subsequently granted stream',async()=>{
 let resolve,stopped=false;
 const call=new CanvasVoiceCall({send:()=>true,Peer:class{},media:{getUserMedia:()=>new Promise(done=>resolve=done)}});
 call.handle({type:'rtc_peers',self_peer_id:'self',peers:[]});const joining=call.join();
 assert.equal(call.snapshot.pending,true);call.leave();
 resolve({getTracks:()=>[{stop:()=>stopped=true}]});await joining;
 assert.equal(stopped,true);assert.equal(call.stream,null);assert.equal(call.snapshot.pending,false);call.close();
});
test('unsolicited signaling cannot open audio connections before opting in',()=>{
 let constructed=0;
 const call=new CanvasVoiceCall({send:()=>true,media:{},Peer:class{constructor(){constructed++;}}});
 call.handle({type:'rtc_peers',self_peer_id:'self',peers:[{peer_id:'other',voice_active:true}]});
 call.handle({type:'rtc_signal',from_peer_id:'other',action:'offer',description:{type:'offer',sdp:'fake'}});
 assert.equal(constructed,0);assert.equal(call.links.size,0);call.close();
});
