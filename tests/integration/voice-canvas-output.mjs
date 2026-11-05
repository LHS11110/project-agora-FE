import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5192';
const directory=mkdtempSync(join(tmpdir(),'agora-canvas-voice-')),tone=join(directory,'tone.wav');
const samples=48000*8,pcm=Buffer.alloc(44+samples*2);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(48000,24);pcm.writeUInt32LE(96000,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++)pcm.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*440*i/48000)),44+2*i);writeFileSync(tone,pcm);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${tone}`,...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const clients=new Map(),errors=[],pages=[];
const identity=id=>({peer_id:id,nickname:`Speaker ${id.toUpperCase()}`,tag_number:id==='a'?1:2,groups:['default'],voice_active:clients.get(id)?.active||false,voice_muted:clients.get(id)?.muted||false});
try{
 for(const id of ['a','b']){
  const user={user_id:id==='a'?10:11,email:`${id}@example.invalid`,nickname:identity(id).nickname,tag_number:identity(id).tag_number,role:'ROLE_USER',status:'ACTIVE'};
  const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.voice-fixture';
  const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['microphone'],locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
  await context.addInitScript(({user,token})=>{
   localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('agora_token',token);
   const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.voiceCaptured=[];
   navigator.mediaDevices.getUserMedia=async request=>{const stream=await capture({...request,audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});window.voiceCaptured.push(stream);return stream;};
   window.voiceGraphs=[];window.voicePlayers=[];
   const makeGain=AudioContext.prototype.createGain;AudioContext.prototype.createGain=function(){const gain=makeGain.call(this),analyser=this.createAnalyser();gain.connect(analyser);window.voiceGraphs.push({gain,analyser,context:this});return gain;};
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.srcObject&&!window.voicePlayers.includes(this))window.voicePlayers.push(this);return play.call(this);};
   window.voiceRms=()=>Math.max(0,...window.voiceGraphs.filter(g=>g.context.state==='running').map(({analyser})=>{const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,n)=>sum+n*n,0)/data.length);}));
  },{user,token});
  const client={rtc:null,joined:false,active:false,muted:false};clients.set(id,client);
  await context.route(url=>url.pathname.startsWith('/api/'),route=>{
   const path=new URL(route.request().url()).pathname;let data={canvas_id:999003,canvas_name:'Audible canvas fixture'};
   if(path==='/api/auth/me')data=user;
   else if(path.endsWith('/access'))data={ws_port:8002,canvas_access_token:'fixture'};
   else if(path.endsWith('/settings'))data={canvas_name:'Audible canvas fixture',settings_revision:0,visibility:'public',participants:[],group_permissions:{default:{read:true,write:true,execute:true}},can_manage:true};
   return route.fulfill({json:data});
  });
  await context.routeWebSocket(/\/wss\/port\//,socket=>{
   const rtc=socket.url().includes('/rtc/');if(rtc)client.rtc=socket;
   const initial={items:{box:{kind:'shape',shapeType:'rectangle',x:0,y:0,width:100,height:100,permission:'default'}},groups:['default'],member_groups:['default'],write_groups:['default'],execute_groups:['default'],is_admin:true,sync_protocol:2,sync_user_id:user.user_id,revision:0,accepted_count:0};
   setTimeout(()=>socket.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',...initial,rtc_canvas_connection_id:id,rtc_canvas_connection_hash:`proof-${id}`})),100);
   socket.onMessage(raw=>{const event=JSON.parse(String(raw));
    if(event.type==='canvas_sync')socket.send(JSON.stringify({type:'canvas_snapshot',...initial,client_id:event.client_id}));
    if(event.type==='chat_history')socket.send(JSON.stringify({type:'chat_history',request_id:event.request_id,room_id:'general',messages:[],total:0,has_more:false}));
    if(event.type==='mentions_get')socket.send(JSON.stringify({type:'mentions_snapshot',request_id:event.request_id,notifications:[]}));
    if(event.type==='rtc_join'){
     assert.equal(event.canvas_connection_id,id);assert.equal(event.canvas_connection_hash,`proof-${id}`);client.joined=true;
     socket.send(JSON.stringify({type:'rtc_peers',self_peer_id:id,peers:[...clients].filter(([other,c])=>other!==id&&c.joined).map(([other])=>identity(other))}));
     for(const [other,c]of clients)if(other!==id&&c.joined)c.rtc.send(JSON.stringify({type:'rtc_peer_joined',peer:identity(id)}));
    }
    if(event.type==='voice_state'){
     client.active=event.active;client.muted=event.muted;
     for(const c of clients.values())if(c.joined)c.rtc.send(JSON.stringify({...event,peer_id:id}));
    }
    if(event.type==='rtc_signal')clients.get(event.peer_id)?.rtc?.send(JSON.stringify({...event,from_peer_id:id}));
   });
   socket.onClose(()=>{if(rtc){client.joined=false;client.rtc=null;for(const [other,c]of clients)if(other!==id&&c.joined)c.rtc.send(JSON.stringify({type:'rtc_peer_left',peer_id:id}));}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/canvases/999003');await page.waitForFunction(()=>window.frelogCanvas?.read().items.box);await page.locator('.canvas-loading-status.is-overlay').waitFor({state:'hidden'});pages.push(page);
 }
 for(const page of pages){await page.getByRole('button',{name:'음성 통화',exact:true}).click();await page.getByRole('button',{name:'통화 참여',exact:true}).click();await page.getByRole('button',{name:'마이크 끄기',exact:true}).waitFor();}
 for(const page of pages){await page.locator('.voice-peer-main small').filter({hasText:'연결됨'}).waitFor();await page.waitForFunction(()=>voiceRms()>.05);}
 console.log('PASS actual canvas pages render decoded audio in both directions',await Promise.all(pages.map(page=>page.evaluate(()=>voiceRms()))));
 const [a,b]=pages,volume=a.getByRole('slider',{name:'Speaker B#2 볼륨',exact:true});
 const setVolume=async value=>volume.evaluate((input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);
 await setVolume(0);await a.waitForFunction(()=>voiceRms()<.00001);assert.ok(await b.evaluate(()=>voiceRms()>.05));await setVolume(35);
 await a.waitForFunction(()=>voiceRms()>.03&&voiceRms()<.12);await a.getByRole('button',{name:'소리 끄기',exact:true}).click();await a.waitForFunction(()=>voiceRms()<.00001);await a.getByRole('button',{name:'소리 켜기',exact:true}).click();await a.waitForFunction(()=>voiceRms()>.03);
 for(const page of pages)assert.equal(await page.evaluate(()=>voicePlayers.length>0&&voicePlayers.every(player=>player.muted&&player.volume===0&&!player.paused)),true,'silent native playout is retained after volume controls');
 await a.screenshot({path:'/tmp/voice-canvas-output.png'});console.log('PASS canvas volume and deafen alter measured output without doubled playback');
 for(const page of pages){await page.getByRole('button',{name:'통화 나가기',exact:true}).click();await page.waitForFunction(()=>voiceCaptured.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))&&voicePlayers.every(player=>player.paused&&!player.srcObject));}
 assert.deepEqual(errors,[]);console.log('PASS actual canvas leave releases microphone and playout');
}finally{await browser.close();rmSync(directory,{recursive:true,force:true});}
