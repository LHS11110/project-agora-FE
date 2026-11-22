// Canvas frame benchmark: measures frame pacing per object kind and records where
// main-thread time goes (rendering-pipeline stage, style/layout invalidation
// sources, JS functions). The real editor page runs against a mocked API and
// broker, so no backend or account is required.
//
//   npx vite build --sourcemap && npx vite preview --port 5199 --strictPort
//   PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs \
//   BENCHMARK_OUTPUT=docs/benchmarks/canvas-frames.json \
//   node scripts/benchmark-canvas-frames-browser.mjs
//
// Environment:
//   BENCHMARK_URL      preview origin (default https://localhost:5199)
//   CHROME_PATH        browser binary (default /usr/bin/google-chrome)
//   SCENARIOS          comma list (default: every scenario below)
//   REPEAT             frame-measurement repetitions per scenario (default 3)
//   THROTTLE           CPU slowdown factor via CDP (default 1)
//   ATTRIBUTION        1 = also trace each scenario once for causes (default 1)
//   SOURCEMAP_DIR      built assets with .map files (default dist/assets)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { SourceMap } from 'node:module';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright-core');
const origin = process.env.BENCHMARK_URL || 'https://localhost:5199';
const repeat = Number(process.env.REPEAT || 3);
const throttle = Number(process.env.THROTTLE || 1);
const attribution = process.env.ATTRIBUTION !== '0';
const sourcemapDir = path.resolve(process.env.SOURCEMAP_DIR || 'dist/assets');
const output = process.env.BENCHMARK_OUTPUT || '/tmp/agora-canvas-frames.json';
const CANVAS_ID = 999088;
const VIEWPORT = { width: 1800, height: 1100 };
const LATE_FRAME_MS = 25;

// ---------------------------------------------------------------- fixtures
const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
const token = `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 7200, sid: 'bench', tokenUse: 'access' })}.bench`;
const user = { user_id: 7, email: 'bench@example.invalid', nickname: 'Bench', tag_number: 1, role: 'ROLE_USER', status: 'ACTIVE' };
const style = (envelope) => `style1:${JSON.stringify(envelope)}`;
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** Three-page vector PDF (curves + text) without external tooling. */
function buildPdf(pageCount = 3) {
  const objects = [];
  const add = (body) => objects.push(body) && objects.length;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(null); // pages, filled below
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  for (let p = 0; p < pageCount; p++) {
    let stream = 'q 1 w\n';
    for (let k = 0; k < 6; k++) {
      stream += `${(0.15 * k).toFixed(2)} 0.35 ${(0.9 - 0.12 * k).toFixed(2)} RG\n`;
      for (let i = 0; i <= 400; i++) {
        const x = 50 + i * 1.25, y = 640 + Math.sin(i / 18 * (k + 1) + p) * Math.exp(-i / 320) * 110;
        stream += `${x.toFixed(2)} ${y.toFixed(2)} ${i ? 'l' : 'm'}\n`;
      }
      stream += 'S\n';
    }
    stream += `BT /F${font} 9 Tf 50 470 Td 12 TL\n`;
    for (let line = 0; line < 30; line++) stream += `(Line ${line}: lorem ipsum dolor sit amet, consectetur adipiscing page ${p + 1}) Tj T*\n`;
    stream += 'ET Q';
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F${font} ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => { const at = Buffer.byteLength(pdf); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

/** Photo-like PNGs drawn by the browser (gradient, pattern, noise). */
async function buildImages(browser) {
  const page = await browser.newPage();
  const draw = (w, h) => page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, n = Math.random() * 40;
      img.data[i] = x / w * 255 + n; img.data[i + 1] = y / h * 255 + n; img.data[i + 2] = 128 + 127 * Math.sin(x / 37) * Math.cos(y / 23) + n; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); return c.toDataURL('image/png').split(',')[1];
  }, [w, h]);
  const photo = Buffer.from(await draw(1600, 1200), 'base64'), thumb = Buffer.from(await draw(480, 360), 'base64');
  await page.close();
  return { photo, thumb };
}

const pythonCode = Array.from({ length: 60 }, (_, i) => i % 6 === 0 ? `def step_${i}(values, alpha=0.5):` : `    total_${i} = sum(v * alpha for v in values if v > ${i})  # running ${i}`).join('\n');
const objectMakers = {
  image: (i) => ({ kind: 'image', src: `/api/canvases/${CANVAS_ID}/images/i${i}.png`, filename: `photo${i}.png` }),
  pdf: (i) => ({ kind: 'pdf', src: `/api/canvases/${CANVAS_ID}/pdfs/${uuid(i)}`, filename: `report${i}.pdf` }),
  code: () => ({ kind: 'text', renderMode: 'code', language: 'python', filename: 'model.py', text: pythonCode }),
  drawing: () => ({ kind: 'stroke', color: '#2563eb', strokeWidth: 4, brush: 'pen', opacity: 1, simulatePressure: true, complete: true }),
  table: () => ({ kind: 'table', columns: ['이름', '값', '단위', '비고', '상태'], rows: Array.from({ length: 10 }, (_, r) => [`항목 ${r}`, String(r * 3.14), 'kg', '메모 텍스트', r % 2 ? '완료' : '진행']) }),
  notebook: () => ({ kind: 'shape', shapeType: 'rectangle', runtimeRole: 'notebook', notebookResults: {}, notebookCells: [
    { id: crypto.randomUUID(), cellType: 'markdown', source: '# 분석\n데이터를 불러옵니다.' },
    { id: crypto.randomUUID(), cellType: 'code', source: pythonCode.split('\n').slice(0, 14).join('\n') },
    { id: crypto.randomUUID(), cellType: 'code', source: 'print(total)' }] }),
  youtube: (i) => ({ kind: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mediaType: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', title: `영상 ${i}`, mediaLoop: false }),
  markdown: () => ({ kind: 'text', renderMode: 'markdown', text: '## 회의 메모\n- 첫째 항목\n- **둘째** 항목\n\n| a | b |\n|---|---|\n| 1 | 2 |' }),
  value: () => ({ kind: 'value', title: '모드', valueType: 'select', valueMin: 0, valueMax: 100, valueStep: 1, valueNumber: 0, valueText: '', valueOptions: ['A', 'B', 'C'] }),
};

function gridOfKinds(kinds, count) {
  const items = {}, cols = kinds.length > 1 ? 8 : 4, cw = 0.135, ch = 0.21;
  let n = 0;
  for (const kind of kinds) for (let i = 0; i < count; i++, n++) {
    const x = 0.24 + (n % cols) * cw, y = 0.27 + Math.floor(n / cols) * ch;
    const item = { ...objectMakers[kind](i), x, y, width: cw * 0.9, height: ch * 0.9, permission: ['default'] };
    if (kind === 'drawing') item.points = Array.from({ length: 120 }, (_, k) => ({ x: x + (k / 119) * cw * 0.9, y: y + ch * 0.45 + Math.sin(k / 6 + i) * ch * 0.35 }));
    items[`${kind}${i}`] = item;
  }
  return items;
}

const HEAVY_STYLE = { cornerRadius: 14, fills: [{ type: 'linear', angle: 135, stops: [{ color: '#6366f1', pos: 0 }, { color: '#ec4899', pos: 100 }] }], stroke: { enabled: true, color: '#312e81', width: 2, dashPattern: 'dashed' },
  effects: [{ type: 'drop-shadow', color: '#000000', opacity: 0.3, x: 0, y: 8, blur: 20, spread: 2 }, { type: 'inner-shadow', color: '#ffffff', opacity: 0.4, y: 2, blur: 4 }, { type: 'background-blur', blur: 12 }], filters: { saturate: 140, contrast: 110 } };

function shapeField({ count = 240, distinctDepth = false, styled = 0, flow = 0 }) {
  const items = {}, cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const x = 0.02 + (i % cols) * (0.96 / cols), y = 0.02 + Math.floor(i / cols) * (0.96 / cols);
    const text = i % 3 === 0;
    const item = text
      ? { kind: 'text', renderMode: 'plain', text: `메모 ${i}\n두 번째 줄`, color: '#1e293b' }
      : { kind: 'shape', shapeType: i % 2 ? 'rectangle' : 'triangle', fill: '#cbd5e1', color: '#334155', strokeWidth: 2 };
    Object.assign(item, { x, y, width: 0.7 / cols, height: 0.55 / cols, permission: ['default'] });
    if (distinctDepth) item.depth = i + 1;
    if (i < styled) item.brush = style(HEAVY_STYLE);
    items[`o${i}`] = item;
  }
  for (let i = 0; i < flow; i++) items[`c${i}`] = { kind: 'connector', from: `o${i}`, to: `o${i + 1}`, color: '#6366f1', strokeWidth: 2, endHead: 'triangle', permission: ['default'], brush: style({ connector: { dashAnimation: 'forward' } }) };
  return items;
}

const SCENARIOS = {
  'empty': { label: '빈 캔버스', items: () => ({}) },
  'shapes-240': { label: '도형·텍스트 240개 (기본 깊이)', items: () => shapeField({}) },
  'shapes-240-depths': { label: '도형·텍스트 240개 (객체마다 다른 깊이)', items: () => shapeField({ distinctDepth: true }) },
  'styled-24': { label: '도형 240개 중 24개 고급 스타일(그림자·블러·필터)', items: () => shapeField({ styled: 24 }) },
  'flow-24': { label: '도형 240개 + 흐름 애니메이션 연결선 24개', items: () => shapeField({ flow: 24 }) },
  'image-8': { label: '이미지 8개 (1600×1200)', items: () => gridOfKinds(['image'], 8) },
  'pdf-8': { label: 'PDF 8개 (3쪽 벡터 문서)', items: () => gridOfKinds(['pdf'], 8) },
  'code-8': { label: '코드 객체 8개 (60줄)', items: () => gridOfKinds(['code'], 8) },
  'drawing-8': { label: '드로잉 8개 (120점)', items: () => gridOfKinds(['drawing'], 8) },
  'table-8': { label: '표 8개 (10행×5열)', items: () => gridOfKinds(['table'], 8) },
  'notebook-8': { label: '주피터 노트북 8개 (3셀)', items: () => gridOfKinds(['notebook'], 8) },
  'youtube-8': { label: '유튜브 링크 8개 (썸네일)', items: () => gridOfKinds(['youtube'], 8) },
  'youtube-live': { label: '유튜브 링크 8개, 재생 버튼 6회 클릭', items: () => gridOfKinds(['youtube'], 8), play: 6 },
  'markdown-8': { label: '마크다운 텍스트 8개', items: () => gridOfKinds(['markdown'], 8) },
  'value-select-8': { label: '선택형 값 객체 8개 (기본 select 사용)', items: () => gridOfKinds(['value'], 8) },
  'mixed-all': { label: '위 객체 종류 9가지 × 8개 혼합', items: () => gridOfKinds(['image', 'pdf', 'code', 'drawing', 'table', 'notebook', 'youtube', 'markdown', 'value'], 8) },
};
const selected = (process.env.SCENARIOS || Object.keys(SCENARIOS).join(',')).split(',');
for (const name of selected) if (!SCENARIOS[name]) throw new Error(`Unknown scenario ${name}`);

// --------------------------------------------------------------- browser
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'],
});
const assets = { ...(await buildImages(browser)), pdf: buildPdf() };

async function openScenario(name) {
  const scenario = SCENARIOS[name], items = scenario.items();
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR', ignoreHTTPSErrors: true });
  await ctx.addInitScript(({ user }) => {
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    localStorage.setItem('agora_user', JSON.stringify(user));
  }, { user });
  await ctx.route(/i\.ytimg\.com/, (r) => r.fulfill({ body: assets.thumb, contentType: 'image/png' }));
  await ctx.route((u) => u.pathname.startsWith('/api/'), (r) => {
    const p = new URL(r.request().url()).pathname;
    if (p.includes('/images/')) return r.fulfill({ body: assets.photo, contentType: 'image/png' });
    if (p.includes('/pdfs/')) return r.fulfill({ body: assets.pdf, contentType: 'application/pdf' });
    let data = { canvas_id: CANVAS_ID, canvas_name: 'bench' };
    if (p === '/api/auth/session/refresh') data = { tokenType: 'Bearer', accessToken: token, user };
    else if (p === '/api/auth/me') data = user;
    else if (p.endsWith('/access')) data = { ws_port: 8002, canvas_access_token: 'fixture' };
    else if (p.endsWith('/settings')) data = { canvas_name: 'bench', settings_revision: 0, visibility: 'private', participants: [], can_manage: true };
    return r.fulfill({ json: data });
  });
  const snapshot = { items, groups: ['default'], write_groups: ['default'], is_admin: true, sync_protocol: 2, sync_user_id: 7, revision: 0, accepted_count: 0 };
  await ctx.routeWebSocket(/\/wss\/port\//, (ws) => {
    const rtc = ws.url().includes('/rtc/');
    setTimeout(() => ws.send(JSON.stringify(rtc ? { type: 'rtc_ready' } : { type: 'init_items', ...snapshot, rtc_canvas_connection_id: 'f', rtc_canvas_connection_hash: 'p' })), 50);
    ws.onMessage((raw) => {
      const d = JSON.parse(String(raw));
      if (d.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      if (d.type === 'canvas_sync') ws.send(JSON.stringify({ type: 'canvas_snapshot', client_id: d.client_id, ...snapshot }));
      if (d.type === 'rtc_join') ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer', peers: [] }));
    });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto(`${origin}/canvases/${CANVAS_ID}`);
  await page.waitForFunction((n) => Object.keys(window.frelogCanvas?.read().items || {}).length >= n, Object.keys(items).length, { timeout: 90000 });
  await page.waitForTimeout(5000);
  if (scenario.play) {
    for (let i = 0; i < scenario.play; i++) { try { await page.locator('.youtube-static-preview button').first().click({ timeout: 3000 }); } catch { /* fewer buttons left */ } await page.waitForTimeout(300); }
    await page.waitForTimeout(6000);
  }
  const stage = await page.locator('.canvas-stage').boundingBox();
  return { ctx, page, cdp, center: { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 } };
}

const PHASES = {
  idle: async (page) => page.waitForTimeout(3000),
  pan: async (page, c) => {
    await page.mouse.move(c.x, c.y); await page.mouse.down({ button: 'middle' });
    for (let i = 0; i < 150; i++) { await page.mouse.move(c.x + Math.sin(i / 149 * Math.PI * 2) * 600, c.y + Math.sin(i / 149 * Math.PI * 4) * 200); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'middle' }); await page.waitForTimeout(300);
  },
  scroll: async (page, c) => {
    await page.mouse.move(c.x, c.y);
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, i < 20 ? -120 : 120); await page.waitForTimeout(25); }
    await page.waitForTimeout(400);
  },
  zoom: async (page, c) => {
    await page.mouse.move(c.x, c.y); await page.keyboard.down('Control');
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, i < 10 || i >= 30 ? 120 : -120); await page.waitForTimeout(25); }
    await page.keyboard.up('Control'); await page.waitForTimeout(400);
  },
};

const domStats = (page) => page.evaluate(() => {
  const scene = document.querySelector('.canvas-scene');
  const all = scene ? [...scene.querySelectorAll('*')] : [];
  return {
    domObjects: scene?.querySelectorAll('.canvas-object').length || 0,
    nodes: all.length,
    depthLayers: scene?.querySelectorAll('.canvas-depth-layer').length || 0,
    iframes: scene?.querySelectorAll('iframe').length || 0,
    canvases: scene?.querySelectorAll('canvas').length || 0,
    images: scene?.querySelectorAll('img').length || 0,
    nativeSelects: scene?.querySelectorAll('select').length || 0,
    backdropBlurs: all.filter((n) => (getComputedStyle(n).backdropFilter || 'none') !== 'none').length,
    heapMB: Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576),
  };
});

async function measureFrames(name) {
  const { ctx, page, cdp, center } = await openScenario(name);
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const result = {};
  for (const [phase, run] of Object.entries(PHASES)) {
    const m0 = await metrics();
    await page.evaluate(() => {
      window.__bench = { t: [], last: performance.now(), on: true, longTasks: 0, longMs: 0 };
      try { window.__benchObserver?.disconnect(); window.__benchObserver = new PerformanceObserver((list) => { for (const e of list.getEntries()) { window.__bench.longTasks++; window.__bench.longMs += e.duration; } }); window.__benchObserver.observe({ type: 'longtask' }); } catch { /* unsupported */ }
      const step = (now) => { const b = window.__bench; if (!b.on) return; b.t.push(now - b.last); b.last = now; requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    await run(page, center);
    const frames = await page.evaluate((late) => {
      const b = window.__bench; b.on = false;
      const t = b.t.slice(2), sorted = [...t].sort((x, y) => x - y), sum = t.reduce((s, v) => s + v, 0);
      const q = (p) => +(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0).toFixed(1);
      return { frames: t.length, fps: +(t.length * 1000 / sum).toFixed(1), p50: q(0.5), p95: q(0.95), max: +(sorted.at(-1) || 0).toFixed(1), lateFrames: t.filter((v) => v > late).length, latePct: +(100 * t.filter((v) => v > late).length / Math.max(1, t.length)).toFixed(1), longTasks: b.longTasks, longTaskMs: Math.round(b.longMs) };
    }, LATE_FRAME_MS);
    const m1 = await metrics();
    const d = (k) => Math.round((m1[k] - m0[k]) * 1000);
    result[phase] = { ...frames, scriptMs: d('ScriptDuration'), styleMs: d('RecalcStyleDuration'), layoutMs: d('LayoutDuration'), taskMs: d('TaskDuration') };
  }
  result.dom = await domStats(page);
  await ctx.close();
  return result;
}

// ------------------------------------------------------------ attribution
const maps = new Map();
function sourceMapFor(url) {
  const file = String(url).split('/').pop().split('?')[0];
  if (!file.endsWith('.js')) return null;
  if (!maps.has(file)) { try { maps.set(file, new SourceMap(JSON.parse(fs.readFileSync(path.join(sourcemapDir, `${file}.map`), 'utf8')))); } catch { maps.set(file, null); } }
  return maps.get(file);
}
function topFunctions(profile, limit = 12) {
  const nodes = new Map((profile?.nodes || []).map((n) => [n.id, n])), totals = {};
  (profile?.samples || []).forEach((id, i) => {
    const f = nodes.get(id)?.callFrame;
    if (!f || /^\((idle|program|root)\)$/.test(f.functionName)) return;
    let key = `${f.functionName || '(anonymous)'} ${String(f.url).split('/').pop()}:${f.lineNumber + 1}`;
    const map = f.url ? sourceMapFor(f.url) : null, entry = map ? map.findEntry(f.lineNumber, f.columnNumber) : null;
    if (entry?.originalSource) key = `${entry.name || f.functionName || '(anonymous)'} ${entry.originalSource.replace(/^.*?\/(src|node_modules)\//, '$1/')}:${entry.originalLine + 1}`;
    if (f.functionName === '(garbage collector)') key = '(garbage collector)';
    totals[key] = (totals[key] || 0) + (profile.timeDeltas?.[i] || 0) / 1000;
  });
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([fn, ms]) => ({ fn, ms: +ms.toFixed(1) }));
}
const short = (node) => String(node || '').replace(/\s+/g, ' ').slice(0, 90);
function summarizeTrace(events) {
  const names = events.filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const main = names.map((t) => ({ t, n: events.filter((e) => e.pid === t.pid && e.tid === t.tid && e.name === 'FunctionCall').length })).sort((a, b) => b.n - a.n)[0]?.t;
  if (!main) return null;
  const mine = events.filter((e) => e.pid === main.pid && e.tid === main.tid && e.ph === 'X' && e.dur).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const stack = [];
  for (const e of mine) { while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop(); if (stack.length) stack.at(-1).child = (stack.at(-1).child || 0) + e.dur; stack.push(e); }
  const self = {};
  for (const e of mine) if (!/^V8\.|^ThreadControllerImpl|^RunTask$|InvokeApiInterrupt/.test(e.name)) self[e.name] = (self[e.name] || 0) + (e.dur - (e.child || 0)) / 1000;
  const stages = Object.entries(self).filter(([, ms]) => ms >= 1).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([stage, ms]) => ({ stage, ms: Math.round(ms) }));
  const frames = Math.max(1, mine.filter((e) => e.name === 'UpdateLayoutTree' || e.name === 'Layerize').length / 2);
  const tally = (filter, key) => { const out = {}; for (const e of events) if (e.pid === main.pid && filter(e)) { const k = key(e); out[k] = (out[k] || 0) + 1; } return Object.entries(out).sort((a, b) => b[1] - a[1]); };
  const style = tally((e) => e.name === 'StyleRecalcInvalidationTracking', (e) => `${e.args?.data?.reason || '?'} · ${short(e.args?.data?.nodeName)}`).slice(0, 8).map(([source, count]) => ({ source, count }));
  const layout = tally((e) => e.name === 'LayoutInvalidationTracking', (e) => `${e.args?.data?.reason || '?'} · ${short(e.args?.data?.nodeName)}`).slice(0, 6).map(([source, count]) => ({ source, count }));
  const layouts = mine.filter((e) => e.name === 'Layout');
  return {
    stages, style, layout,
    layoutRuns: layouts.length,
    layoutDirtyObjectsMax: Math.max(0, ...layouts.map((e) => e.args?.beginData?.dirtyObjects || 0)),
    paintInvalidations: events.filter((e) => e.pid === main.pid && e.name === 'PaintInvalidator::InvalidatePaint()').length,
    paintRuns: mine.filter((e) => e.name === 'Paint').length,
    approxFrames: Math.round(frames),
  };
}

async function attribute(name) {
  const { ctx, page, cdp, center } = await openScenario(name);
  const out = {};
  for (const phase of ['idle', 'pan', 'zoom']) {
    const events = [];
    const onData = (d) => events.push(...d.value);
    cdp.on('Tracing.dataCollected', onData);
    const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking' });
    await PHASES[phase](page, center);
    const { profile } = await cdp.send('Profiler.stop');
    await cdp.send('Tracing.end'); await done;
    cdp.off('Tracing.dataCollected', onData);
    out[phase] = { ...summarizeTrace(events), functions: topFunctions(profile) };
  }
  await ctx.close();
  return out;
}

// -------------------------------------------------------------------- run
const median = (values) => { const s = values.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? +(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(1) : null; };
const gpu = await (async () => { const p = await browser.newPage(); const r = await p.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl'); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; }); await p.close(); return r; })();
const git = (cmd) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
const report = {
  metric: 'requestAnimationFrame intervals and CDP Performance.getMetrics deltas per phase; attribution from a separate traced run',
  startedAt: new Date().toISOString(),
  environment: {
    chrome: browser.version(), gpu, cpu: os.cpus()[0]?.model, cores: os.cpus().length, platform: `${os.type()} ${os.release()}`,
    headless: true, viewport: VIEWPORT, cpuThrottle: throttle, repeat, lateFrameMs: LATE_FRAME_MS,
    commit: git('git rev-parse --short HEAD'), workingTreeDirty: Boolean(git('git status --porcelain')),
  },
  phases: { idle: '3초 정지', pan: '가운데 버튼 드래그 150스텝(약 2.7초)', scroll: 'Ctrl 없이 휠 40회', zoom: 'Ctrl+휠 40회(축소 10, 확대 20, 축소 10)' },
  scenarios: {},
};
for (const name of selected) {
  const runs = [];
  for (let r = 0; r < repeat; r++) { runs.push(await measureFrames(name)); console.error(`frames ${name} ${r + 1}/${repeat}`); }
  const summary = {};
  for (const phase of Object.keys(PHASES)) {
    summary[phase] = Object.fromEntries(Object.keys(runs[0][phase]).map((k) => [k, median(runs.map((run) => run[phase][k]))]));
  }
  report.scenarios[name] = { label: SCENARIOS[name].label, median: summary, dom: runs[0].dom, runs };
  if (attribution) { report.scenarios[name].attribution = await attribute(name); console.error(`attribution ${name}`); }
  fs.writeFileSync(output, JSON.stringify(report, null, 1));
}
report.finishedAt = new Date().toISOString();
fs.writeFileSync(output, JSON.stringify(report, null, 1));
await browser.close();
console.error(`wrote ${output}`);
