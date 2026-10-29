// Exercise broker-backed handwriting only on an explicitly disposable canvas.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const auth = JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE || '/tmp/agora-handwriting-session.json', 'utf8'));
assert.equal(auth.canvas.canvas_name, '필기 검증 (임시)');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--host-resolver-rules=MAP 118.34.144.201 127.0.0.1', '--disable-features=LocalNetworkAccessChecks', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const errors = [];
async function open() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('agora_token', token); localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_locale', 'ko');
  }, auth);
  // RTC is for calls; shared drawing must arrive via the broker and server.
  await context.routeWebSocket(url => url.pathname.includes('/rtc/canvas/'), socket => socket.onMessage(() => {}));
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`https://118.34.144.201/canvases/${auth.canvas_id}`);
  await page.waitForFunction(() => window.frelogCanvas && document.querySelector('.connection-pill.connected') && !document.querySelector('.canvas-loading-status.is-overlay'), null, { timeout: 60000 });
  return { context, page };
}
const strokes = page => page.evaluate(() => Object.fromEntries(Object.entries(window.frelogCanvas.read().items).filter(([, item]) => item.kind === 'stroke')));
try {
  const a = await open(), b = await open();
  assert.deepEqual(await strokes(a.page), {}, 'The test canvas must start empty');
  await a.page.locator('.canvas-quick-dock').getByRole('button', { name: '드로잉', exact: true }).click();
  assert.equal(await a.page.getByLabel('드로잉 스타일').inputValue(), 'pen');
  await a.page.evaluate(() => {
    const stage = document.querySelector('.canvas-stage'), nativeCapture = stage.setPointerCapture.bind(stage);
    stage.setPointerCapture = id => { if (id !== 912 && id !== 913) nativeCapture(id); };
    window.__write = (type, x, y, pressure = .5, coalesced = [], pointerId = 912, pointerType = 'pen') => {
      const box = stage.getBoundingClientRect();
      const make = (kind, p) => new PointerEvent(kind, { bubbles: true, cancelable: true, pointerId, pointerType,
        isPrimary: pointerId === 912, clientX: box.left + p.x, clientY: box.top + p.y,
        pressure: p.pressure, button: kind === 'pointermove' ? -1 : 0, buttons: kind === 'pointerup' || kind === 'pointercancel' ? 0 : 1 });
      const event = make(type, { x, y, pressure });
      if (coalesced.length) Object.defineProperty(event, 'getCoalescedEvents', { value: () => coalesced.map(point => make('pointermove', point)) });
      stage.dispatchEvent(event);
    };
  });
  await a.page.evaluate(() => {
    window.__write('pointerdown', 420, 320, .15);
    window.__write('pointermove', 460, 325, .65, [{ x: 430, y: 322, pressure: .25 }, { x: 445, y: 326, pressure: .4 }, { x: 460, y: 325, pressure: .65 }]);
    window.__write('pointermove', 550, 650, .5, [], 913, 'touch');
    window.__write('pointerup', 550, 650, 0, [], 913, 'touch');
  });
  await b.page.waitForFunction(() => Object.values(window.frelogCanvas.read().items).some(item => item.kind === 'stroke' && item.complete === false && item.points.length >= 3), null, { timeout: 15000 });
  const partial = Object.entries(await strokes(b.page)).find(([, item]) => item.complete === false);
  assert.ok(partial, 'The other browser receives in-progress ink without RTC');
  const firstId = partial[0];
  const expectedEnd = await a.page.evaluate(() => {
    const matrix = new DOMMatrix(document.querySelector('.canvas-world-layer').style.transform);
    return { x: (530 - matrix.m41) / matrix.a, y: (330 - matrix.m42) / matrix.a };
  });
  await a.page.evaluate(() => { window.__write('pointermove', 510, 332, .75); window.__write('pointerup', 530, 330, 0); });
  await b.page.waitForFunction(id => window.frelogCanvas.read().items[id]?.complete === true, firstId, { timeout: 15000 });
  const first = (await strokes(b.page))[firstId], last = first.points.at(-1);
  assert.equal(first.brush, 'pen'); assert.equal(first.simulatePressure, false);
  assert.ok(first.points.some(point => point.pressure < .3) && first.points.some(point => point.pressure > .6));
  assert.ok(Math.abs(last.x - expectedEnd.x) < .01 && Math.abs(last.y - expectedEnd.y) < .01, 'The final pen coordinate is retained');
  assert.ok(last.pressure > .6, 'Pen-up pressure zero does not create a sharp endpoint');
  assert.ok(first.points.length < 12, 'A second touch pointer must not contaminate the pen stroke');

  for (let i = 0; i < 4; i++) await a.page.getByRole('button', { name: '확대', exact: true }).click();
  const previousIds = Object.keys(await strokes(a.page));
  await a.page.evaluate(() => {
    window.__write('pointerdown', 450, 410, .5);
    for (let i = 1; i <= 12; i++) window.__write('pointermove', 450 + i * .4, 410 + i * .08, .5);
    window.__write('pointerup', 455.2, 411.04, 0);
  });
  await b.page.waitForFunction(ids => Object.entries(window.frelogCanvas.read().items).some(([id, item]) => item.kind === 'stroke' && item.complete && !ids.includes(id)), previousIds, { timeout: 15000 });
  const fine = Object.entries(await strokes(b.page)).find(([id]) => !previousIds.includes(id))[1];
  assert.ok(fine.points.length >= 8, `Zoomed-in fine writing lost samples: ${fine.points.length}`);
  await a.page.getByRole('button', { name: '맞춤', exact: true }).click();

  const beforeCancel = Object.keys(await strokes(b.page));
  await a.page.evaluate(() => {
    window.__write('pointerdown', 400, 455, .4);
    window.__write('pointermove', 420, 460, .6);
    window.__write('pointercancel', 420, 460, 0);
  });
  await b.page.waitForFunction(ids => Object.entries(window.frelogCanvas.read().items).some(([id, item]) => item.kind === 'stroke' && item.complete && !ids.includes(id)), beforeCancel, { timeout: 15000 });
  const cancelled = Object.entries(await strokes(b.page)).find(([id]) => !beforeCancel.includes(id))[1];
  assert.ok(cancelled.points.length >= 2, 'Pointer cancellation must preserve the ink already written');

  const beforeTap = Object.keys(await strokes(b.page));
  await a.page.evaluate(() => { window.__write('pointerdown', 480, 455, .2); window.__write('pointerup', 480, 455, 0); });
  await b.page.waitForFunction(ids => Object.entries(window.frelogCanvas.read().items).some(([id, item]) => item.kind === 'stroke' && item.complete && !ids.includes(id)), beforeTap, { timeout: 15000 });
  const tap = Object.entries(await strokes(b.page)).find(([id]) => !beforeTap.includes(id))[1];
  assert.equal(tap.points.length, 1, 'A pen tap should remain a single dot');

  const metrics = await a.page.evaluate(async () => {
    const times = []; let last = performance.now();
    window.__write('pointerdown', 350, 500, .35);
    for (let frame = 0; frame < 100; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const now = performance.now(); times.push(now - last); last = now;
      const samples = Array.from({ length: 8 }, (_, index) => {
        const t = frame * 8 + index + 1;
        return { x: 350 + t * .42, y: 500 + Math.sin(t / 16) * 15, pressure: .35 + (t % 200) / 500 };
      });
      const point = samples.at(-1);
      window.__write('pointermove', point.x, point.y, point.pressure, samples);
    }
    window.__write('pointerup', 686.4, 500 + Math.sin(800 / 16) * 15, 0);
    times.sort((x, y) => x - y);
    return { p95FrameMs: Math.round(times[Math.floor(times.length * .95)] * 10) / 10, frames: times.length };
  });
  await b.page.waitForFunction(() => Object.values(window.frelogCanvas.read().items).filter(item => item.kind === 'stroke' && item.complete).length === 5, null, { timeout: 30000 });
  const all = await strokes(b.page), long = Object.values(all).sort((x, y) => y.points.length - x.points.length)[0];
  assert.ok(long.points.length > 500, `Long coalesced stroke lost input: ${long.points.length}`);
  await b.page.reload();
  await b.page.waitForFunction(() => window.frelogCanvas && document.querySelector('.connection-pill.connected') && !document.querySelector('.canvas-loading-status.is-overlay'), null, { timeout: 60000 });
  await b.page.waitForFunction(id => window.frelogCanvas.read().items[id]?.complete === true, firstId, { timeout: 15000 });
  assert.deepEqual((await strokes(b.page))[firstId], first);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ defaultPen: true, coalescedSamples: true, pressure: true, otherPointerIgnored: true, pointerCancel: true, tap: true, zoomedPoints: fine.points.length, sharedInProgressWithoutRtc: true, reloadVerified: true, longStrokePoints: long.points.length, ...metrics, pageErrors: 0 }));
} finally { await browser.close(); }
