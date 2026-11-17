import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5191';

const TOTAL_SHAPES = 3500;
const TOTAL_CONNECTORS = 500;

const initialItems = {};
for (let i = 0; i < TOTAL_SHAPES; i++) {
  const col = i % 70;
  const row = Math.floor(i / 70);
  initialItems[`shape-${i}`] = {
    kind: 'shape',
    shapeType: 'rectangle',
    x: 0.1 + col * 0.01,
    y: 0.1 + row * 0.012,
    width: 0.008,
    height: 0.009,
    fill: '#eee9fb',
    color: '#6852d6',
    permission: 'default',
  };
}
for (let i = 0; i < TOTAL_CONNECTORS; i++) {
  initialItems[`conn-${i}`] = {
    kind: 'connector',
    from: `shape-${i * 2}`,
    to: `shape-${i * 2 + 1}`,
    permission: 'default',
  };
}
initialItems['locked-keep'] = {
  kind: 'shape',
  shapeType: 'rectangle',
  x: 0.12,
  y: 0.78,
  width: 0.06,
  height: 0.05,
  fill: '#ffe4e6',
  color: '#be123c',
  locked: true,
  permission: 'default',
};

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    ...(process.env.AGORA_E2E_HOST_RESOLVER ? [`--host-resolver-rules=${process.env.AGORA_E2E_HOST_RESOLVER}`] : []),
  ],
});

const user = { email: 'bulk@example.invalid', nickname: 'BulkTester', tag_number: 1, role: 'ROLE_USER', status: 'ACTIVE' };
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')}.bulk-fixture`;
const errors = [];
const consoleErrors = [];

try {
  let revision = 0;
  const counts = new Map();
  const batches = [];
  const store = structuredClone(initialItems);

  const context = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
  });
  await context.addInitScript(({ authToken, authUser }) => {
    localStorage.setItem('agora_token', authToken);
    localStorage.setItem('agora_user', JSON.stringify(authUser));
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (entries) => {
          const blob = await entries[0].getType('text/plain');
          window.__copiedBulkText = await blob.text();
        },
        writeText: async (text) => {
          window.__copiedBulkText = text;
        },
        readText: async () => window.__copiedBulkText || '',
      },
    });
  }, { authToken: token, authUser: user });

  await context.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: user });
    if (path.endsWith('/access')) return route.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
    if (path.endsWith('/settings')) {
      return route.fulfill({ json: { canvas_name: 'Bulk delete fixture', settings_revision: 0, visibility: 'private', participants: [] } });
    }
    return route.fulfill({ json: { canvas_id: 999078, canvas_name: 'Bulk delete fixture', user_count: 1 } });
  });

  await context.routeWebSocket(/\/wss\/port\//, (ws) => {
    const rtc = ws.url().includes('/rtc/');
    const clientId = new URL(ws.url()).searchParams.get('client_id') || '';
    const snapshot = (type = 'init_items', cid = clientId) => ({
      type,
      client_id: cid,
      items: store,
      groups: ['default'],
      write_groups: ['default'],
      sync_protocol: 2,
      edit_protocol: 2,
      sync_user_id: 7,
      revision,
      accepted_count: counts.get(cid) || 0,
      rtc_canvas_connection_id: 'fixture',
      rtc_canvas_connection_hash: 'proof',
    });
    setTimeout(() => ws.send(JSON.stringify(rtc ? { type: 'rtc_ready' } : snapshot('init_items'))), 80);
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', request_id: msg.request_id }));
        return;
      }
      if (msg.type === 'canvas_sync') {
        ws.send(JSON.stringify(snapshot('canvas_snapshot', msg.client_id || clientId)));
        return;
      }
      if (msg.type === 'rtc_join') {
        ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer', peers: [] }));
        return;
      }
      if (msg.type !== 'canvas_ops') return;
      const cid = msg.client_id || clientId;
      if ((counts.get(cid) || 0) >= msg.request_count) {
        ws.send(JSON.stringify({
          type: 'canvas_result',
          request_id: msg.request_id,
          ok: true,
          duplicate: true,
          server_revision: revision,
        }));
        return;
      }
      batches.push(msg.operations.length);
      assert.ok(msg.operations.length <= 512, `Batch size ${msg.operations.length} exceeds 512 limit`);
      const commitItems = {};
      for (const op of msg.operations) {
        if (op.action === 'delete') {
          delete store[op.id];
          commitItems[op.id] = null;
        } else if (op.action === 'create') {
          store[op.id] = { ...op.patch };
          commitItems[op.id] = store[op.id];
        } else if (op.action === 'patch') {
          store[op.id] = { ...store[op.id], ...op.patch };
          commitItems[op.id] = store[op.id];
        }
      }
      counts.set(cid, msg.request_count);
      revision += 1;
      ws.send(JSON.stringify({
        type: 'canvas_commit',
        client_id: cid,
        author_id: 7,
        request_count: msg.request_count,
        revision,
        items: commitItems,
      }));
    });
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(`${origin}/canvases/999078`);
  await page.waitForFunction(
    (expected) => window.frelogCanvas && Object.keys(window.frelogCanvas.read().items).length === expected && !document.querySelector('.canvas-loading-status.is-overlay'),
    TOTAL_SHAPES + TOTAL_CONNECTORS + 1,
    { timeout: 60000 },
  );

  // Marquee-select across the full stage (selecting all 3,500 shapes + locked-keep; connectors cascade-delete).
  const stageBox = await page.locator('.canvas-stage').boundingBox();
  assert.ok(stageBox);
  await page.mouse.move(stageBox.x + 4, stageBox.y + stageBox.height - 16);
  await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width - 4, stageBox.y + 16, { steps: 6 });
  await page.mouse.up();
  const selectionText = await page.locator('.selection-actions-heading strong').textContent({ timeout: 10000 });
  const selectedCount = Number.parseInt(selectionText || '', 10);
  assert.equal(selectedCount, TOTAL_SHAPES + 1, `Expected ${TOTAL_SHAPES + 1} selected shapes, got "${selectionText}"`);

  // Measure UI response of pressing Delete on 3,501 selected items (500 connectors cascade-delete too)
  await page.evaluate(() => document.querySelector('.canvas-stage')?.focus());
  const deleteStart = Date.now();
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => Object.keys(window.frelogCanvas.read().items).length === 1, null, { timeout: 5000 });
  const localDeleteMs = Date.now() - deleteStart;
  assert.ok(localDeleteMs < 2000, `Bulk Delete blocked UI thread for ${localDeleteMs}ms`);

  // Wait for all 4,000 delete operations (8 batches <= 512 each) to commit on server
  const deadline = Date.now() + 15000;
  while (Object.keys(store).length > 1 && Date.now() < deadline) {
    await page.waitForTimeout(50);
  }
  assert.deepEqual(Object.keys(store), ['locked-keep']);
  assert.ok(batches.length >= Math.ceil((TOTAL_SHAPES + TOTAL_CONNECTORS) / 512));

  // Verify 1-step Undo restores all 4,000 deleted objects and syncs to server
  await page.evaluate(() => document.querySelector('.canvas-stage')?.focus());
  await page.keyboard.press('Control+z');
  await page.waitForFunction(
    (expected) => Object.keys(window.frelogCanvas.read().items).length === expected,
    TOTAL_SHAPES + TOTAL_CONNECTORS + 1,
    { timeout: 10000 },
  );
  const undoDeadline = Date.now() + 15000;
  while (Object.keys(store).length < TOTAL_SHAPES + TOTAL_CONNECTORS + 1 && Date.now() < undoDeadline) {
    await page.waitForTimeout(50);
  }
  assert.equal(Object.keys(store).length, TOTAL_SHAPES + TOTAL_CONNECTORS + 1);

  // Also test batch deletion through Canvas-as-Code API (window.frelogCanvas.apply)
  const codeTiming = await page.evaluate(() => {
    const api = window.frelogCanvas;
    const remove = [
      ...Array.from({ length: 400 }, (_, i) => `shape-${i}`),
      ...Array.from({ length: 200 }, (_, i) => `conn-${i}`),
    ];
    const t0 = performance.now();
    const preview = api.plan({ version: 1, mode: 'merge', items: {}, remove });
    const t1 = performance.now();
    api.apply(preview);
    const t2 = performance.now();
    return { planMs: Math.round(t1 - t0), applyMs: Math.round(t2 - t1) };
  });
  await page.waitForFunction(
    (expected) => Object.keys(window.frelogCanvas.read().items).length === expected,
    TOTAL_SHAPES + TOTAL_CONNECTORS + 1 - 400 - 200,
    { timeout: 10000 },
  );
  assert.ok(codeTiming.applyMs < 3000, `Canvas-as-Code batch delete apply took ${codeTiming.applyMs}ms`);
  const codeDeleteDeadline = Date.now() + 15000;
  while (Object.keys(store).length > TOTAL_SHAPES + TOTAL_CONNECTORS + 1 - 600 && Date.now() < codeDeleteDeadline) {
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => document.querySelector('.canvas-stage')?.focus());
  await page.keyboard.press('Control+z');
  await page.waitForFunction(
    (expected) => Object.keys(window.frelogCanvas.read().items).length === expected,
    TOTAL_SHAPES + TOTAL_CONNECTORS + 1,
    { timeout: 10000 },
  );
  const codeUndoDeadline = Date.now() + 15000;
  while (Object.keys(store).length < TOTAL_SHAPES + TOTAL_CONNECTORS + 1 && Date.now() < codeUndoDeadline) {
    await page.waitForTimeout(50);
  }

  // Test batch Cut (Control+x) across all 3,500 unlocked shapes + 500 connectors
  const topMarquee = await page.evaluate(() => {
    const stage = document.querySelector('.canvas-stage').getBoundingClientRect();
    const scale = Math.min(1, stage.width / 1600, stage.height / 1000);
    const ox = stage.left + (stage.width - 1600 * scale) / 2;
    const oy = stage.top + (stage.height - 1000 * scale) / 2;
    return {
      x1: ox + 0.05 * 1600 * scale,
      y1: oy + 0.05 * 1000 * scale,
      x2: ox + 0.85 * 1600 * scale,
      y2: oy + 0.73 * 1000 * scale,
    };
  });
  await page.mouse.move(topMarquee.x1, topMarquee.y1);
  await page.mouse.down();
  await page.mouse.move(topMarquee.x2, topMarquee.y2, { steps: 6 });
  await page.mouse.up();
  const cutSelText = await page.locator('.selection-actions-heading strong').textContent({ timeout: 10000 });
  assert.equal(Number.parseInt(cutSelText || '', 10), TOTAL_SHAPES);
  await page.evaluate(() => document.querySelector('.canvas-stage')?.focus());
  await page.keyboard.press('Control+x');
  await page.waitForFunction(() => Object.keys(window.frelogCanvas.read().items).length === 1, null, { timeout: 20000 });

  const persistDeadline = Date.now() + 15000;
  while (Object.keys(store).length > 1 && Date.now() < persistDeadline) {
    await page.waitForTimeout(50);
  }
  assert.deepEqual(Object.keys(store), ['locked-keep']);

  await page.reload();
  await page.waitForFunction(
    () => window.frelogCanvas && Object.keys(window.frelogCanvas.read().items).length === 1 && !document.querySelector('.canvas-loading-status.is-overlay'),
    null,
    { timeout: 30000 },
  );
  assert.deepEqual(Object.keys(store), ['locked-keep']);
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(`PASS bulk delete (${TOTAL_SHAPES} shapes + ${TOTAL_CONNECTORS} connectors, local=${localDeleteMs}ms, batches=${batches.length})`);
} finally {
  await browser.close();
}
