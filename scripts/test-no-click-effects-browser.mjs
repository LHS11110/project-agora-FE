// Read-only checks on the homepage, a canvas and the separate login page.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const session = JSON.parse(await fs.readFile(process.env.AGORA_SESSION_FILE || '/tmp/agora-no-click-session.json', 'utf8'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/agora-studio-browser/node_modules/playwright-core/index.mjs');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--host-resolver-rules=MAP 118.34.144.201 127.0.0.1', '--disable-features=LocalNetworkAccessChecks', '--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
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
  await home.goto('https://118.34.144.201/');
  await home.locator('.home-scroll-page:not(.home-intro-pending)').waitFor();
  assert.equal(await home.locator('.home-slide-track, .home-slide-controls, .pointer-water').count(), 0);
  for (const selector of ['.workspace-preview', '.home-feature-card', '.home-team-card']) {
    await home.locator(selector).first().click();
    assert.equal(await home.locator('.pointer-firework, .pointer-water-ring').count(), 0);
  }
  assert.deepEqual(await home.evaluate(() => window.__clickFeedback), []);
  await home.goto('https://118.34.144.201/login');
  await home.getByLabel('이메일', { exact: true }).click();
  await home.getByRole('button', { name: '비밀번호 표시', exact: true }).click();
  assert.equal(await home.locator('.pointer-water, .pointer-firework, .pointer-water-ring').count(), 0);

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
  await canvas.goto(`https://118.34.144.201/canvases/${session.canvas_id}`);
  await canvas.waitForFunction(() => window.frelogCanvas && document.querySelector('.connection-pill.connected') && !document.querySelector('.canvas-loading-status.is-overlay'), null, { timeout: 60000 });
  const before = await canvas.evaluate(() => JSON.stringify(window.frelogCanvas.read()));
  for (const point of [{ x: 450, y: 300 }, { x: 510, y: 350 }, { x: 570, y: 400 }]) await canvas.locator('.canvas-stage').click({ position: point });
  await canvas.waitForTimeout(300);
  assert.equal(await canvas.evaluate(() => window.__canvasClickWaves), 0);
  assert.equal(await canvas.evaluate(() => JSON.stringify(window.frelogCanvas.read())), before);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ homeNativeScrolling: true, loginClickEffectsAbsent: true, homeClickEffectsAbsent: true, canvasClickWaves: 0, canvasObjectsUnchanged: true, pageErrors: 0 }));
} finally { await browser.close(); }
