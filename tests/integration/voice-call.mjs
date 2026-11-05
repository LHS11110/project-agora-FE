import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5192';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,permissions:['microphone']});
 await context.route('**/voice-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Voice integration</title>'}));
 const page=await context.newPage();await page.goto(origin+'/voice-test');
 await page.evaluate(async()=>{
  const {default:Call}=await import('/src/canvas/voice/CanvasVoiceCall.js');const calls=new Map(),states=new Map();window.calls=calls;window.states=states;
  window.add=async id=>{
   const call=new Call({iceServers:[],disconnectDelay:30,negotiationTimeout:3000,send:event=>{
    const sender=call.self||id;if(window.blockSignals&&event.type==='rtc_signal')return false;
    if(event.type==='voice_state'){
     states.set(sender,{peer_id:sender,nickname:id,tag_number:1,voice_active:event.active,voice_muted:event.muted});
     for(const c of calls.values())queueMicrotask(()=>c.handle({...event,peer_id:sender}));
    }else if(event.type==='rtc_signal')queueMicrotask(()=>[...calls.values()].find(c=>c.self===event.peer_id)?.handle({...event,from_peer_id:sender}));
    return true;
   }});
   calls.set(id,call);const peer={peer_id:id,nickname:id,tag_number:1,voice_active:false};states.set(id,peer);
   for(const [other,c]of calls)if(other!==id)c.handle({type:'rtc_peer_joined',peer:{...peer}});
   call.handle({type:'rtc_peers',self_peer_id:id,peers:[...states.values()].filter(p=>p.peer_id!==id).map(p=>({...p}))});
   await call.join();
  };
  await window.add('a');await window.add('b');
 });
 await page.waitForFunction(()=>[...calls.values()].every(c=>c.links.size===1&&[...c.links.values()].every(l=>l.pc.connectionState==='connected')));
 await page.waitForFunction(async()=>{for(const call of calls.values())for(const link of call.links.values()){const reports=await link.pc.getStats();if(![...reports.values()].some(r=>r.type==='inbound-rtp'&&r.kind==='audio'&&r.bytesReceived>0))return false;}return true;});
 console.log('PASS real WebRTC audio RTP in both directions');
 await page.evaluate(()=>calls.get('a').mute());
 assert.equal(await page.evaluate(()=>!calls.get('a').stream.getAudioTracks()[0].enabled&&calls.get('b').peers.get('a').voice_muted),true);
 await page.evaluate(()=>calls.get('b').deafen());assert.equal(await page.evaluate(()=>[...calls.get('b').links.values()].every(l=>l.audio.muted)),true);
 await page.evaluate(()=>window.add('c'));
 await page.waitForFunction(()=>[...calls.values()].every(c=>c.links.size===2&&[...c.links.values()].every(l=>l.pc.connectionState==='connected')));
 console.log('PASS late join, mute broadcast and local sound control');
 await page.evaluate(()=>{calls.get('a').setPeerVolume('b',30);});
 await page.waitForFunction(()=>Math.abs(calls.get('a').links.get('b').gain?.gain.value-.3)<.01);
 assert.equal(await page.evaluate(()=>calls.get('b').volumeFor(calls.get('b').peers.get('a'))),100);
 await page.evaluate(()=>{window.iceBefore=calls.get('a').links.get('b').pc.localDescription.sdp.match(/a=ice-ufrag:([^\r\n]+)/)[1];calls.get('a').repair('b');calls.get('b').repair('a');});
 await page.waitForFunction(()=>{const a=calls.get('a').links.get('b').pc,b=calls.get('b').links.get('a').pc;return a.connectionState==='connected'&&b.connectionState==='connected'&&a.signalingState==='stable'&&b.signalingState==='stable'&&a.localDescription.sdp.match(/a=ice-ufrag:([^\r\n]+)/)[1]!==iceBefore;});
 console.log('PASS simultaneous ICE restart/glare recovery and independent Web Audio participant volume');
 await page.evaluate(()=>{window.iceBefore=calls.get('a').links.get('b').pc.localDescription.sdp.match(/a=ice-ufrag:([^\r\n]+)/)[1];const pc=calls.get('a').links.get('b').pc;Object.defineProperty(pc,'iceConnectionState',{value:'disconnected',configurable:true});Object.defineProperty(pc,'connectionState',{value:'disconnected',configurable:true});pc.oniceconnectionstatechange();delete pc.iceConnectionState;delete pc.connectionState;});
 await page.waitForFunction(()=>{const pc=calls.get('a').links.get('b').pc;return pc.connectionState==='connected'&&pc.signalingState==='stable'&&pc.localDescription.sdp.match(/a=ice-ufrag:([^\r\n]+)/)[1]!==iceBefore;});
 await page.evaluate(()=>{window.blockSignals=true;window.iceBefore=calls.get('a').links.get('b').pc.localDescription.sdp.match(/a=ice-ufrag:([^\r\n]+)/)[1];calls.get('a').repair('b');});
 await page.waitForFunction(()=>calls.get('a').outbox.length>0);await page.evaluate(()=>window.blockSignals=false);
 await page.waitForFunction(()=>{const pc=calls.get('a').links.get('b').pc;return !calls.get('a').outbox.length&&pc.signalingState==='stable'&&pc.connectionState==='connected'&&pc.localDescription.sdp.match(/a=ice-ufrag:([^\r\n]+)/)[1]!==iceBefore;});
 console.log('PASS disconnected-media automatic repair and temporary signaling backpressure');
 await page.evaluate(()=>{
  const a=calls.get('a');window.savedStream=a.stream;a.reconnect();states.delete('a');
  for(const [id,c]of calls)if(id!=='a')c.handle({type:'rtc_peer_left',peer_id:'a'});
 });
 assert.equal(await page.evaluate(()=>calls.get('a').snapshot.active&&calls.get('a').snapshot.reconnecting&&savedStream.getTracks().every(t=>t.readyState==='live'&&!t.enabled)),true);
 await page.evaluate(()=>{
  const a=calls.get('a'),peer={peer_id:'a-resumed',nickname:'a',tag_number:1,voice_active:true,voice_muted:true};states.set(peer.peer_id,peer);
  for(const [id,c]of calls)if(id!=='a')c.handle({type:'rtc_peer_joined',peer:{...peer}});
  a.handle({type:'rtc_peers',self_peer_id:peer.peer_id,peers:[...states.values()].filter(p=>p.peer_id!==peer.peer_id).map(p=>({...p}))});
 });
 await page.waitForFunction(()=>[...calls.values()].every(c=>c.links.size===2&&[...c.links.values()].every(l=>l.pc.connectionState==='connected')));
 assert.equal(await page.evaluate(()=>calls.get('a').stream===savedStream&&calls.get('a').snapshot.muted&&calls.get('b').snapshot.deafened&&calls.get('a').volumeFor(calls.get('a').peers.get('b'))===30),true);
 await page.waitForFunction(async()=>{for(const call of calls.values())for(const link of call.links.values()){const reports=await link.pc.getStats();if(![...reports.values()].some(r=>r.type==='inbound-rtp'&&r.kind==='audio'&&r.bytesReceived>0))return false;}return true;});
 console.log('PASS authenticated room rejoin under a new peer ID with the original microphone, mute and volume retained, and RTP restored');
 await page.evaluate(()=>{window.tracks=[...calls.get('a').stream.getTracks()];calls.get('a').leave();});
 await page.waitForFunction(()=>calls.get('b').links.size===1&&calls.get('c').links.size===1);
 assert.equal(await page.evaluate(()=>tracks.every(t=>t.readyState==='ended')&&!calls.get('a').snapshot.active),true);
 await page.evaluate(()=>{for(const c of calls.values())c.suspend();});assert.equal(await page.evaluate(()=>[...calls.values()].every(c=>!c.stream&&!c.links.size&&!c.self)),true);
 console.log('PASS leave and disconnect stop microphone capture and release all peer connections');
 await context.close();
}finally{await browser.close();}
