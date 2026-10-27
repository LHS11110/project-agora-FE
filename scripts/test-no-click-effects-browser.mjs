// Read-only checks on the homepage, a canvas and the separate login page.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const session = JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE || '/tmp/agora-no-click-session.json', 'utf8'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--host-resolver-rules=MAP 112.168.71.147 127.0.0.1', '--disable-features=LocalNetworkAccessChecks', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const homeContext = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
  await homeContext.addInitScript(() => {
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    localStorage.setItem('frelog_locale', 'ko');
    const animate = Element.prototype.animate;
    window.__clickFeedback = [];
    Element.prototype.animate = function (...args) {
      if (this.matches('.slide-desk-object, .desk-object-icon, .scene-object, .scene-object > strong, [data-feedback-pulse]')) window.__clickFeedback.push(this.className);
      return animate.apply(this, args);
    };
  });
  const home = await homeContext.newPage(); home.on('pageerror', error => errors.push(error.message));
  await home.goto('https://112.168.71.147/');
  await home.locator('.home-slides-page:not(.home-intro-pending)').waitFor();
  await home.waitForTimeout(500);
  assert.equal(await home.locator('.home-slide .pointer-water').count(), 0);
  const desk = home.locator('.home-slide').first().locator('.slide-desk-object').first();
  const oldText = await desk.locator('small').textContent();
  await desk.click();
  assert.equal(await desk.getAttribute('aria-pressed'), 'true');
  assert.notEqual(await desk.locator('small').textContent(), oldText);
  assert.equal(await desk.locator('small').evaluate(element => element.getAnimations().length), 0);
  const object = home.locator('.frelog-scene--home .scene-object').first();
  await object.click(); assert.equal(await object.getAttribute('aria-pressed'), 'true');
  assert.equal(await home.locator('.frelog-scene--home .scene-connections path').first().evaluate(element => getComputedStyle(element).animationName), 'none');
  assert.deepEqual(await home.evaluate(() => window.__clickFeedback), []);
  for (let index = 0; index < 5; index++) {
    const tab = home.locator('.slide-progress [role=tab]').nth(index);
    await tab.click();
    await home.waitForFunction(index => document.querySelectorAll('.slide-progress [role=tab]')[index]?.getAttribute('aria-selected') === 'true', index);
    await home.waitForTimeout(500);
    const slide = home.locator('.home-slide').nth(index);
    await slide.click({ position: { x: 14, y: 14 } });
    assert.equal(await home.locator('.pointer-firework, .pointer-water-ring').count(), 0);
  }

  const canvasContext = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
  await canvasContext.addInitScript(({ token, user }) => {
    localStorage.setItem('agora_token', token); localStorage.setItem('agora_user', JSON.stringify(user)); localStorage.setItem('frelog_locale', 'ko');
    const arc = CanvasRenderingContext2D.prototype.arc;
    window.__canvasClickWaves = 0;
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      if (this.canvas.parentElement?.classList.contains('motion-field--canvas')) window.__canvasClickWaves++;
      return arc.apply(this, args);
    };
  }, session);
  const canvas = await canvasContext.newPage(); canvas.on('pageerror', error => errors.push(error.message));
  await canvas.goto(`https://112.168.71.147/canvases/${session.canvas_id}`);
  await canvas.waitForFunction(() => window.frelogCanvas && document.querySelector('.connection-pill.connected') && !document.querySelector('.canvas-loading-status.is-overlay'), null, { timeout: 60000 });
  const before = await canvas.evaluate(() => JSON.stringify(window.frelogCanvas.read()));
  for (const point of [{ x: 450, y: 300 }, { x: 510, y: 350 }, { x: 570, y: 400 }]) await canvas.locator('.canvas-stage').click({ position: point });
  await canvas.waitForTimeout(300);
  assert.equal(await canvas.evaluate(() => window.__canvasClickWaves), 0);
  assert.equal(await canvas.evaluate(() => JSON.stringify(window.frelogCanvas.read())), before);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ homeSlides: 5, homeSelectionWorks: true, homeClickEffectsAbsent: true, canvasClickWaves: 0, canvasObjectsUnchanged: true, pageErrors: 0 }));
} finally { await browser.close(); }
