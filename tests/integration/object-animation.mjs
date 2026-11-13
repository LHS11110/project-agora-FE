import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://localhost:5191')+'/tests/browser/object-animation.html');await page.locator('.animated-vector-surface canvas').nth(119).waitFor();
 await page.evaluate(()=>{window.savedCanvases=[...document.querySelectorAll('.animated-vector-surface canvas')];window.animationFixture.play({future:200});});
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.animated-vector-surface canvas')].filter((canvas,i)=>canvas===window.savedCanvases[i]).length),120,'playback reuses every cached raster');
 await page.waitForTimeout(400);
 const timing=await page.evaluate(()=>{const now=Date.now(),animations=document.getAnimations().filter(a=>a.id.startsWith('portfolio:'));return animations.map(a=>({time:a.currentTime,start:a.startTime,rate:a.playbackRate,now}));});
 assert.equal(timing.length,120);assert.ok(Math.max(...timing.map(a=>a.start))-Math.min(...timing.map(a=>a.start))<40,'batch shares the same timeline');
 assert.ok(timing.every(a=>a.rate===1&&a.time>100&&a.time<600));
 await page.evaluate(()=>window.animationFixture.move());await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.animated-vector-surface canvas')].filter((canvas,i)=>canvas===window.savedCanvases[i]).length),120,'moving retains the raster');
 await page.evaluate(()=>window.animationFixture.color());await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>document.querySelector('.animated-vector-surface canvas')!==window.savedCanvases[0]),true,'appearance edits refresh pixels');
 await page.waitForFunction(()=>document.getAnimations().filter(a=>a.id.startsWith('portfolio:')).every(a=>a.playState==='finished'),{},{timeout:1800});
 await page.evaluate(()=>{window.animationFixture.play({future:0});const until=performance.now()+250;while(performance.now()<until){/* Simulate unrelated main-thread work after playback is scheduled. */}});
 await page.waitForTimeout(60);assert.ok(await page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('portfolio:')).every(a=>a.currentTime>=250)),'main-thread work must not extend the playback timeline');
 await page.evaluate(()=>window.animationFixture.play({future:-600,config:{loop:true,delay:100}}));await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('portfolio:')).every(a=>a.currentTime>=650)),'late recipients catch up including delay');
 await page.evaluate(()=>window.animationFixture.stop());assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('portfolio:')).length),0);assert.deepEqual(errors,[]);
 console.log('PASS 120 shared animations: 120/120 rasters reused, aligned timeline, one-second duration, position reuse, appearance invalidation, main-thread stall recovery, late looping playback and stop');
}finally{await browser.close();}
