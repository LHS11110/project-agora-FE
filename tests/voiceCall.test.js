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

class FakePeer {
 constructor(){this.connectionState='new';this.iceConnectionState='new';this.signalingState='stable';this.restarts=0;}
 addTrack(){} close(){this.connectionState='closed';} restartIce(){this.restarts++;}
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(options={}){
 const events=[],track={enabled:true,stopped:false,stop(){this.stopped=true;}},stream={getTracks:()=>[track],getAudioTracks:()=>[track]};let captures=0;
 const call=new CanvasVoiceCall({send:event=>{events.push(event);return true;},media:{getUserMedia:async()=>{captures++;return stream;}},Peer:FakePeer,audio:()=>({muted:false,volume:1,pause(){},play:async()=>{}}),AudioContext:null,...options});
 call.handle({type:'rtc_peers',self_peer_id:'a',peers:[{peer_id:'b',nickname:'Other',tag_number:2,voice_active:true}]});
 return {call,events,track,stream,captures:()=>captures};
}
test('recoverable signaling drops retain the call and preferences, pausing until reauthenticated',async()=>{
 const {call,track,stream,captures}=fixture();
 try{
  await call.join();call.mute();call.deafen();call.setPeerVolume('b',35);call.reconnect();
  assert.equal(call.snapshot.active,true);assert.equal(call.snapshot.reconnecting,true);assert.equal(track.stopped,false);assert.equal(track.enabled,false);
  call.handle({type:'rtc_peers',self_peer_id:'new-self',peers:[{peer_id:'new-peer',nickname:'Other',tag_number:2,voice_active:true}]});
  assert.equal(call.stream,stream);assert.equal(captures(),1);assert.equal(call.snapshot.reconnecting,false);assert.equal(call.snapshot.muted,true);assert.equal(call.snapshot.deafened,true);
  assert.equal(call.links.get('new-peer').audio.volume,.35);assert.equal(call.links.get('new-peer').audio.muted,true);assert.equal(call.snapshot.participants[0].volume,35);
  call.mute();assert.equal(track.enabled,true);
 }finally{call.close();}
});
test('leaving or losing permission during recovery prevents automatic rejoin and stops capture',async()=>{
 for(const action of ['leave','suspend']){
  const {call,track}=fixture();await call.join();call.reconnect();call[action]();
  call.handle({type:'rtc_peers',self_peer_id:'new-self',peers:[{peer_id:'b',voice_active:true}]});
  assert.equal(track.stopped,true);assert.equal(call.snapshot.active,false);assert.equal(call.links.size,0);call.close();
 }
});
test('recovery timeout bounds how long a paused microphone is retained',async()=>{
 const {call,track}=fixture({reconnectTimeout:15});await call.join();call.reconnect();await wait(40);
 assert.equal(track.stopped,true);assert.equal(call.snapshot.active,false);assert.equal(call.snapshot.error,'VOICE_RECONNECT_TIMEOUT');call.close();
});
test('participant volume is local, clamped, and independent of global deafen',async()=>{
 const {call,events}=fixture();try{
  await call.join();const before=events.length;call.setPeerVolume('b',25);assert.equal(call.links.get('b').audio.volume,.25);assert.equal(events.length,before);
  call.deafen();call.setPeerVolume('b',45);call.deafen();assert.equal(call.links.get('b').audio.volume,.45);assert.equal(call.links.get('b').audio.muted,false);
  call.setPeerVolume('b',-10);assert.equal(call.snapshot.participants[0].volume,0);call.setPeerVolume('b',200);assert.equal(call.snapshot.participants[0].volume,100);
  call.setPeerVolume('b',NaN);assert.equal(call.snapshot.participants[0].volume,100);
 }finally{call.close();}
});
test('a temporary media disconnect schedules ICE recovery without leaving the room',async()=>{
 const {call,track}=fixture({disconnectDelay:1});try{
  await call.join();const pc=call.links.get('b').pc;pc.connectionState='disconnected';pc.iceConnectionState='disconnected';pc.oniceconnectionstatechange();await wait(20);
  assert.equal(pc.restarts,1);assert.equal(call.snapshot.active,true);assert.equal(track.stopped,false);
  pc.connectionState='connected';pc.iceConnectionState='connected';pc.onconnectionstatechange();assert.equal(call.links.get('b').recovering,false);
 }finally{call.close();}
});
test('a full WebSocket send budget retries voice state instead of silently losing membership',async()=>{
 const delivered=[];let writable=false;
 const {call}=fixture({send:event=>{if(!writable)return false;delivered.push(event);return true;}});
 try{await call.join();assert.equal(delivered.length,0);writable=true;await wait(150);assert.equal(delivered.find(e=>e.type==='voice_state')?.active,true);}finally{call.close();}
});
test('ICE generation matching does not accept a previous credential that is only a prefix',()=>{
 const {call}=fixture();assert.equal(call.candidateMatches({usernameFragment:'old'},{sdp:'v=0\r\na=ice-ufrag:old-new\r\n'}),false);
 assert.equal(call.candidateMatches({usernameFragment:'current'},{sdp:'v=0\r\na=ice-ufrag:current\r\n'}),true);call.close();
});
test('queued mute changes preserve membership-before-SDP ordering during backpressure',async()=>{
 const delivered=[];let writable=false;const {call}=fixture({send:event=>{if(!writable)return false;delivered.push(event);return true;}});
 try{
  await call.join();call.signal({type:'rtc_signal',peer_id:'b',action:'offer',description:{type:'offer',sdp:'queued offer'}},call.links.get('b'));call.mute();writable=true;await wait(150);
  assert.equal(delivered[0].type,'voice_state');assert.equal(delivered[0].active,true);assert.equal(delivered[0].muted,true);assert.equal(delivered[1].type,'rtc_signal');
 }finally{call.close();}
});
test('Web Audio primes native remote playout while preserving exactly one audible output',async()=>{
 class Context{
  constructor(){this.state='running';this.currentTime=0;this.destination={};}
  resume(){return Promise.resolve();}close(){return Promise.resolve();}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createGain(){return {gain:{value:1,setTargetAtTime(value){this.value=value;}},connect(){},disconnect(){}};}
 }
 const player={muted:false,volume:1,paused:true,plays:0,play(){this.plays++;this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
 const {call}=fixture({AudioContext:Context,audio:()=>player});
 try{
  await call.join();const remote={};call.links.get('b').pc.ontrack({streams:[remote]});
  assert.equal(player.srcObject,remote);assert.equal(player.paused,false);assert.equal(player.muted,true);assert.equal(player.volume,0);
  call.setPeerVolume('b',35);assert.equal(call.links.get('b').gain.gain.value,.35);call.mute();assert.equal(player.muted,true);
  call.deafen();assert.equal(call.links.get('b').gain.gain.value,0);call.deafen();assert.equal(call.links.get('b').gain.gain.value,.35);assert.equal(player.volume,0);
  await call.resumeAudio();assert.ok(player.plays>=2);assert.equal(player.muted,true);assert.equal(player.volume,0);
  call.drop('b');assert.equal(player.paused,true);assert.equal(player.srcObject,null);
 }finally{call.close();}
});
test('screen share announces, attaches video, removes tracks, and ends on leave',async()=>{
 const screenTrack={kind:'video',stopped:false,stop(){this.stopped=true;}},screen={getTracks:()=>[screenTrack],getVideoTracks:()=>[screenTrack]};
 class ScreenPeer extends FakePeer{addTrack(track){if(track.kind==='video')return this.videoSender={track};}removeTrack(sender){this.removed=sender;}}
 const {call,events}=fixture({Peer:ScreenPeer,media:{getUserMedia:async()=>({getTracks:()=>[],getAudioTracks:()=>[]}),getDisplayMedia:async()=>screen}});
 try{await call.join();await call.startScreen();const link=call.links.get('b');assert.equal(call.snapshot.screenSharing,true);assert.equal(link.screenSender.track,screenTrack);assert.equal(events.at(-1).screen_sharing,true);call.stopScreen();assert.equal(link.pc.removed.track,screenTrack);assert.equal(screenTrack.stopped,true);assert.equal(events.at(-1).screen_sharing,false);assert.equal(call.snapshot.screenSharing,false);}finally{call.close();}
});
test('leaving while screen picker is open stops late capture',async()=>{let finish;const track={stop(){this.stopped=true;}},screen={getTracks:()=>[track],getVideoTracks:()=>[track]};const {call}=fixture({media:{getUserMedia:async()=>({getTracks:()=>[],getAudioTracks:()=>[]}),getDisplayMedia:()=>new Promise(resolve=>finish=resolve)}});await call.join();const pending=call.startScreen();call.leave();finish(screen);await pending;assert.equal(track.stopped,true);assert.equal(call.snapshot.screenSharing,false);call.close();});
test('negotiation requested during an offer is retried after signaling becomes stable',async()=>{
 const {call,events}=fixture();try{await call.join();const link=call.links.get('b'),pc=link.pc;pc.setLocalDescription=async()=>{pc.localDescription={type:'offer',toJSON:()=>({type:'offer',sdp:'test'})};};pc.signalingState='have-local-offer';pc.onnegotiationneeded();await link.serial;assert.equal(link.needsNegotiation,true);pc.signalingState='stable';pc.onsignalingstatechange();await link.serial;assert.equal(link.needsNegotiation,false);assert.ok(events.some(e=>e.type==='rtc_signal'&&e.action==='offer'));}finally{call.close();}
});
