import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, https: false, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/browser/keyboard-nudge.html`);
  await page.waitForFunction(() => window.nudgeFixture);
  const board = page.locator('#board'); await board.focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowDown');
  const read = () => page.evaluate(() => ({ items: window.nudgeFixture.items, moves: window.nudgeFixture.stats.moves.length, flushes: window.nudgeFixture.stats.flushes }));
  let state = await read();
  assert.ok(Math.abs(state.items.box.x - (.1 + 1 / 1600)) < 1e-12);
  assert.ok(Math.abs(state.items.box.y - (.1 + 9 / 1000)) < 1e-12);
  assert.ok(Math.abs(state.items.ink.points[0].x - (.2 + 1 / 1600)) < 1e-12);
  assert.equal(state.items.ink.points[0].pressure, .5);
  assert.deepEqual(state.items.connector, { kind: 'connector', from: 'box', to: 'ink' });
  assert.equal(state.flushes, 3);
  for (const locator of [page.getByLabel('Numeric setting'), page.getByLabel('Range setting'), page.getByLabel('Text editor'), page.getByLabel('Rich editor'), page.locator('#dialog-content')]) {
    await locator.focus(); await page.keyboard.press('ArrowRight');
  }
  assert.equal((await read()).moves, 3, 'controls and editors keep keyboard navigation');
  await board.focus(); await page.keyboard.press('Control+ArrowRight');
  await page.evaluate(() => window.nudgeFixture.setEditable(false)); await page.keyboard.press('ArrowRight');
  await page.evaluate(() => { window.nudgeFixture.setEditable(true); window.nudgeFixture.setDragging({}); }); await page.keyboard.press('ArrowRight');
  await page.evaluate(() => { window.nudgeFixture.setDragging(null); window.nudgeFixture.setOptions(current => ({ ...current, editingId: 'box' })); });
  await page.waitForFunction(() => window.nudgeFixture.options.editingId === 'box');
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => window.nudgeFixture.setOptions(current => ({ ...current, editingId: null, activeTool: 'pen' })));
  await page.waitForFunction(() => window.nudgeFixture.options.activeTool === 'pen');
  await page.keyboard.press('ArrowRight');
  assert.equal((await read()).moves, 3);
  await page.evaluate(() => window.nudgeFixture.setOptions(current => ({ ...current, activeTool: 'select' })));
  await page.waitForFunction(() => window.nudgeFixture.options.activeTool === 'select');
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowLeft'); await page.keyboard.up('ArrowLeft');
  state = await read(); assert.equal(state.moves, 5); assert.equal(state.flushes, 4);
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal((await read()).flushes, 5);
  await page.keyboard.up('ArrowRight');
  assert.deepEqual(errors, []);
  console.log('Keyboard nudge: 1px/10px mixed selection, repeat, release/blur flush, editor and read-only guards passed.');
} finally { await browser?.close(); await server.close(); }
