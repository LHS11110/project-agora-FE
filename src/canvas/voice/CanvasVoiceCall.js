// Media uses WebRTC only; the authenticated canvas broker carries signaling.
export default class CanvasVoiceCall {
 constructor({send,iceServers=[{urls:'stun:stun.l.google.com:19302'}],media=globalThis.navigator?.mediaDevices,Peer=globalThis.RTCPeerConnection,audio=()=>new Audio()}){
  Object.assign(this,{send,iceServers,media,Peer,audio});this.peers=new Map();this.links=new Map();this.listeners=new Set();this.self='';this.stream=null;this.generation=0;this.muted=false;this.deafened=false;this.pending=false;this.error='';this.snapshot={ready:false,active:false,participants:[],muted:false,deafened:false,pending:false,error:''};
 }
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 getSnapshot=()=>this.snapshot;
 emit(){this.snapshot={ready:Boolean(this.self),active:Boolean(this.stream),pending:this.pending,muted:this.muted,deafened:this.deafened,error:this.error,participants:[...this.peers.values()].filter(p=>p.voice_active).map(p=>({...p,status:this.links.get(p.peer_id)?.pc.connectionState||'connecting'}))};this.listeners.forEach(fn=>fn());}
 announce(){return Boolean(this.self)&&this.send({type:'voice_state',active:Boolean(this.stream),muted:this.muted})===true;}
 async join(){
  if(this.stream||this.pending||!this.self)return;
  const generation=++this.generation;this.pending=true;this.error='';this.emit();
  try{
   if(!this.media?.getUserMedia||!this.Peer)throw Error('VOICE_UNSUPPORTED');
   const stream=await this.media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.muted=false;this.deafened=false;
   stream.getAudioTracks().forEach(t=>{t.onended=()=>{if(this.stream===stream)this.leave();};});
   if(!this.announce()){this.leave();throw Error('VOICE_CONNECTION_FAILED');}for(const peer of this.peers.values())this.connect(peer);
  }catch(error){if(generation===this.generation)this.error=error.name==='NotAllowedError'?'VOICE_MIC_DENIED':'VOICE_MIC_FAILED';}
  finally{if(generation===this.generation){this.pending=false;this.emit();}}
 }
 mute(){if(!this.stream)return;this.muted=!this.muted;this.stream.getAudioTracks().forEach(t=>t.enabled=!this.muted);this.announce();this.emit();}
 deafen(){this.deafened=!this.deafened;for(const link of this.links.values())link.audio.muted=this.deafened;this.emit();}
 drop(id){const link=this.links.get(id);if(!link)return;this.links.delete(id);clearTimeout(link.timer);link.pc.onicecandidate=null;link.pc.ontrack=null;link.pc.onconnectionstatechange=null;link.pc.close();link.audio.pause();link.audio.srcObject=null;}
 leave(){++this.generation;this.pending=false;const stream=this.stream;this.stream=null;stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});for(const id of this.links.keys())this.drop(id);this.muted=false;this.announce();this.emit();}
 suspend(){this.self='';this.leave();this.peers.clear();this.emit();}
 close(){this.leave();this.self='';this.peers.clear();this.listeners.clear();}
 connect(peer){
  if(!this.stream||!peer.voice_active||peer.peer_id===this.self||this.links.has(peer.peer_id))return;
  let pc;try{pc=new this.Peer({iceServers:this.iceServers});}catch{this.error='VOICE_CONNECTION_FAILED';this.emit();return;}const audio=this.audio();audio.autoplay=true;audio.muted=this.deafened;
  const link={pc,audio,candidates:[],serial:Promise.resolve(),timer:null};this.links.set(peer.peer_id,link);
  const send=(action,data)=>this.send({type:'rtc_signal',peer_id:peer.peer_id,action,...data});
  pc.onicecandidate=e=>{if(e.candidate)send('candidate',{candidate:e.candidate.toJSON()});};
  pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{this.error='VOICE_PLAY_BLOCKED';this.emit();});};
  pc.onconnectionstatechange=()=>{if(this.links.get(peer.peer_id)!==link)return;if(pc.connectionState==='connected')clearTimeout(link.timer);if(pc.connectionState==='failed'){this.error='VOICE_CONNECTION_FAILED';}this.emit();};
  for(const track of this.stream.getAudioTracks())pc.addTrack(track,this.stream);
  // A single deterministic offerer prevents simultaneous-join glare.
  if(this.self<peer.peer_id)link.serial=link.serial.then(async()=>{await pc.setLocalDescription(await pc.createOffer());send('offer',{description:pc.localDescription.toJSON()});}).catch(()=>{if(this.links.get(peer.peer_id)===link){this.error='VOICE_CONNECTION_FAILED';this.emit();}});
  link.timer=setTimeout(()=>{if(this.links.get(peer.peer_id)===link&&pc.connectionState!=='connected'){this.error='VOICE_CONNECTION_FAILED';this.emit();}},25000);
  this.emit();
 }
 handle(event){
  if(event.type==='rtc_peers'){
   if(this.self!==event.self_peer_id)for(const id of this.links.keys())this.drop(id);this.self=event.self_peer_id;this.peers=new Map((event.peers||[]).map(p=>[p.peer_id,p]));for(const id of this.links.keys())if(!this.peers.get(id)?.voice_active)this.drop(id);this.announce();for(const p of this.peers.values())this.connect(p);this.emit();
  }else if(event.type==='rtc_peer_joined'){this.peers.set(event.peer.peer_id,event.peer);this.connect(event.peer);this.emit();}
  else if(event.type==='rtc_peer_left'){this.drop(event.peer_id);this.peers.delete(event.peer_id);this.emit();}
  else if(event.type==='voice_state'){
   const peer=this.peers.get(event.peer_id);if(!peer)return;Object.assign(peer,{voice_active:event.active,voice_muted:event.muted});if(event.active)this.connect(peer);else this.drop(event.peer_id);this.emit();
  }else if(event.type==='rtc_signal'){
   const peer=this.peers.get(event.from_peer_id);if(!this.stream||!peer?.voice_active)return;this.connect(peer);const link=this.links.get(peer.peer_id);if(!link)return;
   link.serial=link.serial.then(async()=>{
    if(this.links.get(peer.peer_id)!==link)return;const pc=link.pc;
    if(event.action==='candidate'){if(pc.remoteDescription)await pc.addIceCandidate(event.candidate);else if(link.candidates.length<256)link.candidates.push(event.candidate);return;}
    if(!['offer','answer'].includes(event.action)||event.description?.type!==event.action)return;
    if(event.action==='offer'&&this.self<peer.peer_id)return;
    await pc.setRemoteDescription(event.description);
    for(const candidate of link.candidates)await pc.addIceCandidate(candidate);link.candidates=[];
    if(event.action==='offer'){await pc.setLocalDescription(await pc.createAnswer());this.send({type:'rtc_signal',peer_id:peer.peer_id,action:'answer',description:pc.localDescription.toJSON()});}
   }).catch(()=>{if(this.links.get(peer.peer_id)===link){this.error='VOICE_CONNECTION_FAILED';this.emit();}});
  }
 }
 resumeAudio(){for(const link of this.links.values())link.audio.play().catch(()=>{});this.error='';this.emit();}
}
