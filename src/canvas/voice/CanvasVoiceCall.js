// Only media uses WebRTC. Membership and signaling use the authenticated broker.
export default class CanvasVoiceCall {
 constructor({send,iceServers=[{urls:'stun:stun.l.google.com:19302'}],media=globalThis.navigator?.mediaDevices,Peer=globalThis.RTCPeerConnection,audio=()=>new Audio(),AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,reconnectTimeout=60000,disconnectDelay=2000,negotiationTimeout=15000}){
  Object.assign(this,{send,iceServers,media,Peer,audio,AudioContext,reconnectTimeout,disconnectDelay,negotiationTimeout});
  this.peers=new Map();this.links=new Map();this.volumes=new Map();this.listeners=new Set();this.outbox=[];
  this.self='';this.stream=null;this.screenStream=null;this.screenPending=false;this.watchingScreen=null;this.generation=0;this.muted=false;this.deafened=false;this.pending=false;this.reconnecting=false;this.closed=false;this.error='';
  this.reconnectTimer=null;this.signalTimer=null;this.audioContext=null;this.emit();
 }
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 getSnapshot=()=>this.snapshot;
 volumeKey(peer){return peer?.nickname!=null&&peer?.tag_number!=null?`${peer.nickname}#${peer.tag_number}`:peer?.peer_id;}
 volumeFor(peer){return this.volumes.get(this.volumeKey(peer))??100;}
 emit(){
  this.snapshot={ready:Boolean(this.self)&&!this.closed,active:Boolean(this.stream),reconnecting:this.reconnecting,pending:this.pending,screenSharing:Boolean(this.screenStream),screenPending:this.screenPending,watchingScreen:this.watchingScreen,screenVideo:this.links.get(this.watchingScreen)?.screenStream||null,muted:this.muted,deafened:this.deafened,error:this.error,
   participants:[...this.peers.values()].filter(p=>p.voice_active).map(p=>{const link=this.links.get(p.peer_id);return {...p,volume:this.volumeFor(p),status:this.reconnecting?'reconnecting':link?.exhausted?'failed':link?.recovering?'reconnecting':link?.pc.connectionState||'connecting'};})};
  this.listeners.forEach(fn=>fn());
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
 announce(){return this.signal({type:'voice_state',active:Boolean(this.stream),muted:this.muted,screen_sharing:Boolean(this.screenStream)});}
 async join(){
  if(this.closed||this.stream||this.pending||!this.self)return;
  const generation=++this.generation;this.pending=true;this.error='';this.emit();
  try{
   if(!this.media?.getUserMedia||!this.Peer)throw Error('VOICE_MIC_FAILED');
   if(this.AudioContext&&!this.audioContext){try{this.audioContext=new this.AudioContext();this.audioContext.resume().catch(()=>{});}catch{/* Audio elements remain available as a fallback. */}}
   const stream=await this.media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(generation!==this.generation||this.closed){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.muted=false;this.deafened=false;
   stream.getAudioTracks().forEach(t=>{t.onended=()=>{if(this.stream===stream)this.leave();};});
   this.announce();for(const peer of this.peers.values())this.connect(peer);
  }catch(error){if(generation===this.generation){this.closeAudioContext();this.error=error.name==='NotAllowedError'?'VOICE_MIC_DENIED':'VOICE_MIC_FAILED';}}
  finally{if(generation===this.generation){this.pending=false;this.emit();}}
 }
 async startScreen(){
  if(!this.stream||this.screenPending||this.screenStream||!this.media?.getDisplayMedia)return;
  const generation=this.generation;this.screenPending=true;this.emit();
  try{const screen=await this.media.getDisplayMedia({video:true,audio:false});if(generation!==this.generation||!this.stream||this.closed){screen.getTracks().forEach(t=>t.stop());return;}const track=screen.getVideoTracks()[0];if(!track){screen.getTracks().forEach(t=>t.stop());return;}this.screenStream=screen;track.onended=()=>this.stopScreen();for(const link of this.links.values())link.screenSender=link.pc.addTrack(track,screen);this.announce();}
  catch(error){if(error.name!=='NotAllowedError'&&generation===this.generation)this.error='VOICE_SCREEN_FAILED';}
  finally{if(generation===this.generation){this.screenPending=false;this.emit();}}
 }
 watchScreen(id){this.watchingScreen=id;this.emit();}
 stopScreen(){const screen=this.screenStream;if(!screen)return;this.screenStream=null;for(const link of this.links.values()){if(link.screenSender){try{link.pc.removeTrack(link.screenSender);}catch{}link.screenSender=null;}}screen.getTracks().forEach(t=>{t.onended=null;t.stop();});this.announce();this.emit();}
 mute(){if(!this.stream)return;this.muted=!this.muted;this.applyAudioState();this.announce();this.emit();}
 deafen(){this.deafened=!this.deafened;this.applyAudioState();this.emit();}
 applyAudioState(){
  this.stream?.getAudioTracks().forEach(t=>t.enabled=!this.muted&&!this.reconnecting);
  for(const [id,link]of this.links){link.audio.muted=Boolean(link.gain)||this.deafened||this.reconnecting;link.audio.volume=link.gain?0:this.volumeFor(this.peers.get(id))/100;this.applyGain(link,this.volumeFor(this.peers.get(id)));}
 }
 setPeerVolume(peerId,value){
  const peer=this.peers.get(peerId),number=Number(value);if(!peer||!Number.isFinite(number))return;
  const volume=Math.max(0,Math.min(100,Math.round(number))),key=this.volumeKey(peer);this.volumes.set(key,volume);
  for(const [id,link]of this.links)if(this.volumeKey(this.peers.get(id))===key) {link.audio.volume=link.gain?0:volume/100;this.applyGain(link,volume);}
  this.emit();
 }
 applyGain(link,volume){if(link.gain){const value=this.deafened||this.reconnecting?0:volume/100;link.gain.gain.setTargetAtTime(value,this.audioContext.currentTime,.01);}}
 restorePeerAudio(id,link){
  if(!this.current(id,link)||!link.audio.srcObject)return;
  const context=this.audioContext;
  this.applyAudioState();
  if(link.audio.paused)link.audio.play().catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
  if(context&&context.state!=='running')context.resume().then(()=>{if(this.current(id,link)&&context.state==='running'&&this.error==='VOICE_PLAY_BLOCKED'){this.error='';this.emit();}}).catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
 }
 closeAudioContext(){const context=this.audioContext;this.audioContext=null;if(context)context.close().catch(()=>{});}
 drop(id){
  const link=this.links.get(id);if(!link)return;this.links.delete(id);clearTimeout(link.timer);clearTimeout(link.repairTimer);
  for(const event of ['onicecandidate','ontrack','onconnectionstatechange','oniceconnectionstatechange','onnegotiationneeded','onsignalingstatechange'])link.pc[event]=null;
  link.pc.close();link.audio.pause();link.audio.srcObject=null;link.source?.disconnect();link.gain?.disconnect();
 }
 leave(){
  this.stopScreen();this.watchingScreen=null;this.screenPending=false;++this.generation;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.pending=false;this.reconnecting=false;
  const stream=this.stream;this.stream=null;stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});
  for(const id of this.links.keys())this.drop(id);this.muted=false;this.deafened=false;this.closeAudioContext();this.clearSignals();this.announce();this.emit();
 }
 // A recoverable broker outage pauses media until authenticated membership returns.
 reconnect(){
  if(this.closed)return;
  this.self='';this.clearSignals();for(const id of this.links.keys())this.drop(id);
  if(this.pending){++this.generation;this.pending=false;if(!this.stream)this.closeAudioContext();}
  this.reconnecting=Boolean(this.stream);this.applyAudioState();
  if(this.stream&&this.reconnectTimer===null)this.reconnectTimer=setTimeout(()=>{this.leave();this.error='VOICE_RECONNECT_TIMEOUT';this.emit();},this.reconnectTimeout);
  this.emit();
 }
 // Revocation, navigation and explicit disconnects must end capture immediately.
 suspend(){this.self='';this.leave();this.peers.clear();this.emit();}
 resume(){this.closed=false;}
 close(){this.leave();this.closed=true;this.self='';this.peers.clear();this.clearSignals();this.emit();this.listeners.clear();}
 current(id,link){return !this.closed&&Boolean(this.self)&&this.links.get(id)===link;}
 enqueue(id,link,operation){
  link.serial=link.serial.then(async()=>{if(this.current(id,link))await operation();}).catch(()=>{if(this.current(id,link))this.scheduleRepair(id,link,300);});
 }
 armTimeout(id,link){
  clearTimeout(link.timer);link.timer=setTimeout(()=>{if(this.current(id,link)&&(link.recovering||link.pc.connectionState!=='connected'))this.repair(id);},this.negotiationTimeout);
 }
 scheduleRepair(id,link,delay=this.disconnectDelay){
  if(!this.current(id,link)||link.repairTimer!==null)return;
  link.recovering=true;link.repairTimer=setTimeout(()=>{link.repairTimer=null;if(this.current(id,link))this.repair(id);},delay);this.emit();
 }
 repair(id,reset=false){
  const link=this.links.get(id);if(!link||!this.current(id,link)||!this.stream)return;
  if(reset){link.retries=0;link.exhausted=false;}
  if(link.retries>=3){link.recovering=false;link.exhausted=true;this.error='VOICE_CONNECTION_FAILED';this.emit();return;}
  this.announce();link.retries++;link.recovering=true;clearTimeout(link.repairTimer);link.repairTimer=null;
  try{link.pc.restartIce();this.armTimeout(id,link);}catch{this.error='VOICE_CONNECTION_FAILED';}
  this.emit();
 }
 retry(){
  if(!this.self||!this.stream)return;this.error='';this.announce();
  for(const peer of this.peers.values())if(peer.voice_active){this.connect(peer);const link=this.links.get(peer.peer_id);if(link?.pc.connectionState!=='connected')this.repair(peer.peer_id,true);}
  this.emit();
 }
 connect(peer){
  if(this.closed||!this.self||!this.stream||!peer.voice_active||peer.peer_id===this.self||this.links.has(peer.peer_id))return;
  let pc;try{pc=new this.Peer({iceServers:this.iceServers});}catch{this.error='VOICE_CONNECTION_FAILED';this.emit();return;}
  const audio=this.audio();audio.autoplay=true;audio.muted=this.deafened;audio.volume=this.volumeFor(peer)/100;
  const id=peer.peer_id,link={pc,audio,candidates:[],serial:Promise.resolve(),timer:null,repairTimer:null,retries:0,exhausted:false,recovering:false,offering:false,ignoreOffer:false};this.links.set(id,link);
  pc.onicecandidate=event=>{if(event.candidate&&this.current(id,link))this.signal({type:'rtc_signal',peer_id:id,action:'candidate',candidate:event.candidate.toJSON()},link);};
  pc.ontrack=event=>{
   if(!this.current(id,link))return;
   const remoteStream=event.streams[0]||new MediaStream([event.track]);
   if(event.track?.kind==='video'){this.restorePeerAudio(id,link);link.screenStream=remoteStream;event.track.onended=()=>{if(this.current(id,link)){link.screenStream=null;this.emit();}};this.emit();return;}
   audio.srcObject=remoteStream;
   if(this.audioContext){
    try{
     // Start the media-element playout consumer as well: some browsers receive RTP
     // without decoding it when a remote stream is connected only to Web Audio.
     // Keep this element silent; the gain graph remains the sole audible output.
     audio.muted=true;audio.volume=0;
     audio.play().catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
     link.source?.disconnect();link.gain?.disconnect();link.source=this.audioContext.createMediaStreamSource(remoteStream);link.gain=this.audioContext.createGain();
     link.gain.gain.value=this.deafened?0:this.volumeFor(peer)/100;link.source.connect(link.gain);link.gain.connect(this.audioContext.destination);
     const context=this.audioContext;if(context.state!=='running'){this.error='VOICE_PLAY_BLOCKED';this.emit();}
     context.resume().then(()=>{if(this.current(id,link)&&context.state==='running'&&this.error==='VOICE_PLAY_BLOCKED'){this.error='';this.emit();}}).catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});return;
    }catch{link.source?.disconnect();link.gain?.disconnect();link.source=null;link.gain=null;}
   }
   audio.muted=this.deafened||this.reconnecting;audio.volume=this.volumeFor(peer)/100;audio.play().catch(()=>{if(this.current(id,link)){this.error='VOICE_PLAY_BLOCKED';this.emit();}});
  };
  const changed=()=>{
   if(!this.current(id,link))return;
   const connected=pc.connectionState==='connected'&&(pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed');
   if(connected){clearTimeout(link.timer);clearTimeout(link.repairTimer);link.repairTimer=null;link.recovering=false;link.retries=0;link.exhausted=false;if(this.error==='VOICE_CONNECTION_FAILED'&&[...this.links.values()].every(other=>other.pc.connectionState==='connected'))this.error='';}
   else if(pc.connectionState==='failed'||pc.iceConnectionState==='failed')this.scheduleRepair(id,link,300);
   else if(pc.connectionState==='disconnected'||pc.iceConnectionState==='disconnected')this.scheduleRepair(id,link);
   this.emit();
  };
  pc.onconnectionstatechange=()=>{changed();if(pc.connectionState==='connected')this.restorePeerAudio(id,link);};pc.oniceconnectionstatechange=changed;
  pc.onsignalingstatechange=()=>{if(pc.signalingState==='stable')this.restorePeerAudio(id,link);};
  // Perfect negotiation lets either endpoint restart ICE and resolves offer glare.
  pc.onnegotiationneeded=()=>this.enqueue(id,link,async()=>{
   if(pc.signalingState!=='stable')return;
   try{link.offering=true;await pc.setLocalDescription();if(this.current(id,link))this.signal({type:'rtc_signal',peer_id:id,action:pc.localDescription.type,description:pc.localDescription.toJSON()},link);}
   finally{link.offering=false;}
  });
  for(const track of this.stream.getAudioTracks())pc.addTrack(track,this.stream);
  if(this.screenStream)for(const track of this.screenStream.getVideoTracks())link.screenSender=pc.addTrack(track,this.screenStream);
  this.armTimeout(id,link);this.emit();
 }
 candidateMatches(candidate,description){return Boolean(description)&&(!candidate.usernameFragment||description.sdp.split(/\r?\n/).includes(`a=ice-ufrag:${candidate.usernameFragment}`));}
 receiveSignal(event){
  const peer=this.peers.get(event.from_peer_id);if(!this.stream||!this.self||!peer?.voice_active)return;
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
   await pc.setRemoteDescription(event.description); // The polite endpoint implicitly rolls back colliding offers.
   const pending=link.candidates;link.candidates=[];
   for(const candidate of pending)if(this.candidateMatches(candidate,pc.remoteDescription)){try{await pc.addIceCandidate(candidate);}catch{/* Old ICE candidates are harmless after rollback. */}}else link.candidates.push(candidate);
   if(event.action==='offer'){await pc.setLocalDescription();if(this.current(id,link))this.signal({type:'rtc_signal',peer_id:id,action:'answer',description:pc.localDescription.toJSON()},link);}
  });
 }
 handle(event){
  if(this.closed)return;
  if(event.type==='rtc_peers'){
   if(typeof event.self_peer_id!=='string'||!event.self_peer_id)return;
   if(this.self!==event.self_peer_id)for(const id of this.links.keys())this.drop(id);
   this.self=event.self_peer_id;this.peers=new Map((Array.isArray(event.peers)?event.peers:[]).map(p=>[p.peer_id,p]));
   clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.reconnecting=false;this.applyAudioState();
   for(const id of this.links.keys())if(!this.peers.get(id)?.voice_active)this.drop(id);
   this.announce();for(const p of this.peers.values())this.connect(p);this.emit();
  }else if(event.type==='rtc_peer_joined'){this.peers.set(event.peer.peer_id,event.peer);this.connect(event.peer);this.emit();}
  else if(event.type==='rtc_peer_left'){this.drop(event.peer_id);this.peers.delete(event.peer_id);if(this.watchingScreen===event.peer_id)this.watchingScreen=null;this.emit();}
  else if(event.type==='voice_state'){
   const peer=this.peers.get(event.peer_id);if(!peer)return;Object.assign(peer,{voice_active:event.active,voice_muted:event.muted,screen_sharing:event.active&&event.screen_sharing===true});if(event.active)this.connect(peer);else this.drop(event.peer_id);if(!event.screen_sharing&&this.watchingScreen===event.peer_id)this.watchingScreen=null;this.emit();
  }else if(event.type==='rtc_signal')this.receiveSignal(event);
 }
 async resumeAudio(){
  const generation=this.generation,tasks=[];this.applyAudioState();if(this.audioContext)tasks.push(this.audioContext.resume());for(const link of this.links.values())if(link.audio.srcObject)tasks.push(link.audio.play());
  const results=await Promise.allSettled(tasks);if(this.closed||generation!==this.generation)return;this.error=results.some(result=>result.status==='rejected')?'VOICE_PLAY_BLOCKED':'';this.emit();
 }
}
