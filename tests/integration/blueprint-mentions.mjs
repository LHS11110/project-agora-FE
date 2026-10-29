import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
if (!process.env.AGORA_E2E_STATE || !process.env.AGORA_E2E_PLAYWRIGHT_MODULE) throw new Error('Set AGORA_E2E_STATE and AGORA_E2E_PLAYWRIGHT_MODULE. Use a disposable canvas.');
const state=JSON.parse(await fs.readFile(process.env.AGORA_E2E_STATE,'utf8'));
const origin=process.env.AGORA_E2E_ORIGIN || 'https://localhost';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE);
const browser=await chromium.launch({executablePath:process.env.AGORA_E2E_CHROME || '/usr/bin/google-chrome',args:['--no-sandbox','--host-resolver-rules=MAP 118.34.144.201 127.0.0.1','--disable-features=LocalNetworkAccessChecks','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const pages=[];
async function ready(page){await page.waitForFunction(()=>window.frelogCanvas&&window.testSocket?.readyState===1&&document.querySelector('.connection-pill.connected')&&!document.querySelector('.canvas-loading-status.is-overlay'),null,{timeout:60000})}
async function open(auth){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:2200,height:1400},locale:'ko-KR'});
 await context.addInitScript(({token,user})=>{
  localStorage.setItem('agora_token',token);localStorage.setItem('agora_user',JSON.stringify(user));localStorage.setItem('frelog_locale','ko');
  const send=WebSocket.prototype.send;const registered=new WeakSet();
  WebSocket.prototype.send=function(data){try{const x=JSON.parse(data);if(x.type==='canvas_settings_get'){window.testSocket=this;window.testInbox ||= [];if(!registered.has(this)){registered.add(this);this.addEventListener('message',event=>{try{window.testInbox.push(JSON.parse(event.data))}catch{}})}}}catch{}return send.call(this,data)};
 },auth);
 const page=await context.newPage();pages.push(page);page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 await page.goto(`${origin}/canvases/${state.complete_id}`);await ready(page);return {page,context};
}
async function request(page,event,type){
 const id='e2e-'+crypto.randomUUID();await page.evaluate(({event,id})=>window.testSocket.send(JSON.stringify({...event,request_id:id})),{event,id});
 const handle=await page.waitForFunction(({id,type})=>window.testInbox.find(e=>e.request_id===id&&(e.type===type||e.type==='error')),{id,type},{timeout:30000});
 const result=await handle.jsonValue();if(result.type==='error')throw new Error('Server request failed: '+JSON.stringify(result));return result;
}
async function apply(page,items,remove=[]){await page.evaluate(({items,remove})=>window.frelogCanvas.apply(window.frelogCanvas.plan({version:1,mode:'merge',items,remove})),{items,remove})}
try{
 const {page:a}=await open(state.sessions[0]);console.log('Owner connected');
 await apply(a,{'comment-target':{kind:'shape',shapeType:'rectangle',x:700,y:300,width:240,height:140,permission:'default'}});
 await a.waitForFunction(()=>window.testInbox.some(e=>e.type==='canvas_commit'&&e.items?.['comment-target']),null,{timeout:30000});
 await a.getByRole('button',{name:'객체 댓글',exact:true}).click();
 const panel=a.getByRole('complementary',{name:'객체 댓글',exact:true});
 const token=`@${state.sessions[1].user.nickname}#${state.sessions[1].user.tag_number}`;
 const input=panel.getByLabel('객체 댓글 입력');await input.fill('@');await panel.getByRole('option',{name:token,exact:true}).click();await a.keyboard.insertText('offline comment');await panel.getByRole('button',{name:'전송',exact:true}).click();
 await a.waitForFunction(()=>window.testInbox.some(e=>e.type==='chat'&&e.object_id==='comment-target'&&e.text.includes('offline comment')),null,{timeout:30000});
 await request(a,{type:'chat',room_id:'general',text:token+' offline chat'},'event_ack');
 for(let index=0;index<55;index++)await request(a,{type:'chat',room_id:'general',text:'filler '+index},'event_ack');
 const ownerMentions=await request(a,{type:'mentions_get',user_id:state.sessions[1].user.user_id},'mentions_snapshot');assert.equal(ownerMentions.notifications.length,0);
 console.log('Mentions stored while recipient was offline; identity spoofing rejected');
 const {page:b,context:bc}=await open(state.sessions[1]);const {page:b2,context:b2c}=await open(state.sessions[1]);
 for(const page of [b,b2])await page.getByLabel('멘션 알림',{exact:true}).getByRole('button',{name:/offline comment/}).waitFor({timeout:30000});
 const notes=await request(b,{type:'mentions_get'},'mentions_snapshot');assert.equal(notes.notifications.length,2);
 await assert.rejects(request(a,{type:'mention_read',mention_id:notes.notifications[0].mention_id,user_id:state.sessions[1].user.user_id},'mention_read'),/MENTION_NOT_FOUND/);
 await b.getByLabel('멘션 알림',{exact:true}).getByRole('button',{name:/offline comment/}).click();
 await b.getByRole('complementary',{name:'객체 댓글',exact:true}).getByText(/offline comment/).waitFor({timeout:30000});
 await b.waitForFunction(()=>!document.querySelector('.mention-notifications')?.textContent.includes('offline comment'),null,{timeout:30000});
 await b2.waitForFunction(()=>!document.querySelector('.mention-notifications')?.textContent.includes('offline comment'),null,{timeout:30000});
 await b.getByLabel('멘션 알림',{exact:true}).getByRole('button',{name:/offline chat/}).click();
 await b.locator('.chat-entry.mention-target').getByText(/offline chat/).waitFor({timeout:30000});
 await b.waitForFunction(()=>!document.querySelector('.mention-notifications'),null,{timeout:30000});
 await b2.waitForFunction(()=>!document.querySelector('.mention-notifications'),null,{timeout:30000});
 await b.reload();await ready(b);const read=await request(b,{type:'mentions_get'},'mentions_snapshot');assert.equal(read.notifications.length,0);
 console.log('Offline delivery, old-message navigation, per-user read acknowledgement and cross-browser synchronization passed');
 await panel.getByRole('button',{name:'댓글 닫기'}).click();
 const items={
  'bp-run':{kind:'shape',shapeType:'rectangle',runtimeRole:'executor',x:50,y:180,width:340,height:180,permission:'default'},
  'bp-python':{kind:'text',renderMode:'code',language:'python',filename:'first.py',text:'print("BLUEPRINT FIRST")\nopen("blueprint-shared.txt","w").write("shared")',x:480,y:180,width:440,height:220,permission:'default'},
  'bp-js':{kind:'text',renderMode:'code',language:'javascript',filename:'second.js',text:'console.log("BLUEPRINT SECOND",require("fs").readFileSync("blueprint-shared.txt","utf8"))',x:480,y:510,width:440,height:200,permission:'default'},
  'bp-out':{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:1040,y:180,width:440,height:260,permission:'default'},
  'bp-mirror':{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:1040,y:540,width:440,height:260,permission:'default'},
  'bp-disconnected':{kind:'shape',shapeType:'rectangle',runtimeRole:'output',x:50,y:560,width:330,height:230,permission:'default'},
  'bp-edge1':{kind:'connector',from:'bp-run',to:'bp-python',permission:'default'},
  'bp-edge2':{kind:'connector',from:'bp-python',to:'bp-js',permission:'default'},
  'bp-edge3':{kind:'connector',from:'bp-python',to:'bp-out',permission:'default'},
  'bp-edge4':{kind:'connector',from:'bp-js',to:'bp-out',permission:'default'},
  'bp-edge5':{kind:'connector',from:'bp-out',to:'bp-mirror',permission:'default'}
 };
 await apply(a,items);
 await b.waitForFunction(()=>window.frelogCanvas.read().items['bp-run']?.runtimeRole==='executor',null,{timeout:30000});
 const node=(page,id)=>page.locator(`.canvas-object[data-item-id="${id}"]`);
 assert.equal(await node(a,'bp-python').getByRole('button',{name:'실행',exact:true}).count(),0);
 assert.equal(await node(a,'bp-out').locator('.blueprint-results').count(),0);
 await node(a,'bp-run').getByRole('button',{name:'코드 실행',exact:true}).click();
 for(const page of [a,b,b2])for(const id of ['bp-out','bp-mirror']){
  await node(page,id).getByText('BLUEPRINT FIRST',{exact:true}).waitFor({timeout:60000});
  await node(page,id).getByText('BLUEPRINT SECOND shared',{exact:true}).waitFor({timeout:60000});
 }
 assert.equal(await node(a,'bp-disconnected').locator('.blueprint-results').count(),0);
 await node(a,'bp-run').getByText('실행 완료',{exact:true}).waitFor({timeout:30000});
 console.log('Execution node, ordered multi-language execution, chained result nodes and shared persisted results passed');
 await b.reload();await ready(b);await node(b,'bp-mirror').getByText('BLUEPRINT SECOND shared',{exact:true}).waitFor({timeout:30000});
 await node(a,'bp-python').locator('.syntax-code-preview').dblclick();const editor=node(a,'bp-python').locator('.monaco-editor textarea.inputarea').first();await editor.waitFor({timeout:30000});await editor.focus();await a.keyboard.press('Control+A');await a.keyboard.insertText('print("BLUEPRINT EDITED")\nopen("blueprint-shared.txt","w").write("shared")');
 await a.waitForFunction(()=>window.frelogCanvas.read().items['bp-python'].text.includes('BLUEPRINT EDITED'),null,{timeout:10000});
 assert.equal(await node(a,'bp-out').getByText('BLUEPRINT FIRST',{exact:true}).count(),1);
 await node(a,'bp-run').getByRole('button',{name:'코드 실행',exact:true}).click();await node(b,'bp-mirror').getByText('BLUEPRINT EDITED',{exact:true}).waitFor({timeout:45000});await node(a,'bp-run').getByText('실행 완료',{exact:true}).waitFor({timeout:30000});assert.equal(await node(b,'bp-mirror').getByText('BLUEPRINT SECOND shared',{exact:true}).count(),1);
 await apply(a,{'bp-cycle':{kind:'connector',from:'bp-mirror',to:'bp-out',permission:'default'}});
 await node(a,'bp-run').getByRole('button',{name:'코드 실행',exact:true}).click();await node(a,'bp-run').getByRole('alert').getByText('블루프린트에 순환 연결이 있습니다.').waitFor({timeout:10000});
 await apply(a,{},['bp-cycle']);
 console.log('Reload persistence, live code editing, explicit rerun and cycle rejection passed');
 await bc.close();await b2c.close();
 console.log('ALL END-TO-END CHECKS PASSED');
}catch(error){for(let i=0;i<pages.length;i++){if(!pages[i].isClosed())await pages[i].screenshot({path:`/tmp/agora-completion-failure-${i}.png`}).catch(()=>{});}throw error}
finally{await browser.close()}
