import assert from 'node:assert/strict';
import * as A from '@automerge/automerge';
import {makeCollaborativeItem,collaborativeField} from '../../src/canvas/collaborativeSync.js';
import {loadItemDoc} from '../../src/canvas/host/hostOperations.js';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.AGORA_E2E_ORIGIN||'https://localhost:5192';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox',...(process.env.AGORA_E2E_HOST_RESOLVER?['--host-resolver-rules='+process.env.AGORA_E2E_HOST_RESOLVER]:[])]});
const user={email:'undo@example.invalid',nickname:'Undo',tag_number:1,role:'ROLE_USER',status:'ACTIVE'};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.fixture';
const caps={groups:['default'],write_groups:['default'],execute_groups:['default'],is_admin:true};
const latest={t:makeCollaborativeItem({kind:'text',text:'',renderMode:'plain',x:.2,y:.2,width:.3,height:.15,permission:'default'}),c:makeCollaborativeItem({kind:'code',code:'',language:'python',filename:'main.py',x:.55,y:.2,width:.3,height:.24,permission:'default'})};
let revision=0;const clients=new Map(),errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',ignoreHTTPSErrors:process.env.AGORA_E2E_INSECURE_LOCAL_TLS==='1'});
 await context.addInitScript(({token,user})=>{localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));},{token,user});
 await context.route(url=>url.pathname.startsWith('/api/'),r=>{
  const path=new URL(r.request().url()).pathname;
  return r.fulfill({json:path==='/api/auth/me'?user:path.endsWith('/access')?{ws_port:8002,canvas_access_token:'fixture'}:path.endsWith('/settings')?{canvas_name:'Collaborative undo',settings_revision:0,visibility:'private',participants:[],can_manage:true}:{canvas_id:999004,canvas_name:'Collaborative undo'}});
 });
 await context.routeWebSocket(/\/wss\/port\//,ws=>{
  const rtc=ws.url().includes('/rtc/'),client=new URL(ws.url()).searchParams.get('client_id');
  if(!rtc)clients.set(client,{ws,count:0});
  setTimeout(()=>ws.send(JSON.stringify(rtc?{type:'rtc_ready'}:{type:'init_items',items:latest,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:0,rtc_canvas_connection_id:'fixture',rtc_canvas_connection_hash:'proof'})),80);
  ws.onMessage(raw=>{
   const data=JSON.parse(String(raw));
   if(data.type==='rtc_join')ws.send(JSON.stringify({type:'rtc_peers',self_peer_id:'peer-'+client,peers:[]}));
   if(data.type==='canvas_sync')ws.send(JSON.stringify({type:'canvas_snapshot',items:latest,client_id:data.client_id,...caps,sync_protocol:2,sync_user_id:7,revision,accepted_count:clients.get(client)?.count||0}));
   if(data.type!=='canvas_ops')return;
   const connection=clients.get(client);if(data.request_count<=connection.count)return;
   const changes={};
   for(const op of data.operations){
    if(op.action==='delete'){changes[op.id]=null;delete latest[op.id];continue;}
    const previous=latest[op.id],item={...previous,...op.patch};for(const key of op.unset||[])delete item[key];
    if(['text','code','note'].includes(item.kind)){
     const incoming=loadItemDoc(item),doc=previous?A.merge(A.clone(loadItemDoc(previous)),incoming):incoming;
     item[collaborativeField(item)]=doc.content;item.automerge_snapshot=Buffer.from(A.save(doc)).toString('base64');item.automerge_changes=[];
    }
    latest[op.id]=item;changes[op.id]=item;
   }
   connection.count=data.request_count;revision++;
   for(const {ws:other} of clients.values())other.send(JSON.stringify({type:'canvas_commit',client_id:client,author_id:7,request_count:data.request_count,revision,items:changes}));
  });
 });
 const a=await context.newPage(),b=await context.newPage();for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/canvases/999004');await page.waitForFunction(()=>window.frelogCanvas?.read().items.t);}
 const value=(page,id)=>page.evaluate(id=>{const item=window.frelogCanvas.read().items[id];return item.kind==='code'?item.code:item.text;},id);
 const waitValue=(page,id,text)=>page.waitForFunction(({id,text})=>{const item=window.frelogCanvas.read().items[id];return (item.kind==='code'?item.code:item.text)===text;},{id,text}).catch(async error=>{console.error('Expected',id,text,'actual',await page.evaluate(()=>window.frelogCanvas.read().items),'page errors',errors);throw error;});
 const edit=async(page,id)=>{
  await page.bringToFront();
  await page.evaluate(id=>{const api=window.frelogCanvas;api.apply(api.plan({version:1,items:{[id]:{fontSize:(api.read().items[id].fontSize||13)+.01}}}));},id);
  await page.locator(`[data-item-id="${id}"]`).dblclick();
  const selector=id==='c'?'.monaco-editor textarea':'.inline-content-input';
  const input=page.locator(selector);await input.waitFor();if(id==='c')await page.locator('.canvas-code-editor[data-status="ready"]').waitFor();await input.focus();return input;
 };
 await edit(a,'t');await a.keyboard.insertText('a');await waitValue(b,'t','a');
 await edit(b,'t');await b.keyboard.press('Home');await b.keyboard.insertText('b');await waitValue(a,'t','ba');
 await a.bringToFront();await a.locator('.inline-content-input').focus();await a.keyboard.press('Control+z');await waitValue(a,'t','b');await waitValue(b,'t','b');assert.equal(latest.t.text,'b');
 // A second undo has no local text edit left: it cannot undo B's b or the object.
 await a.keyboard.press('Control+z');await a.waitForTimeout(100);assert.equal(await value(a,'t'),'b');
 await edit(a,'c');await a.keyboard.insertText('a');await waitValue(b,'c','a');
 await edit(b,'c');await b.keyboard.press('Home');await b.keyboard.insertText('b');await waitValue(a,'c','ba');
 await a.bringToFront();await a.locator('.monaco-editor textarea').focus();await a.keyboard.press('Control+z');await waitValue(a,'c','b');await waitValue(b,'c','b');assert.equal(latest.c.code,'b');
 // Monaco's context menu must also use collaborative undo, not its remote-edit stack.
 await a.keyboard.press('End');await a.keyboard.insertText('c');await waitValue(b,'c','bc');
 await b.bringToFront();await b.locator('.monaco-editor textarea').focus();await b.keyboard.press('Home');await b.keyboard.insertText('d');await waitValue(a,'c','dbc');
 await a.bringToFront();await a.waitForFunction(()=>document.querySelector('.monaco-editor .view-lines')?.textContent.includes('dbc'));await a.locator('.monaco-editor textarea').focus();await a.locator('.monaco-editor .view-lines').click({button:'right',position:{x:15,y:8}});
 await a.getByRole('menuitem',{name:/^(Undo|실행 취소)/}).click();await waitValue(a,'c','db');await waitValue(b,'c','db');
 assert.deepEqual(errors,[]);console.log('PASS two browser clients: inline text and real Monaco undo a from ba to b, broker CRDT merge and peer convergence');
 await context.close();
}finally{await browser.close();}
