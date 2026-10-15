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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/browser/image-frame.html`);
  const image = page.locator('.image-object > img'); await image.waitFor();
  const toggle = page.getByRole('switch', { name: '이미지 테두리 표시' });
  const measure = () => image.evaluate(el => {
    const style = getComputedStyle(el), box = el.getBoundingClientRect();
    return { border: style.borderTopWidth, bottom: style.borderBottomWidth, width: box.width, height: box.height };
  });
  const original = await measure(); assert.equal(original.border, '7px'); assert.equal(original.bottom, '26px');
  assert.equal(await page.locator('.object-caption').count(), 1);
  await toggle.click();
  const hidden = await measure(); assert.equal(hidden.border, '0px'); assert.equal(hidden.bottom, '0px');
  assert.equal(hidden.width, original.width); assert.equal(hidden.height, original.height);
  assert.equal(await page.locator('.object-caption').count(), 0);
  assert.ok(await page.locator('.object-resize-handle').count() > 0, 'Selection resize handles remain available');
  await toggle.click(); assert.deepEqual(await measure(), original);
  assert.equal(await page.locator('.object-caption').count(), 1);
  assert.deepEqual(errors, []);
  console.log('Image frame and caption toggle correctly; dimensions and selection handles preserved.');
} finally { await browser?.close(); await server.close(); }
