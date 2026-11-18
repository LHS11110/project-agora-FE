import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
const results=[];try{for(const count of (process.env.COUNTS||'20000,200000').split(',').map(Number)){
 const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5195')+`/tests/browser/camera-motion.html?count=${count}`);
 await page.waitForFunction(()=>{const s=document.querySelector('.vector-layer')?.__agoraRenderStats;return s?.renderThread==='worker'&&s.gpuWorkerFrames>0&&!s.preparing&&s.visibleObjects===cameraFixture.count;},null,{timeout:120000});
 for(const motion of ['pan','zoom']){
  const result=await page.evaluate(async({motion,direct})=>{const layer=document.querySelector('.vector-layer'),stats=layer.__agoraRenderStats,renderer=layer.__agoraGpuRenderer;renderer.telemetry?.samples.splice(0);const initial=stats.gpuWorkerFrames,start=performance.now();let inputs=0,raf=0,last=start;const gaps=[];let done=false;
   const input=setInterval(()=>{const t=performance.now()-start;inputs++;const camera=motion==='pan'?{x:Math.sin(t/400)*200,y:Math.cos(t/500)*100,scale:1}:{x:0,y:0,scale:1.15+Math.sin(t/400)*.2};if(direct)renderer.render_frame(camera.x,camera.y,camera.scale,1200,800);else cameraFixture.setCamera(camera);},1000/120);
   const frame=now=>{gaps.push(now-last);last=now;raf++;if(!done)requestAnimationFrame(frame);};requestAnimationFrame(frame);
   await new Promise(resolve=>setTimeout(resolve,4000));clearInterval(input);done=true;const elapsed=performance.now()-start;const sorted=gaps.slice().sort((a,b)=>a-b);return{motion,elapsed,inputHz:inputs*1000/elapsed,completed:stats.gpuWorkerFrames-initial,workerFps:(stats.gpuWorkerFrames-initial)*1000/elapsed,screenRafHz:raf*1000/elapsed,p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:Math.max(...gaps),renderer:stats.engine,thread:stats.renderThread,telemetry:renderer.telemetry?{...renderer.telemetry,samples:renderer.telemetry.samples.slice()}:null};},{motion,direct:process.env.DIRECT==='1'});
  results.push({objects:count,...result});await page.waitForTimeout(350);
 }
 assert.deepEqual(errors,[]);await page.close();}
 if(process.env.MIN_WORKER_FPS)for(const result of results)assert.ok(result.workerFps>=Number(process.env.MIN_WORKER_FPS),`${result.objects} ${result.motion}: ${result.workerFps} < ${process.env.MIN_WORKER_FPS}`);
 const out=process.env.BENCH_OUTPUT||'/tmp/worker-throughput-before.json';await fs.writeFile(out,JSON.stringify({browser:browser.version(),results},null,2));console.log(JSON.stringify(results.map(({telemetry,...r})=>r),null,2));}finally{await browser.close();}
