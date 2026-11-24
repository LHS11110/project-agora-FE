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
test('screen audio volume changes only the screen gain and retains bounded preference',()=>{
 const {call}=fixture();let target;call.audioContext={currentTime:7,close:async()=>{}};call.screenMix={gain:{gain:{setTargetAtTime:value=>target=value}}};
 call.setScreenAudioVolume(25);assert.equal(target,.25);assert.equal(call.snapshot.screenAudioVolume,25);assert.equal(call.muted,false);
 call.setScreenAudioVolume(-1);assert.equal(target,0);call.setScreenAudioVolume(200);assert.equal(target,1);call.setScreenAudioVolume(NaN);assert.equal(call.screenAudioVolume,100);
 call.screenMix=null;call.close();
});
test('remote mute or DTX track mute while connected does not trigger spurious ICE restarts',async()=>{
 const {call}=fixture({disconnectDelay:10,muteRepairDelay:15});
 try{
  await call.join();
  const link=call.links.get('b'),pc=link.pc;
  const remoteTrack={kind:'audio',muted:false};
  pc.connectionState='connected';pc.iceConnectionState='connected';pc.onconnectionstatechange();
  pc.ontrack({streams:[{}],track:remoteTrack});
  remoteTrack.muted=true;
  remoteTrack.onmute();
  call.handle({type:'voice_state',peer_id:'b',active:true,muted:true});
  await wait(40);
  assert.equal(pc.restarts,0);
  assert.equal(call.snapshot.error,'');
  // Unmuted DTX silence while transport remains connected must also not restart ICE.
  call.handle({type:'voice_state',peer_id:'b',active:true,muted:false});
  remoteTrack.onmute();
  await wait(40);
  assert.equal(pc.restarts,0);
  assert.equal(call.snapshot.error,'');
 }finally{call.close();}
});
test('failed peer connection rebuilds RTCPeerConnection instead of keeping a dead transport',async()=>{
 const {call}=fixture({disconnectDelay:1});
 try{
  await call.join();
  const originalPc=call.links.get('b').pc;
  originalPc.connectionState='failed';
  originalPc.iceConnectionState='failed';
  originalPc.oniceconnectionstatechange();
  await wait(350);
  const currentLink=call.links.get('b');
  assert.ok(currentLink);
  assert.notEqual(currentLink.pc,originalPc);
  assert.equal(originalPc.connectionState,'closed');
  assert.equal(currentLink.recovering,true);
 }finally{call.close();}
});
test('receiving an answer after glare collision resets ignoreOffer so later candidates apply',async()=>{
 const added=[];
 class SignalPeer extends FakePeer{
  setRemoteDescription(desc){this.remoteDescription=desc;if(desc.type==='offer')this.signalingState='have-remote-offer';else this.signalingState='stable';}
  setLocalDescription(){this.localDescription={type:'answer',toJSON:()=>({type:'answer',sdp:'v=0\r\na=ice-ufrag:ans\r\n'})};}
  addIceCandidate(candidate){added.push(candidate);}
 }
 const {call}=fixture({Peer:SignalPeer});
 try{
  await call.join();
  const link=call.links.get('b'),pc=link.pc;
  pc.signalingState='have-local-offer';
  call.handle({type:'rtc_signal',from_peer_id:'b',action:'offer',description:{type:'offer',sdp:'v=0\r\na=ice-ufrag:peer\r\n'}});
  await link.serial;
  assert.equal(link.ignoreOffer,true);
  call.handle({type:'rtc_signal',from_peer_id:'b',action:'answer',description:{type:'answer',sdp:'v=0\r\na=ice-ufrag:peer\r\n'}});
  await link.serial;
  assert.equal(link.ignoreOffer,false);
  call.handle({type:'rtc_signal',from_peer_id:'b',action:'candidate',candidate:{candidate:'candidate:1 1 UDP 1 127.0.0.1 9999 typ host',usernameFragment:'peer'}});
  await link.serial;
  assert.equal(added.length,1);
 }finally{call.close();}
});

test('voice call emits join, screen share, and leave sound cues only for genuine state transitions',async()=>{
 const cues=[];
 const tracks=[{kind:'audio',enabled:true,stop(){},getSettings(){return {channelCount:1};}}];
 const screenTracks=[{kind:'video',stop(){}},{kind:'audio',stop(){}}];
 const fakeScreen={getVideoTracks:()=>[screenTracks[0]],getAudioTracks:()=>[screenTracks[1]],getTracks:()=>screenTracks};
 const media={
  getUserMedia:async()=>({getAudioTracks:()=>tracks,getTracks:()=>tracks}),
  getDisplayMedia:async()=>fakeScreen,
 };
 const call=new CanvasVoiceCall({send:()=>true,media,Peer:FakePeer,audio:()=>({muted:false,volume:1,pause(){},play:async()=>{}}),AudioContext:null,onCue:cue=>cues.push(cue)});
 try{
  call.handle({type:'rtc_peers',self_peer_id:'a',peers:[]});
  await call.join();
  assert.deepEqual(cues,['voice_join']);

  // Temporary broker reconnect and session restoration do not replay join or leave.
  call.reconnect();
  call.handle({type:'rtc_peers',self_peer_id:'a',peers:[]});
  assert.deepEqual(cues,['voice_join']);

  // Cancelled screen share does not fire cue.
  media.getDisplayMedia=async()=>{const err=new Error('cancelled');err.name='NotAllowedError';throw err;};
  await call.startScreen();
  assert.deepEqual(cues,['voice_join']);

  // Active screen share and manual screen stop both fire cues.
  media.getDisplayMedia=async()=>fakeScreen;
  await call.startScreen();
  assert.deepEqual(cues,['voice_join','screen_share_start']);
  call.stopScreen();
  assert.deepEqual(cues,['voice_join','screen_share_start','screen_share_stop']);

  // Leaving while screen sharing emits only voice_leave (not duplicate screen_share_stop).
  await call.startScreen();
  assert.deepEqual(cues,['voice_join','screen_share_start','screen_share_stop','screen_share_start']);
  call.leave();
  assert.deepEqual(cues,['voice_join','screen_share_start','screen_share_stop','screen_share_start','voice_leave']);

  // Remote voice_notice cues only play while connected to voice, not while idle, reconnecting, or from self.
  call.handle({type:'voice_notice',event:'voice_join',peer_id:'b'});
  call.handle({type:'voice_notice',event:'screen_share_start',peer_id:'b'});
  assert.deepEqual(cues,['voice_join','screen_share_start','screen_share_stop','screen_share_start','voice_leave']);

  await call.join();
  call.handle({type:'voice_notice',event:'voice_join',peer_id:'a'}); // ignored: self
  call.handle({type:'voice_notice',event:'voice_join',peer_id:'b'});
  call.handle({type:'voice_notice',event:'screen_share_start',peer_id:'b'});
  call.handle({type:'voice_notice',event:'screen_share_stop',peer_id:'b'});
  call.handle({type:'voice_notice',event:'voice_leave',peer_id:'b'});
  call.handle({type:'voice_notice',event:'unknown_event',peer_id:'b'});
  call.reconnect();
  call.handle({type:'voice_notice',event:'voice_join',peer_id:'b'}); // ignored while reconnecting
  call.close();
  assert.deepEqual(cues,[
   'voice_join','screen_share_start','screen_share_stop','screen_share_start','voice_leave',
   'voice_join','voice_join','screen_share_start','screen_share_stop','voice_leave'
  ]);
 }finally{call.close();}
});
test('received system volume and voice volume are independent preferences',async()=>{
 const {call}=fixture();try{await call.join();const link=call.links.get('b');let system;
 link.systemAudio={};link.systemGain={gain:{setTargetAtTime:v=>system=v},disconnect(){}};call.audioContext={currentTime:0,close:async()=>{}};
 call.setPeerSystemVolume('b',25);assert.equal(system,.25);call.setPeerVolume('b',60);assert.equal(system,.25);assert.equal(call.snapshot.participants[0].systemVolume,25);assert.equal(call.snapshot.participants[0].volume,60);
 call.deafen();assert.equal(system,0);call.deafen();assert.equal(system,.25);
 link.systemAudio={pause(){}};
 }finally{call.close();}
});

test('server relay credentials force media through TURN and are renewed over authenticated signaling',()=>{
 let config;
 class RelayPeer extends FakePeer{constructor(value){super();config=value;}}
 const {call}=fixture({Peer:RelayPeer});
 const servers=[{urls:'turns:frelog.p-e.kr:443?transport=tcp',username:'expiry:nonce',credential:'test-credential'}];
 call.handle({type:'rtc_peers',self_peer_id:'self',peers:[],media_relay:{ice_servers:servers,expires_at:Math.floor(Date.now()/1000)+86400}});
 call.stream={getAudioTracks:()=>[],getTracks:()=>[]};
 call.handle({type:'rtc_peer_joined',peer:{peer_id:'other',nickname:'other',tag_number:1,voice_active:true}});
 assert.equal(config.iceTransportPolicy,'relay');assert.deepEqual(config.iceServers,servers);assert.ok(call.relayTimer);
 call.close();assert.equal(call.relayTimer,null);
});
test('unavailable Wall relay disables joining rather than using STUN or direct connections',()=>{
 const {call}=fixture();
 call.handle({type:'rtc_peers',self_peer_id:'self',peers:[],media_relay:{ice_servers:[]}});
 assert.equal(call.snapshot.ready,false);assert.equal(call.snapshot.error,'VOICE_RELAY_UNAVAILABLE');assert.equal(call.iceTransportPolicy,'relay');call.close();
});

test('relay renewal preserves max-bundle settings and restarts ICE on existing links',async()=>{
 class ConfigPeer extends FakePeer{
  constructor(config){super();this.config=config;}
  getConfiguration(){return this.config;}
  setConfiguration(config){this.config=config;}
 }
 const {call}=fixture({Peer:ConfigPeer});
 try{await call.join();const pc=call.links.get('b').pc;
  call.applyRelay({ice_servers:[{urls:'turns:frelog.p-e.kr:443?transport=tcp',username:'renewed',credential:'test'}],expires_at:Math.floor(Date.now()/1000)+86400});
  assert.equal(pc.config.bundlePolicy,'max-bundle');assert.equal(pc.config.rtcpMuxPolicy,'require');assert.equal(pc.config.iceTransportPolicy,'relay');assert.equal(pc.restarts,1);
 }finally{call.close();}
});
test('only the elected peer sends the initial offer, avoiding TURN gathering rollback',async()=>{
 class OfferPeer extends FakePeer{async setLocalDescription(){this.offers=(this.offers||0)+1;this.localDescription={type:'offer',toJSON:()=>({type:'offer',sdp:'v=0'})};}}
 const {call}=fixture({Peer:OfferPeer});
 try{await call.join();const link=call.links.get('b');call.self='z';link.pc.onnegotiationneeded();await link.serial;assert.equal(link.pc.offers,undefined);
  call.self='a';link.pc.onnegotiationneeded();await link.serial;assert.equal(link.pc.offers,1);
 }finally{call.close();}
});

test('seamless token rotation preserves connected WebRTC audio, skips duplicate ICE restarts, and hands off without mute or chimes',async()=>{
 const cues=[];
 const tracks=[{kind:'audio',enabled:true,stop(){},getSettings(){return {channelCount:1};}}];
 const media={getUserMedia:async()=>({getAudioTracks:()=>tracks,getTracks:()=>tracks})};
 class ConfigPeer extends FakePeer{
  constructor(config){super();this.config=config;}
  getConfiguration(){return this.config;}
  setConfiguration(config){this.config=config;}
 }
 const servers=[{urls:'turns:frelog.p-e.kr:443?transport=tcp',username:'user1',credential:'cred1'}];
 const call=new CanvasVoiceCall({send:()=>true,media,Peer:ConfigPeer,audio:()=>({muted:false,volume:1,paused:false,pause(){this.paused=true;},play:async()=>{}}),AudioContext:null,onCue:c=>cues.push(c),handoffTimeout:300,leaveCueGrace:60});
 try{
  call.handle({type:'rtc_peers',self_peer_id:'a1',peers:[{peer_id:'b1',nickname:'PeerB',tag_number:2,voice_active:true}],media_relay:{ice_servers:servers,expires_at:Math.floor(Date.now()/1000)+86400}});
  await call.join();
  const linkOld=call.links.get('b1');
  linkOld.pc.connectionState='connected';linkOld.pc.iceConnectionState='connected';
  linkOld.pc.ontrack({streams:[{}],track:{kind:'audio'}});
  linkOld.pc.onconnectionstatechange();

  // Repeating identical relay credentials must not restart ICE.
  call.applyRelay({ice_servers:servers,expires_at:Math.floor(Date.now()/1000)+86400});
  assert.equal(linkOld.pc.restarts,0);

  // Seamless broker rotation keeps active audio/mic live via handoff instead of muting or dropping.
  call.reconnect({seamless:true});
  assert.equal(call.snapshot.reconnecting,false);
  assert.equal(tracks[0].enabled,true);
  assert.equal(call.handoffs.size,1);
  assert.equal(linkOld.audio.muted,false);
  assert.notEqual(linkOld.pc.connectionState,'closed');

  // Rejoined with new self_peer_id while PeerB keeps its peer_id -> new link stays muted until connected, then atomically replaces handoff.
  call.handle({type:'rtc_peers',self_peer_id:'a2',peers:[{peer_id:'b1',nickname:'PeerB',tag_number:2,voice_active:true}],media_relay:{ice_servers:servers,expires_at:Math.floor(Date.now()/1000)+86400}});
  const linkNew=call.links.get('b1');
  assert.equal(linkNew.waitingHandoff,true);
  linkNew.pc.ontrack({streams:[{}],track:{kind:'audio'}});
  assert.equal(linkNew.audio.muted,true,'replacement link stays muted until ICE/DTLS connects');
  assert.equal(call.snapshot.participants[0].status,'connected');

  linkNew.pc.connectionState='connected';linkNew.pc.iceConnectionState='connected';
  linkNew.pc.onconnectionstatechange();
  assert.equal(linkNew.waitingHandoff,false);
  assert.equal(linkNew.audio.muted,false);
  assert.equal(call.handoffs.size,0);
  assert.equal(linkOld.pc.connectionState,'closed');
  assert.deepEqual(cues,['voice_join']);

  // PeerB rotating within leaveCueGrace keeps PeerB handoff live and suppresses leave/join chimes.
  linkNew.pc.connectionState='connected';linkNew.pc.iceConnectionState='connected';
  call.handle({type:'rtc_peer_left',peer_id:'b1'});
  call.handle({type:'voice_notice',event:'voice_leave',peer_id:'b1'});
  assert.equal(call.handoffs.size,1);
  await wait(15);
  call.handle({type:'rtc_peer_joined',peer:{peer_id:'b2',nickname:'PeerB',tag_number:2,voice_active:true}});
  call.handle({type:'voice_notice',event:'voice_join',peer_id:'b2'});
  await wait(80);
  assert.deepEqual(cues,['voice_join'],'brief credential rotation must not play leave/join chimes');

  // Genuine departure past leaveCueGrace plays voice_leave.
  const b2Link=call.links.get('b2');
  b2Link.pc.connectionState='connected';b2Link.pc.iceConnectionState='connected';
  call.handle({type:'rtc_peer_left',peer_id:'b2'});
  call.handle({type:'voice_notice',event:'voice_leave',peer_id:'b2'});
  await wait(90);
  assert.deepEqual(cues,['voice_join','voice_leave']);
 }finally{call.close();}
});

test('call channels connect only peers in the same channel and moving keeps the microphone',async()=>{
 const {call,events,captures}=fixture();
 call.handle({type:'rtc_peers',self_peer_id:'a',peers:[
  {peer_id:'b',nickname:'B',tag_number:2,voice_active:true,voice_channel:'general'},
  {peer_id:'c',nickname:'C',tag_number:3,voice_active:true,voice_channel:'standup'},
  {peer_id:'d',nickname:'D',tag_number:4,voice_active:true}]});
 await call.join('standup');
 assert.equal(call.channel,'standup');
 assert.deepEqual([...call.links.keys()],['c']);
 assert.equal(events.filter(e=>e.type==='voice_state').at(-1).channel,'standup');
 assert.deepEqual(call.snapshot.participants.map(p=>p.peer_id),['c']);
 assert.deepEqual(Object.keys(call.snapshot.channelMembers).sort(),['general','standup']);
 assert.equal(call.snapshot.channelMembers.general.length,2,'peers without a channel are in general');
 // A signal from another channel cannot open a connection.
 call.handle({type:'rtc_signal',from_peer_id:'b',action:'offer',description:{type:'offer',sdp:'fake'}});
 assert.equal(call.links.has('b'),false);
 await call.join('general');
 assert.equal(captures(),1,'moving channels reuses the microphone');
 assert.deepEqual([...call.links.keys()].sort(),['b','d']);
 assert.equal(events.filter(e=>e.type==='voice_state').at(-1).channel,'general');
 // A peer moving away is disconnected.
 call.handle({type:'voice_state',peer_id:'b',active:true,muted:false,channel:'standup'});
 assert.equal(call.links.has('b'),false);
 call.setChannel('../bad');assert.equal(call.channel,'general');
 call.close();
});

test('switching active voice rooms and toggling mute or deafen emit distinct sound cues',async()=>{
 const cues=[];
 const tracks=[{kind:'audio',enabled:true,stop(){},getSettings(){return {channelCount:1};}}];
 const call=new CanvasVoiceCall({
  send:()=>true,
  media:{getUserMedia:async()=>({getAudioTracks:()=>tracks,getTracks:()=>tracks})},
  Peer:FakePeer,
  audio:()=>({muted:false,volume:1,pause(){},play:async()=>{}}),
  AudioContext:null,
  onCue:cue=>cues.push(cue),
 });
 try{
  call.handle({type:'rtc_peers',self_peer_id:'a',peers:[]});

  // Idle channel selection and idle deafen/mute toggles stay silent.
  call.setChannel('standup');
  call.mute();
  call.deafen();
  call.deafen();
  assert.deepEqual(cues,[]);

  await call.join('standup');
  await call.join('standup'); // clicking the same active channel does not replay switch cue
  await call.join('design');
  call.mute();
  call.mute();
  call.deafen();
  call.deafen();
  call.leave();

  assert.deepEqual(cues,[
   'voice_join',
   'voice_channel_switch',
   'voice_mute',
   'voice_unmute',
   'voice_deafen',
   'voice_undeafen',
   'voice_leave',
  ]);
 }finally{call.close();}
});

test('a rebuilt link can send an offer even when the remote peer was the initial offerer', async () => {
 class OfferPeer extends FakePeer {
  async setLocalDescription() {
   this.localDescription = { type: 'offer', toJSON: () => ({ type: 'offer', sdp: 'test-offer' }) };
  }
 }
 const { call, events } = fixture({ Peer: OfferPeer });
 try {
  call.handle({ type: 'rtc_peers', self_peer_id: 'z', peers: [{ peer_id: 'b', voice_active: true }] });
  await call.join();
  const original = call.links.get('b');
  original.pc.onnegotiationneeded();
  await original.serial;
  assert.equal(events.some(event => event.action === 'offer'), false);

  original.pc.connectionState = 'failed';
  call.repair('b');
  const rebuilt = call.links.get('b');
  assert.notEqual(rebuilt, original);
  rebuilt.pc.onnegotiationneeded();
  await rebuilt.serial;
  assert.equal(events.filter(event => event.action === 'offer').length, 1);
 } finally {
  call.close();
 }
});

test('same-session membership refreshes and participant updates do not restart failed links', async () => {
 const { call, events } = fixture();
 try {
  await call.join();
  const link = call.links.get('b');
  link.pc.connectionState = 'failed';
  const before = events.length;
  call.handle({ type: 'rtc_peers', self_peer_id: 'a', peers: [{ peer_id: 'b', voice_active: true }] });
  call.handle({ type: 'voice_state', peer_id: 'b', active: true, muted: true });
  assert.equal(events.length, before);
  assert.equal(call.links.get('b'), link);
 } finally {
  call.close();
 }
});

test('temporary TURN configuration loss retries and restores the active call',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {call,stream,events}=fixture();
 try{
  await call.join();
  call.handle({type:'rtc_media_config',media_relay:{ice_servers:[]}});
  call.handle({type:'rtc_peers',self_peer_id:'a',peers:[{peer_id:'b',voice_active:true}]});
  assert.equal(call.links.size,0);
  t.mock.timers.tick(15000);
  assert.equal(events.at(-1).type,'rtc_media_config');
  call.handle({type:'rtc_media_config',media_relay:{ice_servers:[{urls:'turns:relay.example',username:'test',credential:'test'}]}});
  assert.equal(call.stream,stream);
  assert.ok(call.links.has('b'));
  assert.equal(call.snapshot.error,'');
 }finally{call.close();}
});
