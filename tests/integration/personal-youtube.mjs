import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:8444';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    ...(process.env.AGORA_E2E_HOST_RESOLVER ? [`--host-resolver-rules=${process.env.AGORA_E2E_HOST_RESOLVER}`] : []),
  ],
});

const user = { email: 'viewer@example.invalid', nickname: 'Viewer', tag_number: 1, role: 'ROLE_USER', status: 'ACTIVE' };
const token =
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url') +
  '.viewer';

const initialState = { paused: false, time: 60, updatedAt: Date.now(), actor: 'remote' };
const initialItems = {
  one: {
    kind: 'link',
    mediaType: 'youtube',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title: 'YouTube One',
    mediaState: initialState,
    mediaLoop: true,
    permission: 'writers',
    x: 0.08,
    y: 0.12,
    width: 0.34,
    height: 0.28,
  },
  two: {
    kind: 'link',
    mediaType: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'YouTube Two',
    mediaState: initialState,
    mediaLoop: true,
    permission: 'writers',
    x: 0.52,
    y: 0.12,
    width: 0.34,
    height: 0.28,
  },
};

let writes = 0;
let mainSocket = null;

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    locale: 'ko-KR',
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript(
    ({ t, u }) => {
      ((t)=>{const f=window.fetch;window.fetch=function(input){return String(input?.url??input).includes('/api/auth/session/refresh')?Promise.resolve(new Response(JSON.stringify({accessToken:t}),{status:200,headers:{'Content-Type':'application/json'}})):f.apply(this,arguments);};})(t);
      localStorage.setItem('agora_user', JSON.stringify(u));
    },
    { t: token, u: user },
  );

  await context.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/api/auth/me') return route.fulfill({ json: user });
    if (p.endsWith('/access')) return route.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
    if (p.endsWith('/settings')) {
      return route.fulfill({
        json: {
          canvas_name: 'Personal YT',
          settings_revision: 0,
          visibility: 'private',
          participants: [{ nickname: 'Viewer', tag_number: 1 }],
          group_permissions: { writers: { read: true, write: false, execute: false } },
          can_manage: false,
        },
      });
    }
    return route.fulfill({ json: { canvas_id: 999001, canvas_name: 'Personal YT' } });
  });

  await context.routeWebSocket(/\/wss\/port\//, (ws) => {
    const rtc = ws.url().includes('/rtc/');
    if (!rtc) mainSocket = ws;
    setTimeout(
      () =>
        ws.send(
          JSON.stringify(
            rtc
              ? { type: 'rtc_ready' }
              : {
                  type: 'init_items',
                  items: initialItems,
                  groups: ['writers'],
                  write_groups: [],
                  execute_groups: [],
                  is_admin: false,
                  sync_protocol: 2,
                  sync_user_id: 9,
                  revision: 1,
                  accepted_count: 0,
                },
          ),
        ),
      60,
    );
    ws.onMessage((raw) => {
      const d = JSON.parse(String(raw));
      if (d.type === 'ping') ws.send(JSON.stringify({ type: 'pong', request_id: d.request_id }));
      if (d.type === 'rtc_join') ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'viewer', peers: [] }));
      if (d.type === 'canvas_ops' || d.type === 'item_save') writes++;
    });
  });

  await context.route('https://www.youtube-nocookie.com/**', (r) =>
    r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>Youtube fixture</body></html>' }),
  );

  const page = await context.newPage();
  await page.goto(`${origin}/canvases/999001`);
  const a = page.locator('[data-item-id=one]');
  const other = page.locator('[data-item-id=two]');
  assert.equal(await page.locator('.shared-youtube-independent iframe').count(),0);
  await a.getByRole('button',{name:'YouTube 재생',exact:true}).click();
  await other.getByRole('button',{name:'YouTube 재생',exact:true}).click();
  await a.locator('.shared-youtube-independent iframe.shared-video-player').waitFor();
  await other.locator('.shared-youtube-independent iframe.shared-video-player').waitFor();

  // Independent YouTube embeds render without shared playback/loop mutation controls
  for (const loc of [a, other]) {
    assert.equal(await loc.getByRole('button', { name: '공유 재생', exact: true }).count(), 0);
    assert.equal(await loc.getByRole('button', { name: '공유 일시정지', exact: true }).count(), 0);
    assert.equal(await loc.getByRole('button', { name: '반복 재생', exact: true }).count(), 0);
    assert.ok((await loc.locator('iframe').getAttribute('src')).includes('playsinline=1&rel=0'));
  }

  await page.evaluate(() => {
    window.__ytOne = document.querySelector('[data-item-id=one] iframe.shared-video-player');
    window.__ytTwo = document.querySelector('[data-item-id=two] iframe.shared-video-player');
  });

  // Clicking player one activates only player one and emits zero shared canvas writes
  assert.equal(await a.locator('.shared-media-activate').count(), 0);
  assert.equal(await other.locator('.shared-media-activate').count(), 0);
  await a.click({ position: { x: 12, y: 12 } });
  assert.equal(await a.locator('.shared-media-activate').count(), 0);
  assert.equal(await other.locator('.shared-media-activate').count(), 0);

  // Remote mediaState/mediaLoop updates are ignored by independent YouTube embeds
  mainSocket.send(
    JSON.stringify({
      type: 'canvas_commit',
      author_id: 7,
      revision: 2,
      items: {
        one: {
          ...initialItems.one,
          mediaState: { paused: false, time: 120, updatedAt: Date.now(), actor: 'remote2' },
          mediaLoop: false,
        },
      },
    }),
  );
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(
      () =>
        window.__ytOne === document.querySelector('[data-item-id=one] iframe.shared-video-player') &&
        window.__ytTwo === document.querySelector('[data-item-id=two] iframe.shared-video-player'),
    ),
    true,
  );
  await page.locator('.canvas-stage').evaluate(stage=>stage.dispatchEvent(new WheelEvent('wheel',{deltaX:8000,deltaY:6000,bubbles:true,cancelable:true})));
  await page.waitForTimeout(350);
  assert.ok(await page.evaluate(()=>window.__ytOne===document.querySelector('[data-item-id=one] iframe')&&window.__ytTwo===document.querySelector('[data-item-id=two] iframe')),'active players retain identity outside the scene query window');
  assert.equal(writes, 0);

  console.log('PASS private YouTube playback for read-only users, independent controls/loop, historical/remote state ignored and zero shared writes');
} finally {
  await browser.close();
}
