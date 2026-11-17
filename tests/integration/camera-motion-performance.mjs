const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist',...(process.env.UNTHROTTLED?['--disable-frame-rate-limit','--disable-gpu-vsync']:[])]});
try{
 const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5191')+'/tests/browser/camera-motion.html?count='+(process.env.OBJECT_COUNT||20000));
 await page.waitForFunction(()=>{const s=document.querySelector('.vector-layer')?.__agoraRenderStats;return s?.engine==='rust-wgpu'&&s.renderThread==='worker'&&s.gpuWorkerFrames>0&&!s.preparing&&s.visibleObjects===window.cameraFixture?.count;},null,{timeout:120000}).catch(error=>{console.error(errors);throw error;});
 const results=[];
 for(const scenario of ['pan','zoom']){
  await page.evaluate(()=>window.cameraFixture.setCamera({x:0,y:0,scale:1}));await page.waitForTimeout(300);
  results.push(await page.evaluate(scenario=>new Promise(resolve=>{
   const el=document.querySelector('.vector-layer'),s=el.__agoraRenderStats,frames=[],work=[];
   const stage=document.querySelector('.canvas-stage');let entered=0;
   const before=()=>{entered=performance.now();},after=()=>work.push(performance.now()-entered);
   stage.addEventListener('agora-camera',before,true);stage.addEventListener('agora-camera',after);
   const start=performance.now(),initial={commits:cameraFixture.commits,frames:s.frames,rasters:s.rasterizations,workerFrames:s.gpuWorkerFrames||0};let last=start;
   function tick(now){frames.push(now-last);last=now;const t=now-start;
    cameraFixture.setCamera(scenario==='pan'?{x:Math.sin(t/900)*200,y:Math.cos(t/1000)*100,scale:1}:{x:0,y:0,scale:1.1+Math.sin(t/700)*.15});
    if(t<3000)requestAnimationFrame(tick);else{
     stage.removeEventListener('agora-camera',before,true);stage.removeEventListener('agora-camera',after);
     const sorted=frames.slice().sort((a,b)=>a-b),sortedWork=work.slice().sort((a,b)=>a-b);
     resolve({scenario,objects:cameraFixture.count,renderThread:s.renderThread,workerFrames:(s.gpuWorkerFrames||0)-initial.workerFrames,rafHz:frames.length*1000/t,p95FrameMs:sorted[Math.floor(sorted.length*.95)],cameraP95Ms:sortedWork[Math.floor(sortedWork.length*.95)],commits:cameraFixture.commits-initial.commits,presented:s.frames-initial.frames,rasterizations:s.rasterizations-initial.rasters});
    }
   }requestAnimationFrame(tick);
  }),scenario));
 }
 assert.deepEqual(errors,[]);for(const r of results)assert.ok(r.presented>10,'camera actually rendered');console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
