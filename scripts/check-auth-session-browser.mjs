import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const token = suffix => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.${suffix}`;
const user = { user_id: 1, nickname: 'Fixture', tag_number: 1 };
const server = await createServer({ server: { host: '127.0.0.1', port: 0, https: false, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const url = `https://localhost/tests/browser/auth-session.html`;
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (const scenario of ['expired', 'ip-changed', 'late-401', 'canvas-401']) {
    const context = await browser.newContext();
    const initial = scenario === 'expired' ? `header.${Buffer.from('{"exp":1}').toString('base64url')}.old` : token('old');
    const fresh = token('fresh');
    await context.addInitScript(({ initial, user }) => { localStorage.setItem('agora_token', initial); localStorage.setItem('agora_user', JSON.stringify(user)); }, { initial, user });
    const page = await context.newPage(); let profiles = 0, oldRequest, respondOld;
    const oldReady = new Promise(resolve => { oldRequest = resolve; });
    await context.route('https://localhost/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/login') return route.fulfill({ json: { accessToken: fresh, user } });
      if (path === '/api/canvases/fixture') return route.fulfill({ status: 401, json: { message: 'Canvas capability expired' } });
      if (path === '/api/auth/me') {
        profiles++;
        if (scenario === 'late-401' && route.request().headers().authorization === `Bearer ${initial}`) {
          oldRequest(); await new Promise(resolve => { respondOld = resolve; });
          return route.fulfill({ status: 401, json: { message: 'Old token rejected' } });
        }
        if (scenario === 'ip-changed') return route.fulfill({ status: 401, json: { code: 'AUTH_004', reason: 'CLIENT_IP_CHANGED', message: '접속 네트워크가 변경되었습니다. 다시 로그인해주세요.' } });
        return route.fulfill({ json: user });
      }
      return route.fulfill({ response: await route.fetch({ url: origin + new URL(route.request().url()).pathname + new URL(route.request().url()).search }) });
    });
    await page.goto(url);
    await page.waitForFunction(() => window.authProbe);
    if (scenario === 'expired' || scenario === 'ip-changed') {
      await page.waitForFunction(() => !window.authProbe.isAuthenticated);
      assert.match(await page.locator('#reason').textContent(), /다시 로그인/);
      if (scenario === 'expired') assert.equal(profiles, 0);
      else assert.match(await page.locator('#reason').textContent(), /네트워크/);
    } else if (scenario === 'late-401') {
      await oldReady; await page.getByRole('button', { name: 'Login', exact: true }).click();
      await page.waitForFunction(fresh => window.authProbe.token === fresh, fresh);
      respondOld(); await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.authProbe.token), fresh);
    } else {
      await page.getByRole('button', { name: 'Canvas failure' }).click(); await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.authProbe.token), initial);
    }
    console.log(`${scenario}: passed`); await context.close();
  }
} finally { await browser?.close(); await server.close(); }
