// Frame pacing while a peer drags objects and the local camera pans.
// MODES=spread,change COUNTS=20000 node tests/performance/peer-updates.mjs
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist','--enable-blink-features=LongAnimationFrameTiming']});
const results=[];
try{for(const count of (process.env.COUNTS||'20000').split(',').map(Number))for(const mode of (process.env.MODES||'spread,change').split(',')){
 const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5191')+`/tests/browser/peer-updates.html?count=${count}&mode=${mode}`);
 await page.waitForFunction(()=>{const s=document.querySelector('.vector-layer')?.__agoraRenderStats;return s?.gpuWorkerFrames>0&&!s.preparing;},null,{timeout:120000});
 await page.waitForTimeout(500);
 results.push(await page.evaluate(()=>new Promise(resolve=>{
  const loafs=[];const po=new PerformanceObserver(list=>{for(const e of list.getEntries())loafs.push({start:e.startTime,duration:e.duration,blocking:e.blockingDuration,scripts:(e.scripts||[]).map(s=>({fn:s.sourceFunctionName,src:(s.sourceURL||'').split('/').slice(-1)[0],invoker:s.invoker,ms:Math.round(s.duration)}))});});
  try{po.observe({type:'long-animation-frame',buffered:false});}catch{}
  const gaps=[],peer=[];const start=performance.now();let last=start;
  function tick(now){gaps.push({at:now-start,ms:now-last});last=now;const t=now-start;
   peerFixture.setCamera({x:Math.sin(t/900)*200,y:Math.cos(t/1000)*100,scale:1});
   const a=performance.now();peerFixture.peerMove(t);peer.push(performance.now()-a);
   if(t<4000)requestAnimationFrame(tick);else{po.disconnect();
    const ms=gaps.map(g=>g.ms).sort((a,b)=>a-b),p=peer.slice().sort((a,b)=>a-b),pick=(s,q)=>+s[Math.floor(s.length*q)].toFixed(1);
    resolve({mode:peerFixture.mode,objects:peerFixture.count,rafHz:+(gaps.length*1000/t).toFixed(1),p95FrameMs:pick(ms,.95),p99FrameMs:pick(ms,.99),maxFrameMs:+ms.at(-1).toFixed(1),framesOver25ms:ms.filter(x=>x>25).length,peerP50Ms:pick(p,.5),peerP95Ms:pick(p,.95),longFrames:loafs.length,worstLoaf:loafs.sort((a,b)=>b.duration-a.duration).slice(0,3)});
   }}requestAnimationFrame(tick);
 })));
 if(errors.length)console.error(errors);await page.close();
}console.log(JSON.stringify(results,null,2));}finally{await browser.close();}
