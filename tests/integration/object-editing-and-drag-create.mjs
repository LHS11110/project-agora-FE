// Verifies click-only object editing controls in the settings panel, corner/color unification, and drag-to-size creation across canvas object tools.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5191';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', ...(process.env.AGORA_E2E_HOST_RESOLVER ? ['--host-resolver-rules=' + process.env.AGORA_E2E_HOST_RESOLVER] : [])],
});

const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.editdrag';
const user = { email: 'editor@example.invalid', nickname: 'Editor', tag_number: 11, role: 'ROLE_USER', status: 'ACTIVE' };
const SVG_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#0ea5e9"/><circle cx="100" cy="80" r="36" fill="#fde047"/></svg>');

const initialItems = {
  photo1: { kind: 'image', src: SVG_PHOTO, filename: 'jeju-spot.svg', imageFrameEnabled: false, cornerStyle: 'sharp', x: 0.08, y: 0.12, width: 0.16, height: 0.16, permission: ['default'] },
  frameBox1: { kind: 'shape', shapeType: 'rectangle', fill: '#e2e8f0', color: '#0f172a', strokeEnabled: true, cornerStyle: 'rounded', x: 0.28, y: 0.12, width: 0.18, height: 0.16, permission: ['default'] },
  text1: { kind: 'text', text: '제주 로드트립 메모', renderMode: 'plain', color: '#22242a', x: 0.08, y: 0.36, width: 0.18, height: 0.08, permission: ['default'] },
  note1: { kind: 'note', text: '체크리스트 확인', color: '#fef08a', x: 0.30, y: 0.36, width: 0.14, height: 0.14, permission: ['default'] },
};

const peers = new Set();
const receipts = new Map();
const opsLog = [];
const errors = [];
let latest = structuredClone(initialItems);
let revision = 0;

try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'ko-KR', ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1' });
  await context.addInitScript(({ token, user }) => {
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    localStorage.setItem('agora_token', token);
    localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_canvas_panel_visibility_v1', JSON.stringify({ tools: false, inspector: false, chat: true }));
  }, { token, user });
  context.setDefaultTimeout(30000);

  await context.route(url => url.pathname.startsWith('/api/'), r => {
    const p = new URL(r.request().url()).pathname;
    let data = { canvas_id: 999044, canvas_name: '편집·드래그 테스트' };
    if (p === '/api/auth/me') data = user;
    else if (p.endsWith('/access')) data = { ws_port: 8002, canvas_access_token: 'fixture' };
    else if (p.endsWith('/settings')) data = { canvas_name: '편집·드래그 테스트', settings_revision: revision, visibility: 'private', participants: [], can_manage: true };
    return r.fulfill({ json: data });
  });

  await context.routeWebSocket(/\/wss\/port\//, ws => {
    const rtc = ws.url().includes('/rtc/');
    if (!rtc) {
      peers.add(ws);
      ws.onClose(() => peers.delete(ws));
    }
    setTimeout(() => ws.send(JSON.stringify(rtc
      ? { type: 'rtc_ready' }
      : { type: 'init_items', items: latest, groups: ['default'], write_groups: ['default'], is_admin: true, sync_protocol: 2, sync_user_id: 7, revision, accepted_count: 0, rtc_canvas_connection_id: 'fixture', rtc_canvas_connection_hash: 'proof' })), 100);
    ws.onMessage(raw => {
      const data = JSON.parse(String(raw));
      if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      if (data.type === 'canvas_sync') ws.send(JSON.stringify({ type: 'canvas_snapshot', client_id: data.client_id, items: latest, groups: ['default'], write_groups: ['default'], is_admin: true, sync_protocol: 2, sync_user_id: 7, revision, accepted_count: receipts.get(data.client_id) || 0 }));
      if (data.type === 'rtc_join') ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer', peers: [] }));
      if (data.type === 'canvas_ops') {
        receipts.set(data.client_id, data.request_count);
        const touched = {};
        for (const op of data.operations) {
          opsLog.push(op);
          if (op.action === 'delete') { delete latest[op.id]; continue; }
          latest[op.id] = { ...(latest[op.id] || {}), ...(op.patch || {}) };
          for (const field of op.unset || []) delete latest[op.id][field];
          touched[op.id] = latest[op.id];
        }
        const deleted = Object.fromEntries(data.operations.filter(o => o.action === 'delete').map(o => [o.id, null]));
        revision++;
        for (const peer of peers) peer.send(JSON.stringify({ type: 'canvas_commit', client_id: data.client_id, author_id: 7, request_count: data.request_count, revision, items: { ...touched, ...deleted } }));
      }
    });
  });

  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/canvases/999044');
  await page.locator('.canvas-loading-status.is-overlay').waitFor({ state: 'hidden' });
  await page.locator('[data-item-id="photo1"]').waitFor();

  const inspectorSlot = page.locator('.canvas-panel-slot-inspector');
  const stage = page.locator('.canvas-stage');
  const waitUntil = async (predicate, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await page.waitForTimeout(30);
    }
    throw new Error(`Timed out waiting for: ${label}`);
  };

  // 1. No selection -> ONLY workspace settings, NO object editor controls.
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '환경 설정');
  assert.equal(await inspectorSlot.locator('.inspector-object-editor').count(), 0);
  assert.equal(await inspectorSlot.getByText('객체 모서리', { exact: true }).count(), 0);
  assert.equal(await inspectorSlot.getByText('텍스트 색상', { exact: true }).count(), 0);

  // 2. Click photo -> object editing UI appears, cornerStyle persists and rounds image.
  await page.locator('[data-item-id="photo1"]').click();
  await inspectorSlot.locator('.inspector-object-editor').waitFor();
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '이미지 편집');
  assert.equal(await inspectorSlot.getByRole('button', { name: '각지게', exact: true }).getAttribute('aria-pressed'), 'true');
  await inspectorSlot.getByRole('button', { name: '둥글게', exact: true }).click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-item-id="photo1"]')).borderTopLeftRadius === '24px');
  await waitUntil(() => latest.photo1.cornerStyle === 'rounded', 'photo1 rounded committed');

  // Reset to sharp, then Shift-click frameBox1 (Pixi vector shape at world center 0.37, 0.20) -> unified multi-selection corner edit.
  await inspectorSlot.getByRole('button', { name: '각지게', exact: true }).click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-item-id="photo1"]')).borderTopLeftRadius === '0px');
  await waitUntil(() => latest.photo1.cornerStyle === 'sharp', 'photo1 sharp committed');
  const worldBox = await page.locator('.canvas-world-layer').first().boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.click(worldBox.x + 0.37 * worldBox.width, worldBox.y + 0.20 * worldBox.height);
  await page.keyboard.up('Shift');
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '객체 2개 편집');
  await inspectorSlot.getByText('이미지·테두리 도형 등 선택한 객체의 모서리를 한 번에 맞춥니다.').waitFor();
  assert.equal(await inspectorSlot.locator('.object-corner-controls').getByRole('button', { name: '둥글게', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await inspectorSlot.locator('.object-corner-controls').getByRole('button', { name: '각지게', exact: true }).getAttribute('aria-pressed'), 'false');
  await inspectorSlot.locator('.object-corner-controls').getByRole('button', { name: '둥글게', exact: true }).click();
  await waitUntil(() => latest.photo1.cornerStyle === 'rounded' && latest.frameBox1.cornerStyle === 'rounded', 'batch corners rounded');

  // 3. Click text (world center 0.17, 0.40) -> whole-text color editing; click note (0.37, 0.43) -> swatch editing in select mode.
  await page.mouse.click(worldBox.x + 0.17 * worldBox.width, worldBox.y + 0.40 * worldBox.height);
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '텍스트 편집');
  await inspectorSlot.getByRole('group', { name: '텍스트 색상 · 자주 쓰는 색상' }).waitFor();
  const firstTextSwatch = inspectorSlot.getByRole('group', { name: '텍스트 색상 · 자주 쓰는 색상' }).locator('button').nth(1);
  await firstTextSwatch.click();
  await waitUntil(() => latest.text1.color !== '#22242a', 'text1 color updated');

  await page.mouse.click(worldBox.x + 0.37 * worldBox.width, worldBox.y + 0.43 * worldBox.height);
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '포스트잇 편집');
  const noteButtons = inspectorSlot.locator('.sticky-note-colors button');
  await noteButtons.nth(2).click();
  await waitUntil(() => latest.note1.color !== '#fef08a', 'note1 color updated');

  // 4. Deselect on empty stage -> object editor hides again.
  const stageBox = await stage.boundingBox();
  const emptyX = worldBox.x + 0.68 * worldBox.width;
  const emptyY = worldBox.y + 0.18 * worldBox.height;
  await page.mouse.click(emptyX, emptyY);
  await page.waitForFunction(() => document.querySelectorAll('.inspector-object-editor').length === 0);
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '환경 설정');

  // 5. Collapsed inspector auto-expands on object click and auto-restores collapse on deselect.
  await page.getByRole('button', { name: '설정 패널 접기', exact: true }).click();
  await page.getByRole('button', { name: '설정 패널 펼치기', exact: true }).waitFor();
  await page.locator('[data-item-id="photo1"]').click();
  await page.getByRole('button', { name: '설정 패널 접기', exact: true }).waitFor();
  await inspectorSlot.locator('.inspector-object-editor').waitFor();
  await page.mouse.click(emptyX, emptyY);
  await page.getByRole('button', { name: '설정 패널 펼치기', exact: true }).waitFor();

  // Re-open inspector & expand all tool folders for drag creation tests.
  await page.getByRole('button', { name: '설정 패널 펼치기', exact: true }).click();
  await page.getByRole('button', { name: '모두 열기', exact: true }).click();

  const createdIdsOfKind = kind => Object.keys(latest).filter(id => !(id in initialItems) && latest[id]?.kind === kind);
  const selectTool = async toolId => {
    const btn = page.locator(`[data-folder-tool-id="${toolId}"] button.tool-button`);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  };
  const dragCreateOnStage = async (startFracX, startFracY, dx, dy, { shift = false } = {}) => {
    const sx = worldBox.x + worldBox.width * startFracX;
    const sy = worldBox.y + worldBox.height * startFracY;
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + dx, sy + dy, { steps: 10 });
    const preview = page.locator('.canvas-creation-preview');
    await preview.waitFor();
    const previewBox = await preview.boundingBox();
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
    return previewBox;
  };

  // 6. Shape drag creation + Shift square drag creation.
  await selectTool('shape');
  const shapePreview = await dragCreateOnStage(0.52, 0.14, 220, 120);
  assert.ok(shapePreview.width >= 205 && shapePreview.width <= 235, `shape preview width ${shapePreview.width}`);
  assert.ok(shapePreview.height >= 105 && shapePreview.height <= 135, `shape preview height ${shapePreview.height}`);
  await waitUntil(() => createdIdsOfKind('shape').length === 1, 'drag shape created');
  const shapeIds = createdIdsOfKind('shape');

  await selectTool('shape');
  const squarePreview = await dragCreateOnStage(0.52, 0.34, 200, 110, { shift: true });
  assert.ok(Math.abs(squarePreview.width - squarePreview.height) <= 2, `Shift-lock square preview ${squarePreview.width}x${squarePreview.height}`);
  await waitUntil(() => createdIdsOfKind('shape').length === 2, 'Shift-square shape created');
  const shapeIdsAfterSquare = createdIdsOfKind('shape');
  const squareItemId = shapeIdsAfterSquare.find(id => !shapeIds.includes(id));
  const squareItem = latest[squareItemId];
  assert.ok(Math.abs(squareItem.width * 1600 - squareItem.height * 1000) <= 6, 'square item world ratio matches 1:1');

  // 7. Text click vs drag creation, plus Note / Table / Chart drag creation.
  await selectTool('text');
  await page.mouse.click(worldBox.x + worldBox.width * 0.54, worldBox.y + worldBox.height * 0.54);
  await waitUntil(() => createdIdsOfKind('text').length === 1, 'click text created');
  const clickTextId = createdIdsOfKind('text')[0];
  await page.mouse.click(emptyX, emptyY);

  await selectTool('text');
  await dragCreateOnStage(0.68, 0.14, 240, 140);
  await waitUntil(() => createdIdsOfKind('text').length === 2, 'drag text created');
  const dragTextId = createdIdsOfKind('text').find(id => id !== clickTextId);
  assert.equal(latest[clickTextId].height, undefined, 'click text leaves height auto');
  assert.ok(Number.isFinite(latest[dragTextId].height) && latest[dragTextId].height > 0.12, 'dragged text box preserves dragged height');
  await page.mouse.click(emptyX, emptyY);

  await selectTool('note');
  await dragCreateOnStage(0.68, 0.34, 230, 180);
  await waitUntil(() => createdIdsOfKind('note').length === 1, 'drag note created');
  const noteId = createdIdsOfKind('note')[0];
  assert.ok(latest[noteId].width > initialItems.note1.width, 'dragged note is larger than default click note');
  await page.mouse.click(emptyX, emptyY);

  await selectTool('table');
  await dragCreateOnStage(0.52, 0.62, 260, 160);
  await waitUntil(() => createdIdsOfKind('table').length === 1, 'drag table created');

  await selectTool('chart');
  await dragCreateOnStage(0.70, 0.60, 250, 170);
  await waitUntil(() => createdIdsOfKind('chart').length === 1, 'drag chart created');

  assert.deepEqual(errors, [], 'no runtime pageerrors during object editing and drag creation');
  console.log('PASS object-editing-and-drag-create integration flow');
} finally {
  await browser.close();
}
