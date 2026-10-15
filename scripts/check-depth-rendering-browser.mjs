import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

// Optional test dependency; no application dependencies or backend data change.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, https: false, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 500 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/browser/depth-layers.html`);
  await page.waitForFunction(() => window.depthFixture && document.querySelector('.vector-layer')?.__agoraRenderStats?.visibleObjects === 36, null, { timeout: 60000 });
  const checkPixels = async label => {
    await page.waitForTimeout(400);
    const png = await page.screenshot();
    const missing = await page.evaluate(async bytes => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return window.depthFixture.regions.filter(region => {
        const pixels = ctx.getImageData(region.x, region.y, 80, 60).data;
        let painted = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (region.red ? pixels[i] > 180 && pixels[i + 1] < 110 && pixels[i + 2] < 110 : pixels[i] < 160 && pixels[i + 1] < 160 && pixels[i + 2] < 160) painted++;
        }
        return painted < 20;
      }).map(region => region.id);
    }, [...png]);
    assert.deepEqual(missing, [], label);
    assert.deepEqual(errors, [], `${label}: browser exceptions`);
    console.log(`${label}: all 36 objects visible`);
  };
  if (process.env.REQUIRE_GPU) await page.waitForSelector('.vector-layer[data-renderer="webgl"]', { timeout: 30000 });
  await checkPixels('Initial scene');
  const gpu = await page.locator('.vector-layer[data-renderer="webgl"]').count();
  if (process.env.REQUIRE_GPU) assert.ok(gpu, 'Hardware WebGL required for fault injection');
  for (let pass = 1; pass <= 6; pass++) {
    await page.evaluate(pass => {
      const changes = {};
      for (let i = 0; i < 36; i++) changes['item' + i] = { depth: pass % 2 ? (pass === 3 ? -1 : 1) * (Math.floor(i / 4) + pass * 10) : 0 };
      window.depthFixture.patch(changes);
    }, pass);
    await checkPixels(`Depth split/merge ${pass}`);
    if (pass === 1 && gpu) {
      await page.evaluate(() => {
        window.injectedDrawFailure = false;
        for (const name of ['drawElements', 'drawElementsInstanced']) {
          const original = WebGL2RenderingContext.prototype[name];
          WebGL2RenderingContext.prototype[name] = function (...args) {
            if (!window.injectedDrawFailure) { window.injectedDrawFailure = true; throw Error('Injected render failure'); }
            return original.apply(this, args);
          };
        }
        window.depthFixture.patch({ item0: { fill: '#fe0000' } });
      });
      await page.waitForFunction(() => window.injectedDrawFailure);
      await checkPixels('GPU draw exception recovery');
    }
    if (pass === 3 && gpu) {
      const lost = await page.evaluate(() => {
        let count = 0;
        for (const layer of document.querySelectorAll('.vector-layer[data-renderer="webgl"]')) {
          for (const canvas of layer.querySelectorAll('canvas')) {
            const gl = canvas.getContext('webgl2');
            if (gl) { gl.getExtension('WEBGL_lose_context').loseContext(); count++; break; }
          }
        }
        return count;
      });
      assert.ok(lost > 0);
      await checkPixels('GPU context loss recovery');
    }
  }
  console.log(`Depth regression passed; hardware GPU ${gpu ? 'verified' : 'unavailable (CPU path tested)'}.`);
} finally {
  await browser?.close(); await server.close();
}
