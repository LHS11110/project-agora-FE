import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5192';
// Known PCM input makes received packets carrying silence fail this test.
const directory=mkdtempSync(join(tmpdir(),'agora-voice-tone-')),tone=join(directory,'tone.wav');
const samples=48000*8,pcm=Buffer.alloc(44+samples*2);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(48000,24);pcm.writeUInt32LE(96000,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++)pcm.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*440*i/48000)),44+2*i);writeFileSync(tone,pcm);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${tone}`,'--autoplay-policy=no-user-gesture-required']});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true,permissions:['microphone']});
 await context.route('**/voice-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Audible voice regression</title>'}));
 const page=await context.newPage();await page.goto(origin+'/voice-test');
 await page.evaluate(async()=>{
  const {default:Call}=await import('/src/canvas/voice/CanvasVoiceCall.js');const calls=new Map(),states=new Map();window.calls=calls;window.states=states;
  for(const id of ['a','b']){
   const call=new Call({iceServers:[],media:{getUserMedia:()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false})},send:event=>{
    const sender=call.self||id;
    if(event.type==='voice_state'){
     states.set(sender,{peer_id:sender,nickname:id,tag_number:1,voice_active:event.active,voice_muted:event.muted});
     for(const c of calls.values())queueMicrotask(()=>c.handle({...event,peer_id:sender}));
    }else if(event.type==='rtc_signal')queueMicrotask(()=>[...calls.values()].find(c=>c.self===event.peer_id)?.handle({...event,from_peer_id:sender}));
    return true;
   }});
   calls.set(id,call);const peer={peer_id:id,nickname:id,tag_number:1,voice_active:false};states.set(id,peer);
   for(const [other,c]of calls)if(other!==id)c.handle({type:'rtc_peer_joined',peer:{...peer}});
   call.handle({type:'rtc_peers',self_peer_id:id,peers:[...states.values()].filter(p=>p.peer_id!==id).map(p=>({...p}))});await call.join();
  }
  window.rms=()=>[...calls].map(([id,c])=>{
   const link=[...c.links.values()][0];if(!link?.gain)return {id,pre:0,post:0};
   if(link.observedGain!==link.gain){link.pre=c.audioContext.createAnalyser();link.post=c.audioContext.createAnalyser();link.source.connect(link.pre);link.gain.connect(link.post);link.observedGain=link.gain;}
   const measure=node=>{const data=new Float32Array(node.fftSize);node.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,n)=>sum+n*n,0)/data.length);};
   return {id,pre:measure(link.pre),post:measure(link.post)};
  });
 });
 await page.waitForFunction(()=>[...calls.values()].every(c=>[...c.links.values()].some(l=>l.pc.connectionState==='connected')));
 await page.waitForFunction(()=>rms().every(level=>level.post>.05));
 console.log('PASS decoded audible output on both peers',await page.evaluate(()=>rms()));
 const primed=()=>page.evaluate(()=>[...calls.values()].every(c=>[...c.links.values()].every(l=>l.audio.srcObject&&!l.audio.paused&&l.audio.muted&&l.audio.volume===0)));
 assert.equal(await primed(),true,'native playout is running but silent to prevent doubled audio');
 await page.evaluate(()=>calls.get('a').setPeerVolume('b',25));
 await page.waitForFunction(()=>{const [a,b]=rms();return a.pre>.05&&a.post/a.pre>.2&&a.post/a.pre<.3&&b.post>.05;});
 await page.evaluate(()=>calls.get('a').deafen());await page.waitForFunction(()=>{const a=rms()[0];return a.pre>.05&&a.post<.00001;});
 await page.evaluate(()=>calls.get('a').deafen());await page.waitForFunction(()=>{const a=rms()[0];return a.post/a.pre>.2&&a.post/a.pre<.3;});
 await page.evaluate(()=>calls.get('a').setPeerVolume('b',0));await page.waitForFunction(()=>rms()[0].post<.00001);
 await page.evaluate(()=>calls.get('a').setPeerVolume('b',100));await page.waitForFunction(()=>rms()[0].post>.05);
 assert.equal(await primed(),true,'volume/deafen never unmute the duplicate native output');
 await page.evaluate(()=>calls.get('b').mute());await page.waitForFunction(()=>rms()[0].post<.0001);await page.evaluate(()=>calls.get('b').mute());await page.waitForFunction(()=>rms()[0].post>.05);
 console.log('PASS measured participant volume, deafen and microphone mute/unmute');
 await page.evaluate(()=>{window.oldIce=calls.get('a').links.get('b').pc.localDescription.sdp;calls.get('a').repair('b');calls.get('b').repair('a');});
 await page.waitForFunction(()=>calls.get('a').links.get('b').pc.localDescription.sdp!==oldIce&&[...calls.values()].every(c=>[...c.links.values()].every(l=>l.pc.connectionState==='connected')));
 await page.waitForFunction(()=>rms().every(level=>level.post>.05));
 await page.evaluate(()=>{
  const a=calls.get('a');a.setPeerVolume('b',35);window.savedStream=a.stream;a.reconnect();states.delete('a');calls.get('b').handle({type:'rtc_peer_left',peer_id:'a'});
  const peer={peer_id:'a-restored',nickname:'a',tag_number:1,voice_active:true};states.set(peer.peer_id,peer);calls.get('b').handle({type:'rtc_peer_joined',peer:{...peer}});
  a.handle({type:'rtc_peers',self_peer_id:peer.peer_id,peers:[...states.values()].filter(p=>p.peer_id!==peer.peer_id).map(p=>({...p}))});
 });
 await page.waitForFunction(()=>{const [a,b]=rms();return a.pre>.05&&a.post/a.pre>.3&&a.post/a.pre<.4&&b.post>.05;});
 assert.equal(await page.evaluate(()=>calls.get('a').stream===savedStream),true);assert.equal(await primed(),true);
 console.log('PASS audible output and relative volume survive ICE and authenticated room recovery');
 const released=await page.evaluate(()=>{const links=[...calls.values()].flatMap(c=>[...c.links.values()]);const tracks=[...calls.values()].flatMap(c=>c.stream.getTracks());for(const c of calls.values())c.close();return tracks.every(t=>t.readyState==='ended')&&links.every(l=>l.audio.paused&&!l.audio.srcObject);});assert.equal(released,true);
 await context.close();
}finally{await browser.close();rmSync(directory,{recursive:true,force:true});}
