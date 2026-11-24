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
   const call=new Call({iceServers:[],iceTransportPolicy:'all',disconnectDelay:30,negotiationTimeout:3000,send:event=>{
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
 await page.evaluate(()=>{
  const call=calls.get('b');
  window.failedPeer=call.links.get('a').pc;
  failedPeer.close();
  call.repair('a');
 });
 await page.waitForFunction(async()=>{
  const pc=calls.get('b').links.get('a').pc;
  if(pc===failedPeer||pc.connectionState!=='connected')return false;
  const reports=await pc.getStats();
  return [...reports.values()].some(report=>report.type==='inbound-rtp'&&report.kind==='audio'&&report.bytesReceived>0);
 });
 console.log('PASS unilateral media failure rebuilds the former answering peer and restores RTP');
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

 const canvasContext=await browser.newContext({ignoreHTTPSErrors:true,permissions:['microphone'],locale:'ko-KR'});
 const user={user_id:10,email:'voice-fixture@example.invalid',nickname:'Caller',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
 const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.voice-fixture';
 await canvasContext.addInitScript(user=>{
  localStorage.setItem('agora_user',JSON.stringify(user));
  const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.voiceCaptures=[];
  navigator.mediaDevices.getUserMedia=async options=>{
   const stream=await capture(options);
   window.voiceCaptures.push(stream);
   return stream;
  };
 },user);
 await canvasContext.route(url=>url.pathname.startsWith('/api/'),route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/session/refresh')return route.fulfill({json:{accessToken:token,user}});
  if(path==='/api/auth/me')return route.fulfill({json:user});
  if(path.endsWith('/access'))return route.fulfill({json:{ws_port:8002,canvas_access_token:'fixture'}});
  return route.fulfill({json:{canvas_id:999003,canvas_name:'RTC fixture',visibility:'public',participants:[],group_permissions:{default:{read:true,write:true,execute:true}}}});
 });
 let canvasConnections=0,rtcConnections=0,rtcSocket;
 const activeSessions=new Set();
 let rejoined;
 const rtcRejoined=new Promise(resolve=>{rejoined=resolve;});
 const snapshot={items:{},groups:['default'],member_groups:['default'],write_groups:['default'],execute_groups:['default'],is_admin:true,sync_protocol:2,sync_user_id:10,revision:0,accepted_count:0,rtc_canvas_connection_id:'canvas-connection',rtc_canvas_connection_hash:'proof'};
 await canvasContext.routeWebSocket(/\/wss\/port\//,socket=>{
  const rtc=socket.url().includes('/rtc/');
  const session=rtc?++rtcConnections:++canvasConnections;
  if(rtc)rtcSocket=socket;
  const send=data=>socket.send(JSON.stringify(data));
  socket.onMessage(raw=>{
   const event=JSON.parse(String(raw));
   if(event.type==='canvas_sync')send({type:'canvas_snapshot',...snapshot,client_id:event.client_id});
   if(event.type==='chat_history')send({type:'chat_history',request_id:event.request_id,room_id:'general',messages:[],total:0,has_more:false});
   if(event.type==='rtc_join'){
    assert.equal(event.canvas_connection_id,snapshot.rtc_canvas_connection_id);
    assert.equal(event.canvas_connection_hash,snapshot.rtc_canvas_connection_hash);
    send({type:'rtc_peers',self_peer_id:`peer-${session}`,peers:[],media_relay:{ice_servers:[{urls:['turns:unused.example.invalid'],username:'fixture',credential:'fixture'}],expires_at:Math.floor(Date.now()/1000)+1800}});
   }
   if(event.type==='voice_state'&&event.active){
    activeSessions.add(session);
    if(session===2)rejoined();
   }
  });
  send(rtc?{type:'rtc_ready'}:{type:'init_items',...snapshot});
 });
 const canvasPage=await canvasContext.newPage();
 await canvasPage.goto(origin+'/canvases/999003');
 await canvasPage.getByRole('button',{name:'음성 통화',exact:true}).click();
 await canvasPage.getByRole('button',{name:'통화 참여',exact:true}).click();
 await canvasPage.getByRole('button',{name:'마이크 끄기',exact:true}).waitFor();
 const originalRtc=rtcSocket;
 await originalRtc.close({code:1011,reason:'RTC fixture disconnect'});
 const rejoinTimeout=AbortSignal.timeout(10000);
 await Promise.race([
  rtcRejoined,
  new Promise((_,reject)=>rejoinTimeout.addEventListener('abort',()=>reject(new Error(`RTC rejoin did not complete (canvas=${canvasConnections}, RTC=${rtcConnections})`)),{once:true})),
 ]);
 await canvasPage.getByRole('button',{name:'마이크 끄기',exact:true}).waitFor();
 await canvasPage.waitForFunction(()=>document.querySelector('.voice-status')?.textContent.includes('통화 중'));
 assert.equal(canvasConnections,1);
 assert.equal(rtcConnections,2);
 assert.ok(activeSessions.has(1)&&activeSessions.has(2));
 assert.equal(await canvasPage.evaluate(()=>voiceCaptures.length===1&&voiceCaptures[0].getAudioTracks()[0].readyState==='live'),true);
 console.log('PASS RTC socket reconnects on the existing canvas session and reuses the microphone');
 await canvasContext.close();
}finally{await browser.close();}
