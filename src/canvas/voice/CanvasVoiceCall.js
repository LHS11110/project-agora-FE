// Only media uses WebRTC. Membership and signaling use the authenticated broker.
export default class CanvasVoiceCall {
 constructor({send,iceServers=[],iceTransportPolicy='relay',media=globalThis.navigator?.mediaDevices,Peer=globalThis.RTCPeerConnection,audio=()=>new Audio(),AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,onCue=null,reconnectTimeout=60000,disconnectDelay=4500,negotiationTimeout=15000,muteRepairDelay=8000,handoffTimeout=12000,leaveCueGrace=3000}){
  Object.assign(this,{send,iceServers,iceTransportPolicy,media,Peer,audio,AudioContext,onCue,reconnectTimeout,disconnectDelay,negotiationTimeout,muteRepairDelay,handoffTimeout,leaveCueGrace});
  this.peers=new Map();this.links=new Map();this.handoffs=new Map();this.pendingLeaveCues=new Map();this.recentDepartures=new Map();this.suppressJoinKeys=new Map();this.volumes=new Map();this.systemVolumes=new Map();this.listeners=new Set();this.outbox=[];
  this.screenAudioVolume=100;this.channel='general';this.self='';this.stream=null;this.screenStream=null;this.screenPending=false;this.watchingScreen=null;this.generation=0;this.muted=false;this.deafened=false;this.pending=false;this.reconnecting=false;this.closed=false;this.error='';
  this.relayTimer=null;this.reconnectTimer=null;this.signalTimer=null;this.audioContext=null;this.audioHealthTimer=null;this.emit();
 }
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 getSnapshot=()=>this.snapshot;
 // Call channels split one canvas into separate calls; peers without one (older clients) are in "general".
 channelOf(peer){return typeof peer?.voice_channel==='string'&&peer.voice_channel?peer.voice_channel:'general';}
 inChannel(peer){return Boolean(peer?.voice_active)&&this.channelOf(peer)===this.channel;}
 volumeKey(peer){return peer?.nickname!=null&&peer?.tag_number!=null?`${peer.nickname}#${peer.tag_number}`:peer?.peer_id;}
 volumeFor(peer){return this.volumes.get(this.volumeKey(peer))??100;}
 hasLiveHandoff(){for(const h of this.handoffs.values())if(this.isTransportConnected(h.link.pc))return true;return false;}
 sameIceServers(a=[],b=[]){return a.length===b.length&&a.every((s,i)=>{const o=b[i],u1=Array.isArray(s?.urls)?s.urls:[s?.urls],u2=Array.isArray(o?.urls)?o.urls:[o?.urls];return s?.username===o?.username&&s?.credential===o?.credential&&u1.length===u2.length&&u1.every((u,idx)=>u===u2[idx]);});}
 emit(){
  const reconnectingView=this.reconnecting&&!this.hasLiveHandoff();
  this.snapshot={ready:Boolean(this.self)&&!this.closed&&this.mediaConfigured!==false,active:Boolean(this.stream),reconnecting:reconnectingView,pending:this.pending,screenAudio:Boolean(this.screenMix),screenAudioVolume:this.screenAudioVolume,screenSharing:Boolean(this.screenStream),screenPending:this.screenPending,watchingScreen:this.watchingScreen,screenVideo:this.links.get(this.watchingScreen)?.screenStream||null,muted:this.muted,deafened:this.deafened,error:this.error,
   channel:this.channel,channelMembers:this.channelMembers(),
   participants:[...this.peers.values()].filter(p=>this.inChannel(p)).map(p=>{const link=this.links.get(p.peer_id),handoffConnected=Boolean(link?.waitingHandoff&&this.isTransportConnected(this.handoffs.get(this.volumeKey(p))?.link.pc));return {...p,volume:this.volumeFor(p),systemVolume:this.systemVolumes.get(this.volumeKey(p))??100,status:reconnectingView?'reconnecting':link?.exhausted?'failed':handoffConnected?'connected':link?.recovering?'reconnecting':link?.pc.connectionState||'connecting'};})};
  this.listeners.forEach(fn=>fn());
 }
 channelMembers(){
  const members={};const add=(channel,member)=>{(members[channel]||=[]).push(member);};
  for(const p of this.peers.values())if(p.voice_active)add(this.channelOf(p),{peer_id:p.peer_id,nickname:p.nickname,tag_number:p.tag_number,muted:Boolean(p.voice_muted),self:false});
  if(this.stream&&this.self)add(this.channel,{peer_id:this.self,self:true,muted:this.muted});
  return members;
 }
 /** Moves to another call channel, keeping the microphone if a call is active. */
 setChannel(channel){
  const next=typeof channel==='string'&&/^[A-Za-z0-9_-]{1,96}$/.test(channel)?channel:'general';
  if(next===this.channel)return;
  for(const id of [...this.links.keys()])this.drop(id);
  this.channel=next;
  if(this.stream){this.announce();for(const peer of this.peers.values())this.connect(peer);}
  this.emit();
 }
 signal(event,link=null){
  if(this.closed||!this.self)return false;
  if(!this.outbox.length&&this.send(event)===true)return true;
  const entry={event,link,expires:Date.now()+this.reconnectTimeout};
  if(event.type==='voice_state'){const index=this.outbox.findIndex(queued=>queued.event.type==='voice_state');if(index>=0){this.outbox[index]=entry;this.flushSoon();return true;}}
  if(this.outbox.length>=256)return false;
  this.outbox.push(entry);this.flushSoon();return true;
 }
 flushSoon(){
  if(this.signalTimer!==null||this.closed)return;
  this.signalTimer=setTimeout(()=>{this.signalTimer=null;
   while(this.outbox.length){
    const entry=this.outbox[0];
    if(entry.expires<Date.now()||entry.link&&this.links.get(entry.event.peer_id)!==entry.link){this.outbox.shift();continue;}
    if(!this.self||this.send(entry.event)!==true)break;
    this.outbox.shift();
   }
   if(this.outbox.length)this.flushSoon();
  },100);
 }
 clearSignals(){clearTimeout(this.signalTimer);this.signalTimer=null;this.outbox=[];}
 announce(){return this.signal({type:'voice_state',active:Boolean(this.stream),muted:this.muted,screen_sharing:Boolean(this.screenStream),channel:this.channel});}
 async join(channel){
  if(channel!==undefined&&!this.stream&&!this.pending)this.setChannel(channel);
  else if(channel!==undefined&&this.stream){this.setChannel(channel);return;}
  if(this.closed||this.stream||this.pending||!this.self||this.mediaConfigured===false)return;
  const generation=++this.generation;this.pending=true;this.error='';this.emit();
  try{
   if(!this.media?.getUserMedia||!this.Peer)throw Error('VOICE_MIC_FAILED');
   if(this.AudioContext&&!this.audioContext){try{this.audioContext=new this.AudioContext();this.audioContext.resume().catch(()=>{});}catch{/* Audio elements remain available as a fallback. */}}
   const stream=await this.media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(generation!==this.generation||this.closed){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.muted=false;this.deafened=false;
   this.onCue?.('voice_join');
   stream.getAudioTracks().forEach(t=>{t.onended=()=>{if(this.stream===stream)this.leave();};});
   this.audioHealthTimer=setInterval(()=>{for(const [id,link] of this.links)this.restorePeerAudio(id,link);},10000);
   this.announce();for(const peer of this.peers.values())this.connect(peer);
  }catch(error){if(generation===this.generation){this.closeAudioContext();this.error=error.name==='NotAllowedError'?'VOICE_MIC_DENIED':'VOICE_MIC_FAILED';}}
  finally{if(generation===this.generation){this.pending=false;this.emit();}}
 }
 async startScreen(){
  if(!this.stream||this.screenPending||this.screenStream||!this.media?.getDisplayMedia)return;
  const generation=this.generation;this.screenPending=true;this.emit();
  try{const screen=await this.media.getDisplayMedia({video:true,audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},systemAudio:'include'});if(generation!==this.generation||!this.stream||this.closed){screen.getTracks().forEach(t=>t.stop());return;}const track=screen.getVideoTracks()[0];if(!track){screen.getTracks().forEach(t=>t.stop());return;}this.screenStream=screen;this.onCue?.('screen_share_start');track.onended=()=>this.stopScreen();for(const link of this.links.values())link.screenSender=link.pc.addTrack(track,screen);this.startScreenAudio(screen);this.announce();}
  catch(error){if(error.name!=='NotAllowedError'&&generation===this.generation)this.error='VOICE_SCREEN_FAILED';}
  finally{if(generation===this.generation){this.screenPending=false;this.emit();}}
 }
 startScreenAudio(screen){
  if(!screen.getAudioTracks?.().length||!this.audioContext?.createMediaStreamDestination)return;
  try{
   const destination=this.audioContext.createMediaStreamDestination();destination.channelCount=this.stream.getAudioTracks()[0]?.getSettings?.().channelCount||1;
   const sound=this.audioContext.createMediaStreamSource(screen),compressor=this.audioContext.createDynamicsCompressor?.();
   const output=compressor||destination,gain=this.audioContext.createGain();gain.gain.value=this.screenAudioVolume/100;sound.connect(gain);gain.connect(output);compressor?.connect(destination);
   const track=destination.stream.getAudioTracks()[0];this.screenMix={destination,sound,gain,compressor,track};
   for(const link of this.links.values())link.screenAudioSender=link.pc.addTrack(track,screen);
   this.audioContext.resume().catch(()=>{});
   for(const audio of screen.getAudioTracks())audio.onended=()=>{if(this.screenStream===screen){this.stopScreenAudio();this.emit();}};
  }catch{this.stopScreenAudio();}
 }
 setScreenAudioVolume(value){
  const number=Number(value);if(!Number.isFinite(number))return;
  this.screenAudioVolume=Math.max(0,Math.min(100,Math.round(number)));
  this.screenMix?.gain.gain.setTargetAtTime(this.screenAudioVolume/100,this.audioContext.currentTime,.015);this.emit();
 }
 replaceVoiceTrack(id,link,track){
  if(!link.voiceSender?.replaceTrack)return;
  Promise.resolve(link.voiceSender.replaceTrack(track)).catch(()=>{if(this.current(id,link)){this.error='VOICE_SCREEN_AUDIO_FAILED';this.emit();}});
 }
 stopScreenAudio(){
  const mix=this.screenMix;if(!mix)return;this.screenMix=null;
  for(const link of this.links.values()){if(link.screenAudioSender){try{link.pc.removeTrack(link.screenAudioSender);}catch{}link.screenAudioSender=null;}}
  mix.sound.disconnect();mix.gain.disconnect();mix.compressor?.disconnect();mix.track.stop();
 }
 watchScreen(id){this.watchingScreen=id;this.emit();}
 stopScreen({silent=false,broadcast=true}={}){const screen=this.screenStream;if(!screen)return;this.screenStream=null;this.stopScreenAudio();for(const link of this.links.values()){if(link.screenSender){try{link.pc.removeTrack(link.screenSender);}catch{}link.screenSender=null;}}screen.getTracks().forEach(t=>{t.onended=null;t.stop();});if(broadcast)this.announce();if(!silent&&this.stream)this.onCue?.('screen_share_stop');this.emit();}
 mute(){if(!this.stream)return;this.muted=!this.muted;this.applyAudioState();this.announce();this.emit();}
 deafen(){this.deafened=!this.deafened;this.applyAudioState();this.emit();}
 applyAudioState(){
  const paused=this.reconnecting&&!this.hasLiveHandoff();
  if(this.screenMix)this.screenMix.track.enabled=!paused;
  this.stream?.getAudioTracks().forEach(t=>t.enabled=!this.muted&&!paused);
  for(const [id,link]of this.links){const peer=this.peers.get(id),vol=this.volumeFor(peer),hold=Boolean(link.waitingHandoff);link.audio.muted=Boolean(link.gain)||this.deafened||paused||hold;link.audio.volume=link.gain?0:vol/100;this.applyGain(link,hold?0:vol);this.applySystemGain(id,link);}
  for(const h of this.handoffs.values()){const vol=this.volumeFor(h.peer);h.link.audio.muted=Boolean(h.link.gain)||this.deafened||paused;h.link.audio.volume=h.link.gain?0:vol/100;this.applyGain(h.link,vol,true);this.applySystemGainForPeer(h.peer,h.link);}
 }
 setPeerVolume(peerId,value){
  const peer=this.peers.get(peerId),number=Number(value);if(!peer||!Number.isFinite(number))return;
  const volume=Math.max(0,Math.min(100,Math.round(number))),key=this.volumeKey(peer);this.volumes.set(key,volume);
  for(const [id,link]of this.links)if(this.volumeKey(this.peers.get(id))===key) {link.audio.volume=link.gain?0:volume/100;if(!link.waitingHandoff)this.applyGain(link,volume);}
  const handoff=this.handoffs.get(key);if(handoff){handoff.link.audio.volume=handoff.link.gain?0:volume/100;this.applyGain(handoff.link,volume,true);}
  this.emit();
 }
 applyGain(link,volume,ignoreReconnecting=false){if(link.gain){const paused=!ignoreReconnecting&&this.reconnecting&&!this.hasLiveHandoff(),value=this.deafened||paused||link.waitingHandoff?0:volume/100;link.gain.gain.setTargetAtTime(value,this.audioContext.currentTime,.01);}}
 setPeerSystemVolume(id,value){
  const peer=this.peers.get(id),number=Number(value);if(!peer||!Number.isFinite(number))return;
  this.systemVolumes.set(this.volumeKey(peer),Math.max(0,Math.min(100,Math.round(number))));
  const link=this.links.get(id);if(link)this.applySystemGain(id,link);this.emit();
 }
 applySystemGain(id,link){this.applySystemGainForPeer(this.peers.get(id),link);}
 applySystemGainForPeer(peer,link){
  const paused=this.reconnecting&&!this.hasLiveHandoff(),volume=this.systemVolumes.get(this.volumeKey(peer))??100,value=this.deafened||paused||link.waitingHandoff?0:volume/100;
  if(link.systemGain){link.systemAudio.muted=true;link.systemAudio.volume=0;link.systemGain.gain.setTargetAtTime(value,this.audioContext.currentTime,.01);}
  else if(link.systemAudio){link.systemAudio.muted=this.deafened||paused||Boolean(link.waitingHandoff);link.systemAudio.volume=value;}
 }
 receiveSystemAudio(id,link,track){
  const stream=new MediaStream([track]);link.systemSource?.disconnect();link.systemGain?.disconnect();
  link.systemAudio ||= this.audio();link.systemAudio.srcObject=stream;link.systemAudio.autoplay=true;
  try{if(this.audioContext){link.systemSource=this.audioContext.createMediaStreamSource(stream);link.systemGain=this.audioContext.createGain();link.systemSource.connect(link.systemGain);link.systemGain.connect(this.audioContext.destination);}}catch{link.systemSource?.disconnect();link.systemGain?.disconnect();link.systemSource=null;link.systemGain=null;}
  this.applySystemGain(id,link);link.systemAudio.play().catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
  track.onunmute=()=>{if(this.current(id,link))link.systemAudio.play().catch(()=>{});};
  track.onended=()=>{link.systemSource?.disconnect();link.systemGain?.disconnect();link.systemAudio.pause();link.systemAudio.srcObject=null;};
 }
 restorePeerAudio(id,link){
  if(!this.current(id,link)||!link.audio.srcObject)return;
  const context=this.audioContext;
  this.applyAudioState();
  if(link.systemAudio?.srcObject&&link.systemAudio.paused)link.systemAudio.play().catch(()=>{});
  if(link.audio.paused)link.audio.play().catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
  if(context&&context.state!=='running')context.resume().then(()=>{if(this.current(id,link)&&context.state==='running'&&this.error==='VOICE_PLAY_BLOCKED'){this.error='';this.emit();}}).catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
 }
 closeAudioContext(){const context=this.audioContext;this.audioContext=null;if(context)context.close().catch(()=>{});}
 closeLink(link){
  if(!link)return;
  clearTimeout(link.timer);clearTimeout(link.repairTimer);clearTimeout(link.muteTimer);if(link.remoteAudioTrack){link.remoteAudioTrack.onmute=null;link.remoteAudioTrack.onunmute=null;}
  for(const event of ['onicecandidate','ontrack','onconnectionstatechange','oniceconnectionstatechange','onnegotiationneeded','onsignalingstatechange'])link.pc[event]=null;
  link.systemSource?.disconnect();link.systemGain?.disconnect();if(link.systemAudio){link.systemAudio.pause();link.systemAudio.srcObject=null;}
  link.pc.close();link.audio.pause();link.audio.srcObject=null;link.source?.disconnect();link.gain?.disconnect();
 }
 clearHandoff(key){
  const entry=this.handoffs.get(key);if(!entry)return;
  this.handoffs.delete(key);clearTimeout(entry.timer);this.closeLink(entry.link);
 }
 clearAllHandoffs(){for(const key of [...this.handoffs.keys()])this.clearHandoff(key);}
 clearCueState(){
  for(const entry of this.pendingLeaveCues.values())clearTimeout(entry.timer);
  this.pendingLeaveCues.clear();this.recentDepartures.clear();this.suppressJoinKeys.clear();
 }
 retireLink(peer,link){
  const key=peer?this.volumeKey(peer):null;
  if(!key||!link||!this.isTransportConnected(link.pc))return false;
  this.clearHandoff(key);clearTimeout(link.timer);clearTimeout(link.repairTimer);clearTimeout(link.muteTimer);link.timer=null;link.repairTimer=null;link.muteTimer=null;
  const cleanup=()=>{if(this.handoffs.get(key)?.link===link){this.clearHandoff(key);this.applyAudioState();this.emit();}};
  link.pc.onnegotiationneeded=null;link.pc.onicecandidate=null;
  link.pc.onconnectionstatechange=()=>{if(link.pc.connectionState==='failed'||link.pc.connectionState==='closed')cleanup();};
  link.pc.oniceconnectionstatechange=()=>{if(link.pc.iceConnectionState==='failed'||link.pc.iceConnectionState==='closed')cleanup();};
  const timer=setTimeout(cleanup,this.handoffTimeout);
  this.handoffs.set(key,{key,peer,link,timer,createdAt:Date.now()});
  return true;
 }
 retireConnectedLinks(){
  for(const [id,link]of [...this.links]){
   const peer=this.peers.get(id);
   if(this.retireLink(peer,link))this.links.delete(id);
   else this.drop(id);
  }
 }
 drop(id){
  const link=this.links.get(id);if(!link)return;this.links.delete(id);this.closeLink(link);
 }
 leave({silent=false}={}){
  const wasActive=Boolean(this.stream);
  clearInterval(this.audioHealthTimer);this.audioHealthTimer=null;this.stopScreen({silent:true,broadcast:false});this.watchingScreen=null;this.screenPending=false;++this.generation;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.pending=false;this.reconnecting=false;
  const stream=this.stream;this.stream=null;stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});
  for(const id of this.links.keys())this.drop(id);this.clearAllHandoffs();this.clearCueState();this.muted=false;this.deafened=false;this.closeAudioContext();this.clearSignals();this.announce();
  if(wasActive&&!silent)this.onCue?.('voice_leave');
  this.emit();
 }
 // A recoverable broker outage pauses media until authenticated membership returns.
 reconnect({seamless=false}={}){
  if(this.closed)return;
  this.self='';this.clearSignals();
  if(seamless&&this.stream){this.retireConnectedLinks();}else{for(const id of this.links.keys())this.drop(id);this.clearAllHandoffs();}
  if(this.pending){++this.generation;this.pending=false;if(!this.stream)this.closeAudioContext();}
  this.reconnecting=Boolean(this.stream)&&(!seamless||!this.hasLiveHandoff());this.applyAudioState();
  if(this.stream&&this.reconnectTimer===null)this.reconnectTimer=setTimeout(()=>{this.leave();this.error='VOICE_RECONNECT_TIMEOUT';this.emit();},this.reconnectTimeout);
  this.emit();
 }
 // Revocation, navigation and explicit disconnects must end capture immediately.
 suspend(){this.self='';this.leave();this.peers.clear();this.emit();}
 resume(){this.closed=false;}
 close(){clearTimeout(this.relayTimer);this.relayTimer=null;this.leave({silent:true});this.closed=true;this.self='';this.peers.clear();this.clearSignals();this.emit();this.listeners.clear();}
 current(id,link){return !this.closed&&Boolean(this.self)&&this.links.get(id)===link;}
 enqueue(id,link,operation){
  link.serial=link.serial.then(async()=>{if(this.current(id,link))await operation();}).catch(()=>{if(this.current(id,link))this.scheduleRepair(id,link,300);});
 }
 isTransportConnected(pc){
  return Boolean(pc)&&pc.connectionState==='connected'&&(pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed');
 }
 rebuildLink(id){
  const peer=this.peers.get(id);this.drop(id);
  if(!peer?.voice_active||!this.self||!this.stream||this.closed)return false;
  this.connect(peer);const rebuilt=this.links.get(id);if(rebuilt){rebuilt.recovering=true;this.emit();}
  return Boolean(rebuilt);
 }
 armTimeout(id,link){
  clearTimeout(link.timer);link.timer=setTimeout(()=>{if(this.current(id,link)&&(link.recovering||!this.isTransportConnected(link.pc)))this.repair(id);},this.negotiationTimeout);
 }
 scheduleRepair(id,link,delay=this.disconnectDelay){
  if(!this.current(id,link)||link.repairTimer!==null)return;
  link.recovering=true;link.repairTimer=setTimeout(()=>{link.repairTimer=null;if(this.current(id,link))this.repair(id);},delay);this.emit();
 }
 repair(id,reset=false){
  const link=this.links.get(id);if(!link||!this.current(id,link)||!this.stream)return;
  if(reset){link.retries=0;link.exhausted=false;}
  const nextRetries=link.retries+1;
  if(nextRetries>4){link.recovering=false;link.exhausted=true;this.error='VOICE_CONNECTION_FAILED';clearTimeout(link.repairTimer);link.repairTimer=setTimeout(()=>{link.repairTimer=null;if(this.current(id,link))this.repair(id,true);},15000);this.emit();return;}
  this.announce();clearTimeout(link.repairTimer);link.repairTimer=null;
  if(link.pc.connectionState==='failed'||link.pc.iceConnectionState==='failed'||link.pc.connectionState==='closed'||nextRetries>=3){
   if(this.rebuildLink(id)){const rebuilt=this.links.get(id);if(rebuilt)rebuilt.retries=nextRetries;}
   this.emit();return;
  }
  link.retries=nextRetries;link.recovering=true;
  try{link.pc.restartIce();this.armTimeout(id,link);}catch{if(this.rebuildLink(id)){const rebuilt=this.links.get(id);if(rebuilt)rebuilt.retries=nextRetries;}else this.error='VOICE_CONNECTION_FAILED';}
  this.emit();
 }
 retry(){
  if(!this.self||!this.stream)return;this.error='';this.announce();
  for(const peer of this.peers.values())if(peer.voice_active){this.connect(peer);const link=this.links.get(peer.peer_id);if(link&&!this.isTransportConnected(link.pc))this.repair(peer.peer_id,true);}
  this.emit();
 }
 connect(peer){
  if(this.closed||!this.self||!this.stream||!this.inChannel(peer)||peer.peer_id===this.self||this.links.has(peer.peer_id))return;
  let pc;try{pc=new this.Peer({iceServers:this.iceServers,iceTransportPolicy:this.iceTransportPolicy,bundlePolicy:'max-bundle',rtcpMuxPolicy:'require'});}catch{this.error='VOICE_CONNECTION_FAILED';this.emit();return;}
  const audio=this.audio();audio.autoplay=true;audio.muted=this.deafened;audio.volume=this.volumeFor(peer)/100;
  const key=this.volumeKey(peer),waitingHandoff=this.handoffs.has(key);
  const id=peer.peer_id,link={pc,audio,candidates:[],serial:Promise.resolve(),timer:null,repairTimer:null,muteTimer:null,retries:0,exhausted:false,recovering:false,offering:false,ignoreOffer:false,waitingHandoff};this.links.set(id,link);
  pc.onicecandidate=event=>{if(event.candidate&&this.current(id,link))this.signal({type:'rtc_signal',peer_id:id,action:'candidate',candidate:event.candidate.toJSON()},link);};
  pc.ontrack=event=>{
   if(!this.current(id,link))return;
   const remoteStream=event.streams[0]||new MediaStream([event.track]);
   if(event.track?.kind==='video'){this.restorePeerAudio(id,link);link.screenStream=remoteStream;event.track.onended=()=>{if(this.current(id,link)){link.screenStream=null;this.emit();}};this.emit();return;}
   const videoStreams=(pc.remoteDescription?.sdp||'').split(/\r?\nm=/).filter(section=>section.startsWith('video ')).flatMap(section=>[...section.matchAll(/a=msid:([^ ]+)/g)].map(match=>match[1]));
   if(remoteStream.getVideoTracks?.().length || (remoteStream.id&&videoStreams.includes(remoteStream.id))){this.receiveSystemAudio(id,link,event.track);return;}
   if(link.remoteAudioTrack&&link.remoteAudioTrack!==event.track){link.remoteAudioTrack.onmute=null;link.remoteAudioTrack.onunmute=null;clearTimeout(link.muteTimer);}
   if(event.track){
    link.remoteAudioTrack=event.track;
    event.track.onmute=()=>{
     clearTimeout(link.muteTimer);
     // Remote mic mute or DTX silence triggers track.onmute while ICE remains healthy; only repair if transport is actually degraded.
     link.muteTimer=setTimeout(()=>{
      link.muteTimer=null;
      if(!this.current(id,link)||this.reconnecting)return;
      if(this.peers.get(id)?.voice_muted)return;
      if(this.isTransportConnected(link.pc))return;
      this.repair(id);
     },this.muteRepairDelay);
    };
    event.track.onunmute=()=>{clearTimeout(link.muteTimer);link.muteTimer=null;this.restorePeerAudio(id,link);};
   }
   audio.srcObject=remoteStream;
   if(this.audioContext){
    try{
     // Start the media-element playout consumer as well: some browsers receive RTP
     // without decoding it when a remote stream is connected only to Web Audio.
     // Keep this element silent; the gain graph remains the sole audible output.
     audio.muted=true;audio.volume=0;
     audio.play().catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
     link.source?.disconnect();link.gain?.disconnect();link.source=this.audioContext.createMediaStreamSource(remoteStream);link.gain=this.audioContext.createGain();
     link.gain.gain.value=(this.deafened||link.waitingHandoff)?0:this.volumeFor(peer)/100;link.source.connect(link.gain);link.gain.connect(this.audioContext.destination);
     const context=this.audioContext;if(context.state!=='running'){this.error='VOICE_PLAY_BLOCKED';this.emit();}
     context.resume().then(()=>{if(this.current(id,link)&&context.state==='running'&&this.error==='VOICE_PLAY_BLOCKED'){this.error='';this.emit();}}).catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});return;
    }catch{link.source?.disconnect();link.gain?.disconnect();link.source=null;link.gain=null;}
   }
   audio.muted=this.deafened||this.reconnecting||Boolean(link.waitingHandoff);audio.volume=this.volumeFor(peer)/100;audio.play().catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
  };
  const changed=()=>{
   if(!this.current(id,link))return;
   const connected=this.isTransportConnected(pc);
   if(connected){
    clearTimeout(link.timer);clearTimeout(link.repairTimer);clearTimeout(link.muteTimer);
    link.timer=null;link.repairTimer=null;link.muteTimer=null;
    link.recovering=false;link.retries=0;link.exhausted=false;
    if(link.waitingHandoff){link.waitingHandoff=false;this.clearHandoff(this.volumeKey(this.peers.get(id)));}
    if(this.error==='VOICE_CONNECTION_FAILED'&&[...this.links.values()].every(other=>this.isTransportConnected(other.pc)))this.error='';
    this.restorePeerAudio(id,link);
   }
   else if(pc.connectionState==='failed'||pc.iceConnectionState==='failed'||pc.connectionState==='closed')this.scheduleRepair(id,link,300);
   else if(pc.connectionState==='disconnected'||pc.iceConnectionState==='disconnected')this.scheduleRepair(id,link);
   this.emit();
  };
  pc.onconnectionstatechange=()=>{changed();if(pc.connectionState==='connected')this.restorePeerAudio(id,link);};pc.oniceconnectionstatechange=changed;
  const negotiate=()=>this.enqueue(id,link,async()=>{
   if(!link.needsNegotiation||pc.signalingState!=='stable')return;
   // Elect one initial offerer. Slow TURN gathering plus simultaneous initial
   // offers can leave Chromium's rolled-back gatherer without relay candidates.
   if(!pc.localDescription&&!pc.remoteDescription&&this.self>id)return;
   link.needsNegotiation=false;
   try{link.offering=true;await pc.setLocalDescription();if(this.current(id,link))this.signal({type:'rtc_signal',peer_id:id,action:pc.localDescription.type,description:pc.localDescription.toJSON()},link);}
   catch(error){link.needsNegotiation=true;throw error;}
   finally{link.offering=false;}
  });
  pc.onsignalingstatechange=()=>{if(pc.signalingState==='stable'){this.restorePeerAudio(id,link);if(link.needsNegotiation)negotiate();}};
  // Keep a pending negotiation until a simultaneous offer has settled.
  pc.onnegotiationneeded=()=>{link.needsNegotiation=true;negotiate();};
  for(const track of this.stream.getAudioTracks())link.voiceSender=pc.addTrack(track,this.stream);
  if(this.screenStream)for(const track of this.screenStream.getVideoTracks())link.screenSender=pc.addTrack(track,this.screenStream);
  if(this.screenMix&&this.screenStream)link.screenAudioSender=pc.addTrack(this.screenMix.track,this.screenStream);
  this.armTimeout(id,link);this.emit();
 }
 candidateMatches(candidate,description){return Boolean(description)&&(!candidate.usernameFragment||description.sdp.split(/\r?\n/).includes(`a=ice-ufrag:${candidate.usernameFragment}`));}
 receiveSignal(event){
  const peer=this.peers.get(event.from_peer_id);if(!this.stream||!this.self||!this.inChannel(peer))return;
  this.connect(peer);const id=peer.peer_id,link=this.links.get(id);if(!link)return;
  this.enqueue(id,link,async()=>{
   const pc=link.pc;
   if(event.action==='candidate'){
    const candidate=event.candidate;if(typeof candidate?.candidate!=='string'||link.ignoreOffer)return;
    if(this.candidateMatches(candidate,pc.remoteDescription)){try{await pc.addIceCandidate(candidate);}catch{/* Ignore stale candidates from the previous ICE generation. */}}
    else{link.candidates.push(candidate);if(link.candidates.length>256)link.candidates.shift();}return;
   }
   if(!['offer','answer'].includes(event.action)||event.description?.type!==event.action||typeof event.description.sdp!=='string')return;
   const collision=event.action==='offer'&&(link.offering||pc.signalingState!=='stable');
   link.ignoreOffer=this.self<id&&collision;if(link.ignoreOffer)return;
   if(event.action==='answer'&&pc.signalingState!=='have-local-offer')return;
   if(event.action==='answer')link.ignoreOffer=false;
   await pc.setRemoteDescription(event.description); // The polite endpoint implicitly rolls back colliding offers.
   const pending=link.candidates;link.candidates=[];
   for(const candidate of pending)if(this.candidateMatches(candidate,pc.remoteDescription)){try{await pc.addIceCandidate(candidate);}catch{/* Old ICE candidates are harmless after rollback. */}}else link.candidates.push(candidate);
   if(event.action==='offer'){link.needsNegotiation=false;await pc.setLocalDescription();if(this.current(id,link))this.signal({type:'rtc_signal',peer_id:id,action:'answer',description:pc.localDescription.toJSON()},link);}
  });
 }
 applyRelay(config){
  if(!config)return;
  const servers=Array.isArray(config.ice_servers)?config.ice_servers:[];
  const valid=servers.length>0&&servers.every(server=>typeof server.username==='string'&&typeof server.credential==='string'&&(Array.isArray(server.urls)?server.urls:[server.urls]).every(url=>typeof url==='string'&&url.startsWith('turns:')));
  const unchanged=valid&&this.mediaConfigured===true&&this.sameIceServers(this.iceServers,servers);
  this.mediaConfigured=valid;this.iceTransportPolicy='relay';this.iceServers=valid?servers:[];
  clearTimeout(this.relayTimer);this.relayTimer=null;
  if(!valid){for(const id of this.links.keys())this.drop(id);this.clearAllHandoffs();this.error='VOICE_RELAY_UNAVAILABLE';this.emit();return;}
  if(this.error==='VOICE_RELAY_UNAVAILABLE')this.error='';
  if(!unchanged){for(const [id,link] of this.links){try{link.pc.setConfiguration({...link.pc.getConfiguration(),iceServers:servers,iceTransportPolicy:'relay'});link.pc.restartIce();}catch{this.repair(id,true);}}}
  const remaining=Number(config.expires_at)*1000-Date.now()-300000;
  this.relayTimer=setTimeout(()=>{this.relayTimer=null;if(!this.closed)this.signal({type:'rtc_media_config'});},Math.max(60000,Math.min(43200000,Number.isFinite(remaining)?remaining:43200000)));
  this.emit();
 }
 notePeerReturning(peer){
  const key=peer?this.volumeKey(peer):null;
  if(!key)return;
  const pendingLeave=this.pendingLeaveCues.get(key);
  if(pendingLeave){clearTimeout(pendingLeave.timer);this.pendingLeaveCues.delete(key);this.suppressJoinKeys.set(key,Date.now()+this.leaveCueGrace);}
  else if(this.handoffs.has(key)){this.suppressJoinKeys.set(key,Date.now()+this.leaveCueGrace);}
 }
 handle(event){
  if(this.closed)return;
  if(event.type==='rtc_peers'){
   if(typeof event.self_peer_id!=='string'||!event.self_peer_id)return;
   if(this.self!==event.self_peer_id)this.retireConnectedLinks();
   this.applyRelay(event.media_relay);
   this.self=event.self_peer_id;this.peers=new Map((Array.isArray(event.peers)?event.peers:[]).map(p=>[p.peer_id,p]));
   clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.reconnecting=false;this.applyAudioState();
   for(const id of [...this.links.keys()])if(!this.inChannel(this.peers.get(id)))this.drop(id);
   for(const p of this.peers.values())if(p.voice_active)this.notePeerReturning(p);
   this.announce();for(const p of this.peers.values())this.connect(p);this.emit();
  }else if(event.type==='rtc_media_config'){this.applyRelay(event.media_relay);}
  else if(event.type==='rtc_peer_joined'){this.peers.set(event.peer.peer_id,event.peer);if(event.peer.voice_active)this.notePeerReturning(event.peer);this.connect(event.peer);this.emit();}
  else if(event.type==='rtc_peer_left'){
   const leftPeer=this.peers.get(event.peer_id),leftLink=this.links.get(event.peer_id),leftKey=leftPeer?this.volumeKey(leftPeer):null;
   if(leftPeer?.voice_active&&leftLink&&leftKey&&this.retireLink(leftPeer,leftLink)){
    this.links.delete(event.peer_id);
    this.recentDepartures.set(event.peer_id,{key:leftKey,expires:Date.now()+5000});
   }else{
    this.drop(event.peer_id);
   }
   this.peers.delete(event.peer_id);if(this.watchingScreen===event.peer_id)this.watchingScreen=null;this.emit();
  }
  else if(event.type==='voice_state'){
   const peer=this.peers.get(event.peer_id);if(!peer)return;Object.assign(peer,{voice_active:event.active,voice_muted:event.muted,screen_sharing:event.active&&event.screen_sharing===true,voice_channel:typeof event.channel==='string'&&event.channel?event.channel:'general'});
   if(event.active&&this.inChannel(peer)){this.notePeerReturning(peer);this.connect(peer);const existing=this.links.get(event.peer_id);if(existing&&(existing.exhausted||existing.pc.connectionState==='failed'||existing.pc.iceConnectionState==='failed'||existing.pc.connectionState==='closed'))this.repair(event.peer_id,true);}
   else{this.drop(event.peer_id);this.clearHandoff(this.volumeKey(peer));}
   if(!event.screen_sharing&&this.watchingScreen===event.peer_id)this.watchingScreen=null;this.emit();
  }else if(event.type==='voice_notice'){
   const cue=event.event||event.cue;
   if(!this.stream||this.reconnecting||event.peer_id===this.self)return;
   if(cue==='voice_leave'){
    const dep=this.recentDepartures.get(event.peer_id);
    if(dep&&dep.expires>Date.now()){
     this.recentDepartures.delete(event.peer_id);
     const existing=this.pendingLeaveCues.get(dep.key);if(existing)clearTimeout(existing.timer);
     const timer=setTimeout(()=>{this.pendingLeaveCues.delete(dep.key);if(!this.closed&&this.stream)this.onCue?.('voice_leave');},this.leaveCueGrace);
     this.pendingLeaveCues.set(dep.key,{timer});return;
    }
   }else if(cue==='voice_join'){
    const key=this.volumeKey(this.peers.get(event.peer_id));
    if(key&&(this.suppressJoinKeys.get(key)||0)>Date.now()){this.suppressJoinKeys.delete(key);return;}
   }
   if(['voice_join','voice_leave','screen_share_start','screen_share_stop'].includes(cue))this.onCue?.(cue);
  }else if(event.type==='rtc_signal')this.receiveSignal(event);
 }
 async resumeAudio(){
  const generation=this.generation,tasks=[];this.applyAudioState();if(this.audioContext)tasks.push(this.audioContext.resume());for(const link of this.links.values())if(link.audio.srcObject)tasks.push(link.audio.play());
  const results=await Promise.allSettled(tasks);if(this.closed||generation!==this.generation)return;this.error=results.some(result=>result.status==='rejected')?'VOICE_PLAY_BLOCKED':'';this.emit();
 }
}
