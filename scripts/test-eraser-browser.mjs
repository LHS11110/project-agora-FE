// Run only against a newly created disposable canvas, never an existing user's canvas.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const session = JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE || '/tmp/agora-eraser-session.json', 'utf8'));
assert.equal(session.canvas.canvas_name, '지우개 동기화 검증 (임시)');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--host-resolver-rules=MAP 118.34.144.201 127.0.0.1', '--disable-features=LocalNetworkAccessChecks', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const errors = [], sentActions = [];
const ready = page => page.waitForFunction(() => window.frelogCanvas && document.querySelector('.connection-pill.connected') && !document.querySelector('.canvas-loading-status.is-overlay'), null, { timeout: 60000 });
const strokes = page => page.evaluate(() => Object.fromEntries(Object.entries(window.frelogCanvas.read().items).filter(([, item]) => item.kind === 'stroke')));

async function open() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('agora_token', token);
    localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_locale', 'ko');
  }, session);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framesent', ({ payload }) => {
    try { const frame = JSON.parse(payload.toString()); if (frame.type === 'canvas_ops') sentActions.push(...frame.operations.map(operation => operation.action)); } catch { /* Ignore non-JSON frames. */ }
  }));
  await page.goto(`https://118.34.144.201/canvases/${session.canvas_id}`);
  await ready(page);
  return { context, page };
}

try {
  const a = await open(), b = await open();
  assert.deepEqual(await strokes(a.page), {}, 'The test canvas must start empty');
  const dock = a.page.locator('.canvas-quick-dock');
  const pen = () => dock.getByRole('button', { name: '드로잉', exact: true }).click();
  const eraser = () => dock.getByRole('button', { name: '드로잉 지우개', exact: true }).click();
  const mode = name => a.page.locator('.canvas-inspector').getByRole('button', { name, exact: true });
  async function draw(y) {
    const previous = Object.keys(await strokes(a.page));
    await pen();
    await a.page.mouse.move(420, y); await a.page.mouse.down();
    await a.page.mouse.move(760, y, { steps: 22 }); await a.page.mouse.up();
    await a.page.waitForFunction(ids => Object.entries(window.frelogCanvas.read().items).some(([id, item]) => item.kind === 'stroke' && item.complete && !ids.includes(id)), previous, { timeout: 15000 });
    const next = await strokes(a.page);
    const id = Object.keys(next).find(key => !previous.includes(key));
    await b.page.waitForFunction(id => window.frelogCanvas.read().items[id]?.complete === true, id, { timeout: 15000 });
    return id;
  }
  const first = await draw(350), untouched = await draw(430);
  await eraser();
  assert.equal(await mode('부분 지우기').getAttribute('aria-pressed'), 'true');
  await mode('선 전체 지우기').click();
  assert.equal(await a.page.evaluate(() => localStorage.getItem('frelog_canvas_eraser_mode')), 'stroke');
  await a.page.mouse.click(580, 350);
  await b.page.waitForFunction(id => !window.frelogCanvas.read().items[id], first, { timeout: 15000 });
  assert.equal((await strokes(b.page))[untouched]?.kind, 'stroke');
  assert.ok(sentActions.includes('delete'), 'The deletion should travel through the canvas broker');

  await a.page.reload(); await ready(a.page); await eraser();
  assert.equal(await mode('선 전체 지우기').getAttribute('aria-pressed'), 'true', 'The chosen mode survives reload');
  await mode('부분 지우기').click();
  await a.page.mouse.click(580, 430);
  await b.page.waitForFunction(() => Object.values(window.frelogCanvas.read().items).filter(item => item.kind === 'stroke').length === 2, null, { timeout: 15000 });
  const pieces = await strokes(b.page);
  assert.equal(Object.keys(pieces).length, 2);
  assert.ok(pieces[untouched]);
  const ends = Object.values(pieces).flatMap(item => item.points.map(point => point.x));
  assert.ok(Math.min(...ends) < Math.max(...ends) - 200, 'Both sides of the original stroke remain');

  await b.page.reload(); await ready(b.page);
  await b.page.waitForFunction(() => Object.values(window.frelogCanvas.read().items).filter(item => item.kind === 'stroke').length === 2, null, { timeout: 15000 });
  assert.equal((await strokes(b.page))[first], undefined, 'Deleted strokes do not return after reload');
  await a.page.screenshot({ path: '/tmp/agora-eraser-mode.png' });

  await a.page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await mode('선 전체 지우기').isVisible(), 'Mode controls remain accessible on mobile');
  const tutorial = await a.context.newPage();
  await tutorial.goto('https://118.34.144.201/tutorial');
  await tutorial.locator('.tutorial-tools').getByRole('button', { name: '드로잉 지우개', exact: true }).click();
  const tutorialMode = tutorial.getByRole('combobox', { name: '지우기 방식' });
  await tutorialMode.selectOption('stroke');
  assert.equal(await tutorialMode.inputValue(), 'stroke');
  const english = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  await english.addInitScript(() => localStorage.setItem('frelog_locale', 'en'));
  const englishTutorial = await english.newPage();
  await englishTutorial.goto('https://118.34.144.201/tutorial');
  await englishTutorial.locator('.tutorial-tools').getByRole('button', { name: 'Drawing eraser', exact: true }).click();
  const englishMode = englishTutorial.getByRole('combobox', { name: 'Eraser mode' });
  assert.deepEqual(await englishMode.locator('option').allTextContents(), ['Erase part', 'Erase stroke']);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ wholeStrokeSynced: true, partialFragmentsSynced: true, reloadVerified: true, preferencePersisted: true, mobile: true, tutorial: true, english: true, pageErrors: errors.length }));
} finally {
  await browser.close();
}
