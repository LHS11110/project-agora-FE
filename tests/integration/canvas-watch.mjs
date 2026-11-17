import {chromium} from '/tmp/agora-ui-verify/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try { for(const width of [390,1280]) {
 const p=await b.newPage({ignoreHTTPSErrors:true,viewport:{width,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('https://127.0.0.1:5191/tests/browser/canvas-watch.html');await p.getByText('공유 캔버스',{exact:true}).waitFor();
 await p.evaluate(()=>{const users=[{id:'me',nickname:'나',tag_number:1},{id:'peer',nickname:'발표자',tag_number:2}];window.watchTest.receive({type:'canvas_watch_state',self_id:'me',watching_id:null,users});window.watchTest.receive({type:'canvas_watch_invite',presenter:users[1]});});
 assert.equal(await p.getByRole('button',{name:'수락하고 관전',exact:true}).count(),0);
 await p.getByRole('button',{name:/현재 접속 중인 사용자/}).click();assert.equal(await p.getByRole('button',{name:'발표 시작',exact:true}).count(),0);
 await p.getByRole('button',{name:'관전하기',exact:true}).click();await p.getByText('발표자 관전 중',{exact:true}).waitFor();
 assert.equal(await p.locator('.canvas-watch-shield').count(),1);
 assert(await p.evaluate(()=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100});document.querySelector('[data-testid="board"]').dispatchEvent(e);return e.defaultPrevented;}));
 await p.getByRole('button',{name:'관전 종료',exact:true}).click();await p.waitForFunction(()=>window.watchTest.camera.scale===1&&window.watchTest.camera.x===20);assert.deepEqual(errors,[]);await p.close();
 } console.log('PASS: manual watch, view restoration, and removed presentation UI on desktop/mobile'); } finally {await b.close();}
