import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, https: false, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: process.env.FORCE_CPU ? ['--no-sandbox', '--disable-gpu'] : ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { const original = window.fetch; window.previewFetchCount = 0; window.fetch = (...args) => { if (String(args[0]).startsWith('data:image/')) window.previewFetchCount++; return original(...args); }; });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/browser/overview.html`);
  const ready = (previews = false) => page.waitForFunction(previews => { const s = document.querySelector('.vector-layer')?.__agoraRenderStats; return s?.visibleObjects === 10000 && (!previews || s.imagePreviews?.entries === 200) && !s.preparing && !s.imagePreviews?.queued && !s.imagePreviews?.active; }, previews, { timeout: 120000 });
  await ready();
  if (process.env.REQUIRE_GPU) await page.waitForSelector('.vector-layer[data-renderer="webgl"]');
  const measure = (zoom = false) => page.evaluate(async zoom => {
    const stats = document.querySelector('.vector-layer').__agoraRenderStats, before = stats.rasterizations;
    const intervals = []; let previous;
    for (let i = 0; i < 180; i++) {
      const now = await new Promise(requestAnimationFrame); if (previous) intervals.push(now - previous); previous = now;
      window.overviewFixture.setCamera({ x: Math.sin(i / 30) * 8, y: Math.cos(i / 30) * 8, scale: zoom ? .05 + Math.sin(i / 30) * .01 : .05 });
    }
    intervals.sort((a, b) => a - b);
    return { fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length), p95Ms: intervals[Math.floor(intervals.length * .95)], rasterizationsDuringPan: stats.rasterizations - before,
      renderer: document.querySelector('.vector-layer').dataset.renderer, previews: stats.imagePreviews };
  }, zoom);
  const baseline = await measure();
  const baselineZoom = await measure(true);
  await page.evaluate(() => window.overviewFixture.setMode('content'));
  await ready(true); await page.waitForTimeout(300);
  const content = await measure();
  const contentZoom = await measure(true);
  await page.evaluate(() => window.overviewFixture.setCamera({ x: 0, y: 0, scale: .05 })); await page.waitForTimeout(150);
  const png = await page.screenshot();
  const pixels = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const p = ctx.getImageData(8, 3, 1, 1).data;
    const text = ctx.getImageData(13, 1, 10, 6).data; let ink = 0, white = 0;
    for (let i = 0; i < text.length; i += 4) { if (text[i] < 240 || text[i + 1] < 240 || text[i + 2] < 240) ink++; else white++; }
    return { imagePixel: [...p], textInk: ink, textWhite: white };
  }, [...png]);

  assert.ok(pixels.imagePixel[2] > pixels.imagePixel[0] + 60, 'Actual blue image detail is visible');
  assert.ok(pixels.textInk > 0 && pixels.textWhite > pixels.textInk, 'Text remains ink on transparent background, not a filled box');
  assert.equal(content.rasterizationsDuringPan, 0, 'Panning reuses cached pixels');
  assert.ok(content.previews.pixels <= 8_000_000);
  assert.ok(content.fps >= baseline.fps * .8, 'Warm pan FPS remains within 20% of the old box rendering');
  assert.ok(contentZoom.fps >= baselineZoom.fps * .8, 'Zoom FPS remains within 20% of box rendering');
  const requestsBefore = await page.evaluate(() => window.previewFetchCount);
  await page.evaluate(() => window.overviewFixture.setToken('account-b'));
  await page.waitForFunction(() => document.querySelector('.vector-layer').__agoraRenderStats?.imagePreviews?.scope === 1);
  await ready(true);
  assert.equal(await page.evaluate(() => window.previewFetchCount), requestsBefore + 200, 'Account change discards authenticated preview cache');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ baseline, baselineZoom, content, contentZoom, pixels }, null, 2));
} finally { await browser?.close(); await server.close(); }
