// Requires a newly created, explicitly named disposable canvas.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const session = JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE || '/tmp/agora-sync-widget-session.json', 'utf8'));
assert.equal(session.canvas.canvas_name, '동기화 상태 검증 (임시)');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--host-resolver-rules=MAP 118.34.144.201 127.0.0.1', '--disable-features=LocalNetworkAccessChecks', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('agora_token', token);
    localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_locale', 'ko');
    const send = WebSocket.prototype.send;
    window.__heldCanvasOps = [];
    window.__holdCanvasOps = true;
    WebSocket.prototype.send = function (payload) {
      try {
        if (window.__holdCanvasOps && JSON.parse(payload).type === 'canvas_ops') {
          window.__heldCanvasOps.push({ socket: this, payload });
          return;
        }
      } catch { /* Other socket messages pass through unchanged. */ }
      return send.call(this, payload);
    };
    window.__releaseCanvasOps = () => {
      window.__holdCanvasOps = false;
      for (const { socket, payload } of window.__heldCanvasOps.splice(0)) send.call(socket, payload);
    };
  }, session);
  const page = await context.newPage(), errors = [], commits = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    try { const frame = JSON.parse(payload.toString()); if (frame.type === 'canvas_commit') commits.push(frame); } catch { /* Ignore non-JSON frames. */ }
  }));
  await page.goto(`https://118.34.144.201/canvases/${session.canvas_id}`);
  const ready = () => page.waitForFunction(() => window.frelogCanvas && document.querySelector('.connection-pill.connected') && !document.querySelector('.canvas-loading-status.is-overlay'), null, { timeout: 60000 });
  await ready();
  assert.equal(Object.keys(await page.evaluate(() => window.frelogCanvas.read().items)).length, 0, 'The test canvas must start empty');
  const panelTop = await page.locator('.canvas-panel-slot-inspector').evaluate(element => element.getBoundingClientRect().top);
  await page.evaluate(() => {
    window.__syncWidgetSeen = Boolean(document.querySelector('.host-canvas-status'));
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && (node.matches('.host-canvas-status') || node.querySelector('.host-canvas-status'))) window.__syncWidgetSeen = true;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.locator('.canvas-quick-dock').getByRole('button', { name: '도형', exact: true }).click();
  await page.locator('.canvas-stage').click({ position: { x: 580, y: 350 } });
  await page.waitForFunction(() => window.__heldCanvasOps.length > 0, null, { timeout: 10000 });
  assert.equal(await page.locator('.host-canvas-status').count(), 0);
  assert.equal(await page.evaluate(() => window.__syncWidgetSeen), false);
  assert.equal(await page.locator('.canvas-panel-slot-inspector').evaluate(element => element.getBoundingClientRect().top), panelTop, 'Pending saves must not move the panel');
  const ids = await page.evaluate(() => Object.keys(window.frelogCanvas.read().items));
  assert.equal(ids.length, 1);
  await page.evaluate(() => window.__releaseCanvasOps());
  for (let attempt = 0; attempt < 150 && !commits.some(frame => frame.items?.[ids[0]]); attempt++) await page.waitForTimeout(100);
  assert.ok(commits.some(frame => frame.items?.[ids[0]]), 'The server committed the object before reload');
  await page.reload(); await ready();
  await page.waitForFunction(id => Boolean(window.frelogCanvas.read().items[id]), ids[0], { timeout: 15000 });
  assert.equal(await page.locator('.host-canvas-status').count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pendingWidgetAbsent: true, panelPositionStable: true, savedAfterReload: true, pageErrors: 0 }));
} finally {
  await browser.close();
}
