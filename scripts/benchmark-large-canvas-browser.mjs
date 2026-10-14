import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Optional dependency: install playwright-core, or point to an existing module.
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright-core');
const baseUrl = process.env.BENCHMARK_URL || 'https://127.0.0.1';
const workload=process.env.BENCHMARK_WORKLOAD,mixedText=Boolean(process.env.MIXED_TEXT);
const assetOrigin = process.env.BENCHMARK_ASSET_ORIGIN;
const token = process.env.BENCHMARK_TOKEN;
const user = JSON.parse(process.env.BENCHMARK_USER_JSON || 'null');
const canvasId = Number(process.env.BENCHMARK_CANVAS_ID);
const counts = (process.env.OBJECT_COUNTS || '100000,200000,500000').split(',').map(Number);
const scenarios = (process.env.SCENARIOS || 'distributed,dense').split(',');
const frameCount = Number(process.env.FRAME_SAMPLES || 300);
const panDelta = Number(process.env.PAN_DELTA || 3), zoomDelta = Number(process.env.ZOOM_DELTA || .6);
const timeout = Number(process.env.PREPARATION_TIMEOUT_MS || 120000);
const output = process.env.BENCHMARK_OUTPUT || '/tmp/agora-hundred-thousand-benchmark.json';
if (!token || !user || !Number.isSafeInteger(canvasId) || canvasId <= 0) {
  throw new Error('Provide BENCHMARK_TOKEN, BENCHMARK_USER_JSON and an isolated BENCHMARK_CANVAS_ID.');
}
if (counts.some(n => !Number.isSafeInteger(n) || n <= 0) || !Number.isInteger(frameCount) || frameCount < 60 || !Number.isFinite(timeout) || timeout <= 0 || !Number.isFinite(panDelta) || panDelta <= 0 || !Number.isFinite(zoomDelta) || zoomDelta <= 0) {
  throw new Error('Invalid object count, frame sample count or preparation timeout.');
}
if (scenarios.some(s => !['dense', 'distributed'].includes(s))) throw new Error('Unknown scenario');

function installFixture({ count, scenario, workload, mixedText }) {
  const NativeWebSocket = window.WebSocket;
  const columns = Math.ceil(Math.sqrt(count * 1.2)), rows = Math.ceil(count / columns);
  const dense = scenario === 'dense';
  const transformed = new WeakSet();
  // Generate in the browser: a 500k-object JSON must not pass through CDP's
  // automation transport. Native connection, authentication and app parsing remain.
  window.WebSocket = class extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => {
        if (transformed.has(event)) return;
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data?.type !== 'init_items') return;
        event.stopImmediatePropagation();
        const items = {};
        for (let i = 0; i < count; i++) items['s' + i] = {
          kind: 'shape', shapeType: 'rectangle',
          x: (100 + i % columns * (dense ? 1200 / columns : 160)) / 1600,
          y: (220 + Math.floor(i / columns) * (dense ? 700 / rows : 120)) / 1000,
          width: (dense ? 960 / columns : 110) / 1600,
          height: (dense ? 500 / rows : 80) / 1000,
          fill: i % 2 ? '#dcefe5' : '#e7def8', strokeEnabled: false,
          shadowEnabled: false, visualStyle: 'standard',
        };
        if(mixedText)for(let i=0;i<count-1;i++)if(i%3===0){const old=items['s'+i];items['s'+i]={kind:'text',text:'Label '+i,renderMode:'plain',x:old.x,y:old.y,width:old.width,height:old.height,fontSize:2,shadowEnabled:false,permission:'default'};}
        if(workload==='text')items['s'+(count-1)]={kind:'text',text:'Editable text',renderMode:'plain',x:500/1600,y:500/1000,width:400/1600,height:120/1000,fontSize:24,depth:1,shadowEnabled:false,permission:'default'};
        const json = JSON.stringify({ ...data, items });
        window.__agoraBenchmark = { initialized: true, jsonCharacters: json.length };
        const replacement = new MessageEvent('message', { data: json, origin: event.origin });
        transformed.add(replacement); this.dispatchEvent(replacement);
      });
    }
    send(message) {
      let data; try { data = JSON.parse(message); } catch { /* binary or non-JSON */ }
      // Never publish fixtures or edited fixture data to the real broker.
      if(workload && data?.type==='host_item_batch'){
        window.__agoraBenchmark.saves ||= [];window.__agoraBenchmark.saves.push(data);
        queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'host_batch_result',request_id:data.request_id,ok:true})})));return;
      }
      if (data?.type !== 'canvas_relay') super.send(message);
    }
  };
}
async function snapshot(page) {
  return page.evaluate(() => ({
    footer: document.querySelector('.board-footer')?.textContent,
    layers: [...document.querySelectorAll('.vector-layer')].map(e => ({
      ...e.__agoraRenderStats, renderer: e.dataset.renderer, compositor: e.dataset.compositor,
    })),
  }));
}
async function measure(page, motion) {
  return page.evaluate(async ({ motion, frameCount, panDelta, zoomDelta }) => {
    const stage = document.querySelector('.canvas-stage'), bounds = stage.getBoundingClientRect();
    const layers = () => [...document.querySelectorAll('.vector-layer')];
    const renderedFrames = () => layers().reduce((n, e) => n + (e.__agoraRenderStats?.frames || 0), 0);
    await new Promise(requestAnimationFrame);
    const renderedBefore = renderedFrames(), intervals = [];
    let last = performance.now();
    for (let i = 0; i < frameCount; i++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now(); intervals.push(now - last); last = now;
      const direction = i % 120 < 60 ? 1 : -1;
      stage.dispatchEvent(new WheelEvent('wheel', {
        deltaX: motion === 'pan' ? panDelta * direction : 0,
        deltaY: motion === 'zoom' ? -zoomDelta * direction : 0,
        ctrlKey: motion === 'zoom', clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2, bubbles: true, cancelable: true,
      }));
    }
    const elapsedMs = intervals.reduce((a, b) => a + b, 0);
    const sorted = [...intervals].sort((a, b) => a - b);
    return {
      fps: frameCount * 1000 / elapsedMs, elapsedMs, samples: frameCount,
      p50Ms: sorted[Math.floor(frameCount * .5)], p95Ms: sorted[Math.floor(frameCount * .95)],
      maxMs: Math.max(...intervals), over33ms: intervals.filter(ms => ms > 1000 / 30).length,
      rendererFrames: renderedFrames() - renderedBefore,
      domObjects: document.querySelectorAll('[data-item-id]').length,
      domNodes: document.querySelectorAll('*').length,
      layers: layers().map(e => ({ ...e.__agoraRenderStats, renderer: e.dataset.renderer })),
    };
  }, { motion, frameCount, panDelta, zoomDelta });
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-features=LocalNetworkAccessChecks', '--enable-gpu',
    '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist',
    ...(process.env.HOST_RESOLVER_RULES ? ['--host-resolver-rules=' + process.env.HOST_RESOLVER_RULES] : [])],
});
const report = { startedAt: new Date().toISOString(), baseUrl, viewport: { width: 1800, height: 1100 },
  assetOrigin: assetOrigin || baseUrl,
  deviceScaleFactor: 1, chrome: browser.version(), preparationTimeoutMs: timeout,
  sourceRevision: process.env.BENCHMARK_REVISION || null, workload:workload || 'camera', motion: { panDelta, zoomDelta, frameCount },
  threshold: { minimumAverageFps: 30, maximumP95Ms: 1000 / 30, maximumFrameMs: 1000 / 30 }, results: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: report.viewport, deviceScaleFactor: 1 });
  if (assetOrigin) await context.route(baseUrl + '/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/wss/')) return route.continue();
    const response = await route.fetch({ url: assetOrigin + url.pathname + url.search });
    await route.fulfill({ response });
  });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('agora_token', token); localStorage.setItem('agora_user', JSON.stringify(user));
  }, { token, user });
  for (const count of counts) for (const scenario of scenarios) {
    const page = await context.newPage();
    await page.addInitScript(installFixture, { count, scenario, workload, mixedText });
    let pageCrashed = false;
    page.on('crash', () => { pageCrashed = true; console.log('Renderer crashed:', count, scenario); });
    page.on('pageerror', e => console.log('Page error:', e.message));
    const start = Date.now(); await page.goto(baseUrl + '/canvases/' + canvasId);
    const progress = []; let progressBusy = false;
    const heartbeat = setInterval(async () => {
      if (progressBusy) return; progressBusy = true;
      try {
        const entry = { elapsedMs: Date.now() - start, ...await snapshot(page) };
        progress.push(entry); console.log('Preparation:', count, scenario, JSON.stringify(entry));
      } catch { /* page may close during pending diagnostics */ }
      finally { progressBusy = false; }
    }, 20000);
    const result = { objects: count, scenario, initialized: false, ready: false, progress };
    try {
      await page.waitForFunction(({ count: n, scenario }) => document.querySelector('.board-footer')?.textContent.includes('/' + n + '개')
        && [...document.querySelectorAll('.vector-layer')].some(e => e.__agoraRenderStats?.visibleObjects > 0)
        && [...document.querySelectorAll('.vector-layer')].every(e => e.__agoraRenderStats?.preparing === false)
        && (scenario !== 'dense' || [...document.querySelectorAll('.vector-layer')].reduce((total,e)=>total+(e.__agoraRenderStats?.visibleObjects||0),0) === n),
      { count, scenario }, { timeout, polling: 1000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.vector-layer')].some(e => e.dataset.renderer === 'webgl'), null, { timeout: 30000 });
      result.ready = true;
    } catch (error) { result.error = error.message; }
    finally { clearInterval(heartbeat); }
    try { result.fixture = await page.evaluate(() => window.__agoraBenchmark); }
    catch { /* crashed or disconnected page */ }
    result.initialized = Boolean(result.fixture?.initialized); result.loadAndPreparationMs = Date.now() - start;
    result.pageCrashed = pageCrashed;
    try { result.initialState = await snapshot(page); }
    catch (error) { result.error = result.error || error.message; result.ready = false; }
    if (result.ready) {
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1200);
      if(workload){
        for(const name of ['설정 패널 접기','채팅 패널 접기']){const button=page.getByRole('button',{name,exact:true});if(await button.isVisible())await button.click();}
        if(workload==='draw'){await page.getByRole('button',{name:'모두 열기',exact:true}).click();await page.getByRole('button',{name:'드로잉',exact:true}).click();const tool=page.getByRole('button',{name:'툴 패널 접기',exact:true});if(await tool.isVisible())await tool.click();}
        else{
          const tool=page.getByRole('button',{name:'툴 패널 접기',exact:true});if(await tool.isVisible())await tool.click();
          const point=await page.evaluate(()=>{const stage=document.querySelector('.canvas-stage').getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(document.querySelector('.canvas-world-layer')).transform);return{x:stage.x+m.m41+550*m.a,y:stage.y+m.m42+530*m.a}});
          await page.mouse.dblclick(point.x,point.y);await page.getByRole('textbox',{name:'텍스트 직접 수정',exact:true}).waitFor();
        }
        await page.waitForTimeout(700);
        let profiler;if(process.env.CPU_PROFILE){profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
        result.interaction=await page.evaluate(async({frameCount,workload})=>{
          const stage=document.querySelector('.canvas-stage'),rect=stage.getBoundingClientRect(),times=[];
          const world=new DOMMatrix(getComputedStyle(document.querySelector('.canvas-world-layer')).transform);
          const pointer=(type,i)=>stage.dispatchEvent(new PointerEvent(type,{pointerId:9,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,pressure:.5,clientX:rect.x+world.m41+(350+i*2)*world.a,clientY:rect.y+world.m42+(400+Math.sin(i/15)*60)*world.a,bubbles:true,cancelable:true}));
          const input=document.querySelector('textarea[aria-label="텍스트 직접 수정"]');
          const setValue=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
          if(workload==='draw'){const capture=stage.setPointerCapture.bind(stage);stage.setPointerCapture=id=>{if(id!==9)capture(id);};pointer('pointerdown',0);await new Promise(resolve=>setTimeout(resolve,700));}
          await new Promise(requestAnimationFrame);let previous=performance.now();
          for(let i=0;i<frameCount;i++){
            await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-previous);previous=now;
            if(workload==='draw')pointer('pointermove',i+1);
            else{setValue.call(input,'Editable text '+ 'a'.repeat(i+1));input.dispatchEvent(new Event('input',{bubbles:true}));}
          }
          if(workload==='draw')pointer('pointerup',frameCount);
          const sorted=[...times].sort((a,b)=>a-b);
          return {fps:frameCount*1000/times.reduce((a,b)=>a+b,0),p95Ms:sorted[Math.floor(frameCount*.95)],maxMs:Math.max(...times),over33ms:times.filter(t=>t>1000/30).length,samples:frameCount,
            layers:[...document.querySelectorAll('.vector-layer')].map(e=>({...e.__agoraRenderStats})),saves:window.__agoraBenchmark.saves?.length||0,finalInput:input?.value};
        },{frameCount,workload});
        if(profiler){const {profile}=await profiler.send('Profiler.stop');fs.writeFileSync(process.env.CPU_PROFILE,JSON.stringify(profile));await profiler.detach();}
        await page.waitForTimeout(500);
        result.finalSaves=await page.evaluate(()=>window.__agoraBenchmark.saves?.map(batch=>batch.changes.map(c=>({kind:c.item?.kind,text:c.item?.text,complete:c.item?.complete,points:c.item?.points?.length}))).flat());
        if(workload==='text' && result.finalSaves?.at(-1)?.text!==result.interaction.finalInput)throw new Error('Typing benchmark did not reach the host persistence pipeline');
        if(workload==='draw' && !result.finalSaves?.some(item=>item.complete && item.points>frameCount/2))throw new Error('Drawing benchmark did not finalize a complete saved stroke');
      }else{
        result.pan = await measure(page, 'pan'); await page.waitForTimeout(800);
        result.zoom = await measure(page, 'zoom');
        result.passesAverageAndP9530Fps = [result.pan, result.zoom].every(r => r.fps >= 30 && r.p95Ms <= 1000 / 30);
        result.passesEverySample30Fps = [result.pan, result.zoom].every(r => r.maxMs <= 1000 / 30);
        result.passes30Fps = result.passesAverageAndP9530Fps && result.passesEverySample30Fps;
      }
    } else {
      result.passesAverageAndP9530Fps = result.passesEverySample30Fps = result.passes30Fps = false;
    }
    report.results.push(result); save(); console.log('Result:', JSON.stringify(result));
    await page.close();
  }
} finally { save(); await browser.close(); }
