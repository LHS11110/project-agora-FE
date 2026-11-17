import fs from 'node:fs/promises';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const out=process.env.BENCH_OUTPUT||'/tmp/agora-iframe-before.json',browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']});
const percentile=(values,p)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0;};
const results=[];
try{for(const kind of ['html','youtube','notebook']){
 const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}}),cdp=await page.context().newCDPSession(page);
 // Deterministic same-origin-sized mock content: no variable YouTube network latency.
 await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<body style="background:#18222d;color:white"><h2>Video tutorial</h2><p>Deterministic player fixture</p></body>'}));
 await page.route('https://i.ytimg.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#245"/></svg>'}));
 const chunks=[];cdp.on('Tracing.dataCollected',({value})=>chunks.push(...value));
 await cdp.send('LayerTree.enable');let layers=[],maxLayers=0;cdp.on('LayerTree.layerTreeDidChange',event=>{if(event.layers?.length){layers=event.layers;maxLayers=Math.max(maxLayers,layers.length);}});
 await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline',options:'record-as-much-as-possible'});
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://127.0.0.1:5191')+`/tests/browser/iframe-navigation.html?kind=${kind}`);await page.waitForFunction(()=>window.iframeFixture);await cdp.send('LayerTree.enable');await page.waitForTimeout(1200);
 const motion=await page.evaluate(async()=>{const frames=[],fixture=window.iframeFixture;fixture.metrics.renders=[];fixture.metrics.commits=[];const initialIframes=fixture.metrics.iframeCreated;performance.mark('navigation-benchmark:start');const start=performance.now();let last=start;await new Promise(resolve=>{function tick(now){frames.push(now-last);last=now;const t=now-start;fixture.setCamera(t<2400?{x:-t*.85,y:-100,scale:1}:{x:-2000,y:-100,scale:1+Math.sin((t-2400)/180)*.4});if(t<4800)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});performance.mark('navigation-benchmark:end');return {frames,motionIframeCreated:fixture.metrics.iframeCreated-initialIframes,elapsed:performance.now()-start,...fixture.metrics,activeIframes:document.querySelectorAll('iframe').length,domObjects:document.querySelectorAll('[data-item-id]').length};});
 const ended=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await ended;
 const startMarker=chunks.find(event=>event.name==='navigation-benchmark:start'),endMarker=chunks.find(event=>event.name==='navigation-benchmark:end');const mainThread=startMarker?.tid;
 const events=chunks.filter(event=>event.ph==='X'&&event.tid===mainThread&&event.ts>=startMarker.ts&&event.ts<=endMarker.ts);
 const phases={};for(const name of ['Layout','UpdateLayoutTree','Paint','Layerize']){const durations=events.filter(event=>event.name===name).map(event=>event.dur/1000);phases[name]={count:durations.length,totalMs:durations.reduce((a,b)=>a+b,0),p95Ms:percentile(durations,.95),maxMs:Math.max(0,...durations)};}
 results.push({kind,fixture:'72 objects; 1280x900; Chromium hardware GPU; 4.8s pan and zoom; deterministic player and thumbnail responses',fps:motion.frames.length*1000/motion.elapsed,frameP95Ms:percentile(motion.frames,.95),frameMaxMs:Math.max(...motion.frames),over25:motion.frames.filter(v=>v>25).length,over33:motion.frames.filter(v=>v>33.3).length,iframeCreated:motion.iframeCreated,motionIframeCreated:motion.motionIframeCreated,maxIframes:motion.maxIframes,activeIframes:motion.activeIframes,domObjects:motion.domObjects,renderP95Ms:percentile(motion.renders,.95),commitToProfilerP95Ms:percentile(motion.commits,.95),compositorLayers:layers.length,maxCompositorLayers:maxLayers,phases});
 await fs.writeFile(out.replace('.json',`-${kind}.trace.json`),JSON.stringify({traceEvents:chunks}));await page.close();
 }await fs.writeFile(out,JSON.stringify({browser:browser.version(),recordedAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
