import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5192';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,permissions:['microphone']});
 await context.route('**/voice-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Voice integration</title>'}));
 const page=await context.newPage();await page.goto(origin+'/voice-test');
 await page.evaluate(async()=>{
  const {default:Call}=await import('/src/canvas/voice/CanvasVoiceCall.js');const calls=new Map(),states=new Map();window.calls=calls;
  window.add=async id=>{
   const call=new Call({iceServers:[],send:event=>{
    if(event.type==='voice_state'){
     states.set(id,{peer_id:id,nickname:id,tag_number:1,voice_active:event.active,voice_muted:event.muted});
     for(const c of calls.values())queueMicrotask(()=>c.handle({...event,peer_id:id}));
    }else if(event.type==='rtc_signal')queueMicrotask(()=>calls.get(event.peer_id)?.handle({...event,from_peer_id:id}));
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
 await page.evaluate(()=>{window.tracks=[...calls.get('a').stream.getTracks()];calls.get('a').leave();});
 await page.waitForFunction(()=>calls.get('b').links.size===1&&calls.get('c').links.size===1);
 assert.equal(await page.evaluate(()=>tracks.every(t=>t.readyState==='ended')&&!calls.get('a').snapshot.active),true);
 await page.evaluate(()=>{for(const c of calls.values())c.suspend();});assert.equal(await page.evaluate(()=>[...calls.values()].every(c=>!c.stream&&!c.links.size&&!c.self)),true);
 console.log('PASS leave and disconnect stop microphone capture and release all peer connections');
 await context.close();
}finally{await browser.close();}
