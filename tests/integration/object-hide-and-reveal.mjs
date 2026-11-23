// End-to-end test for canvas object hide/show, preview mode, hidden manager, and reveal-after-animation
// across two synchronized clients and frame presentation mode.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5191';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    ...(process.env.AGORA_E2E_HOST_RESOLVER ? [`--host-resolver-rules=${process.env.AGORA_E2E_HOST_RESOLVER}`] : []),
  ],
});

const user = { email: 'visibility@example.invalid', nickname: 'Visibility Tester', tag_number: 19, role: 'ROLE_USER', status: 'ACTIVE' };
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.vis`;

const initialItems = {
  box1: { kind: 'shape', shapeType: 'rectangle', visualStyle: 'standard', fill: '#dbeafe', color: '#1d4ed8', strokeWidth: 2, x: 0.14, y: 0.18, width: 0.16, height: 0.12, permission: ['default'] },
  noteCard: { kind: 'text', text: '발표 카드 내용', renderMode: 'plain', color: '#0f172a', x: 0.36, y: 0.18, width: 0.18, height: 0.12, permission: ['default'] },
  frame1: { kind: 'frame', title: '숨김 테스트 슬라이드', text: '', frameOrder: 0, fill: '#ffffff', depth: -1000, x: 0.56, y: 0.12, width: 0.34, height: 0.42, rotation: 0, permission: ['default'] },
  animBox: { kind: 'shape', shapeType: 'rectangle', visualStyle: 'standard', fill: '#dcfce7', color: '#15803d', strokeWidth: 2, frameId: 'frame1', animationPriority: 0, animation: { effect: 'zoom', duration: 350, delay: 0, loop: false, easing: 'ease-in-out', distance: 40 }, x: 0.62, y: 0.22, width: 0.18, height: 0.14, permission: ['default'] },
};

let store = structuredClone(initialItems);
let revision = 0;
const sockets = new Set();
const receipts = new Map();
const errors = [];

function applyOperation(op) {
  if (op.action === 'delete') {
    delete store[op.id];
    return;
  }
  const prev = store[op.id] || {};
  const next = { ...prev, ...(op.patch || {}) };
  for (const field of op.unset || []) delete next[field];
  // Emulate C++ CanvasPresentation::stamp() behavior for play commands and frame cursor advances
  if (op.patch?.animationPlayback?.action === 'play' && op.patch.animationPlayback.startedAt === 0) {
    next.animationPlayback = { ...op.patch.animationPlayback, startedAt: Date.now() + 140 };
  }
  if (op.patch?.portfolioCursor && op.patch.portfolioCursor.startedAt === 0) {
    next.portfolioCursor = { ...op.patch.portfolioCursor, startedAt: Date.now() + 140 };
  }
  store[op.id] = next;
}

async function createClientContext() {
  const ctx = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1520, height: 980 },
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
  });
  await ctx.addInitScript(({ user, token }) => {
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    ((t)=>{const f=window.fetch;window.fetch=function(input){return String(input?.url??input).includes('/api/auth/session/refresh')?Promise.resolve(new Response(JSON.stringify({accessToken:t}),{status:200,headers:{'Content-Type':'application/json'}})):f.apply(this,arguments);};})(token);
    localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_canvas_panel_visibility_v1', JSON.stringify({ tools: false, inspector: false, chat: true }));
  }, { user, token });

  await ctx.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/me') return route.fulfill({ json: user });
    if (pathname.endsWith('/access')) return route.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
    if (pathname.endsWith('/settings')) return route.fulfill({ json: { canvas_name: 'Hide & Reveal Test', settings_revision: revision, participants: [], can_manage: true } });
    return route.fulfill({ json: { canvas_id: 999077, canvas_name: 'Hide & Reveal Test', user_count: 2 } });
  });

  await ctx.routeWebSocket(/\/wss\/port\//, (ws) => {
    const rtc = ws.url().includes('/rtc/');
    const clientId = new URL(ws.url()).searchParams.get('client_id');
    if (!rtc) sockets.add(ws);
    const snapshot = () => ({
      type: 'init_items',
      items: store,
      groups: ['default'],
      write_groups: ['default'],
      is_admin: true,
      sync_protocol: 2,
      sync_user_id: 7,
      revision,
      accepted_count: receipts.get(clientId) || 0,
      rtc_canvas_connection_id: 'fixture',
      rtc_canvas_connection_hash: 'proof',
    });
    setTimeout(() => ws.send(JSON.stringify(rtc ? { type: 'rtc_ready' } : snapshot())), 80);
    ws.onClose(() => sockets.delete(ws));
    ws.onMessage((raw) => {
      const data = JSON.parse(String(raw));
      if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      if (data.type === 'canvas_sync') {
        ws.send(JSON.stringify({
          type: 'canvas_snapshot',
          client_id: data.client_id,
          items: store,
          groups: ['default'],
          write_groups: ['default'],
          is_admin: true,
          sync_protocol: 2,
          sync_user_id: 7,
          revision,
          accepted_count: receipts.get(clientId) || 0,
        }));
      }
      if (data.type === 'rtc_join') ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer', peers: [] }));
      if (data.type === 'canvas_ops') {
        receipts.set(clientId, data.request_count);
        const touched = {};
        for (const op of data.operations) {
          applyOperation(op);
          touched[op.id] = op.action === 'delete' ? null : store[op.id];
        }
        revision += 1;
        const commit = {
          type: 'canvas_commit',
          items: touched,
          revision,
          client_id: clientId,
          author_id: 7,
          request_count: data.request_count,
        };
        for (const peer of sockets) peer.send(JSON.stringify(commit));
      }
    });
  });
  return ctx;
}

async function itemScreenCenter(page, key) {
  const item = store[key];
  const box = await page.locator('.canvas-stage').boundingBox();
  const scale = Math.min(1, box.width / 1600, box.height / 1000);
  const x = box.x + (box.width - 1600 * scale) / 2 + (item.x + item.width / 2) * 1600 * scale;
  const y = box.y + (box.height - 1000 * scale) / 2 + (item.y + item.height / 2) * 1000 * scale;
  return { x, y };
}

async function clickItem(page, key) {
  const pt = await itemScreenCenter(page, key);
  await page.mouse.click(pt.x, pt.y);
  await page.locator(`[data-item-id="${key}"].selected`).waitFor();
  return pt;
}

try {
  const ctxA = await createClientContext();
  const ctxB = await createClientContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  for (const page of [pageA, pageB]) {
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${origin}/canvases/999077`);
    await page.waitForFunction(() => Boolean(window.frelogCanvas?.read().items.noteCard));
  }
  await pageA.waitForTimeout(200);

  // 1. Select & hide `noteCard` from FloatingContextToolbar -> disappears on both A & B and cannot be stage-clicked
  const noteCenter = await clickItem(pageA, 'noteCard');
  await pageA.locator('.canvas-floating-context-bar').getByRole('button', { name: '선택 객체 숨김' }).click();
  await pageA.waitForFunction(() => document.querySelectorAll('[data-item-id="noteCard"]').length === 0);
  await pageB.waitForFunction(() => document.querySelectorAll('[data-item-id="noteCard"]').length === 0);

  // Clicking empty stage coordinates of hidden noteCard must NOT select it on A or B
  await pageA.mouse.click(noteCenter.x, noteCenter.y);
  await pageB.mouse.click(noteCenter.x, noteCenter.y);
  await pageA.waitForTimeout(150);
  assert.equal(await pageA.locator('[data-item-id="noteCard"].selected').count(), 0);
  assert.equal(await pageB.locator('[data-item-id="noteCard"].selected').count(), 0);

  // Hidden Objects Manager appears in Inspector even with nothing selected
  const hiddenMgr = pageA.getByRole('region', { name: '숨겨진 객체' });
  await hiddenMgr.waitFor();

  // 2. Toggle preview mode on A -> faint dashed preview appears on A while staying hidden/unselectable on B
  await hiddenMgr.getByRole('switch', { name: '숨김 객체 미리보기' }).click();
  await pageA.locator('[data-item-id="noteCard"].canvas-object-hidden-preview').waitFor();
  assert.equal(await pageA.locator('[data-item-id="noteCard"] .object-hidden-badge').count(), 1);
  assert.equal(await pageB.locator('[data-item-id="noteCard"]').count(), 0);

  // Unhide `noteCard` from Hidden Objects Manager -> becomes visible & clickable again on both A & B
  await hiddenMgr.getByRole('button', { name: '표시', exact: true }).first().click();
  await pageA.waitForFunction(() => !String(window.frelogCanvas.read().items.noteCard?.brush || '').includes('"hidden":true'));
  await pageB.waitForFunction(() => !String(window.frelogCanvas.read().items.noteCard?.brush || '').includes('"hidden":true'));
  await pageA.waitForFunction(() => document.querySelectorAll('[data-item-id="noteCard"].canvas-object-hidden-preview').length === 0);
  await pageB.waitForTimeout(100);
  await clickItem(pageB, 'noteCard');
  await pageB.mouse.click(noteCenter.x - 160, noteCenter.y); // deselect B

  // Turn off preview toggle before next phase so hidden state is tested under normal viewing
  await clickItem(pageA, 'box1');
  const boxCenter = await itemScreenCenter(pageA, 'box1');
  const visRegion = pageA.getByRole('region', { name: '객체 표시 / 숨김' });
  // Turn preview off if currently enabled (uncheck)
  const previewCb = visRegion.getByRole('checkbox', { name: '숨긴 객체 미리보기' });
  if (await previewCb.count() && await previewCb.isChecked()) await previewCb.uncheck();

  // 3. Configure `box1` for "애니메이션 재생 후 표시" with delay = 0.35s, duration = 0.4s
  await visRegion.getByRole('checkbox', { name: '애니메이션 재생 후 표시' }).check();
  const previewInMgr = hiddenMgr.getByRole('switch', { name: '숨김 객체 미리보기' });
  if (await previewInMgr.count() && (await previewInMgr.getAttribute('aria-checked')) === 'true') {
    await previewInMgr.click();
  }
  await pageA.waitForFunction(() => document.querySelectorAll('[data-item-id="box1"]').length === 0);
  await pageB.waitForFunction(() => document.querySelectorAll('[data-item-id="box1"]').length === 0);

  // Clicking hidden `box1` coordinates on stage must NOT select it on A or B
  await pageB.mouse.click(boxCenter.x, boxCenter.y);
  await pageB.waitForTimeout(120);
  assert.equal(await pageB.locator('[data-item-id="box1"].selected').count(), 0);

  // Tune timing inside Object Animation panel (box1 remains editable in Inspector)
  const animDelayInput = pageA.getByLabel('시작 지연 (초)');
  await animDelayInput.fill('0.35');
  const animDurationInput = pageA.getByLabel('재생 시간 (초)');
  await animDurationInput.fill('0.4');
  await pageA.waitForTimeout(100);

  // Trigger animation playback -> stays hidden during 140ms server stamp + 350ms delay (~490ms)
  await pageA.getByRole('button', { name: '선택 애니메이션 재생' }).click();
  await pageA.waitForTimeout(220);
  const hiddenDuringDelayA = await pageA.evaluate(() => {
    const el = document.querySelector('[data-item-id="box1"]');
    return !el || getComputedStyle(el).visibility === 'hidden' || Number(getComputedStyle(el).opacity) < 0.05;
  });
  assert.equal(hiddenDuringDelayA, true, 'box1 must remain hidden during start delay before animation starts');

  // Wait past stamp (140ms) + delay (350ms) + duration (400ms) -> box1 must animate into view and remain visible on A & B
  await pageA.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="box1"]');
    return Boolean(el) && !el.classList.contains('canvas-object-hidden') && Number(getComputedStyle(el).opacity) > 0.9;
  }, {}, { timeout: 3000 });
  await pageB.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="box1"]');
    return Boolean(el) && !el.classList.contains('canvas-object-hidden') && Number(getComputedStyle(el).opacity) > 0.9;
  }, {}, { timeout: 3000 });

  // Clicking "애니메이션 정지" returns `box1` back to hidden
  await pageA.getByRole('button', { name: '애니메이션 정지', exact: true }).click();
  await pageA.waitForFunction(() => document.querySelectorAll('[data-item-id="box1"]').length === 0);
  await pageB.waitForFunction(() => document.querySelectorAll('[data-item-id="box1"]').length === 0);

  // 4. One-click "지금 애니메이션으로 표시" on a hidden object with effect='none' (noteCard)
  await clickItem(pageA, 'noteCard');
  await pageA.getByRole('region', { name: '객체 표시 / 숨김' }).getByRole('button', { name: '객체 숨김', exact: true }).click();
  await pageA.getByRole('button', { name: '지금 애니메이션으로 표시', exact: true }).click();
  await pageA.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="noteCard"]');
    return Boolean(el) && !el.classList.contains('canvas-object-hidden') && Number(getComputedStyle(el).opacity) > 0.9;
  }, {}, { timeout: 3000 });
  await pageB.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="noteCard"]');
    return Boolean(el) && !el.classList.contains('canvas-object-hidden') && Number(getComputedStyle(el).opacity) > 0.9;
  }, {}, { timeout: 3000 });

  // 5. Frame presentation step (`Space`) reveals hidden+revealAfterAnimation `animBox` inside `frame1`
  await clickItem(pageA, 'animBox');
  await pageA.getByRole('region', { name: '객체 표시 / 숨김' }).getByRole('checkbox', { name: '애니메이션 재생 후 표시' }).check();
  await pageA.waitForFunction(() => document.querySelectorAll('[data-item-id="animBox"]').length === 0);
  await pageA.mouse.click(noteCenter.x - 180, noteCenter.y); // deselect
  await pageA.getByRole('button', { name: '프레임 내부 보기' }).click();
  await pageA.locator('.portfolio-viewer').waitFor();
  await pageA.waitForFunction(() => (window.frelogCanvas?.read().items['portfolio-settings']?.portfolioCursor?.startedAt || 0) > 0);
  assert.equal(await pageA.locator('[data-item-id="animBox"]').count(), 0, 'hidden reveal object must stay hidden before its presentation step');
  await pageA.keyboard.press('Space');
  await pageA.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="animBox"]');
    return Boolean(el) && !el.classList.contains('canvas-object-hidden') && Number(getComputedStyle(el).opacity) > 0.9;
  }, {}, { timeout: 3000 });

  assert.deepEqual(errors, []);
  console.log('PASS E2E hide/show, preview ghost, hidden objects manager, reveal-after-animation with delay + duration + stop, 1-click reveal, and frame presentation Space reveal across two clients');
} finally {
  await browser.close();
}
