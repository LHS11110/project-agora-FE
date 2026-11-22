// Verifies Figma-style & web-canvas advanced object styling, floating toolbar, presets/tokens,
// multi-selection intersection, style copy/paste, Auto Layout, and connector routing/flow animation.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5199';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', ...(process.env.AGORA_E2E_HOST_RESOLVER ? ['--host-resolver-rules=' + process.env.AGORA_E2E_HOST_RESOLVER] : [])],
});

const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.advstyle';
const user = { email: 'designer@example.invalid', nickname: 'Designer', tag_number: 22, role: 'ROLE_USER', status: 'ACTIVE' };

const initialItems = {
  box1: { kind: 'shape', shapeType: 'rectangle', fill: '#e2e8f0', color: '#0f172a', strokeEnabled: true, cornerStyle: 'sharp', depth: 1, x: 0.08, y: 0.14, width: 0.18, height: 0.18, permission: ['default'] },
  card2: { kind: 'shape', shapeType: 'rectangle', fill: '#fde68a', color: '#b45309', strokeEnabled: true, cornerStyle: 'rounded', depth: 2, x: 0.30, y: 0.14, width: 0.18, height: 0.18, permission: ['default'] },
  text1: { kind: 'text', text: '여행 일정 타이틀\n세부 설명 문단입니다.', renderMode: 'plain', color: '#1e293b', depth: 3, x: 0.08, y: 0.38, width: 0.22, height: 0.14, permission: ['default'] },
  note1: { kind: 'note', text: '제주도 맛집 리스트', color: '#fef08a', depth: 4, x: 0.34, y: 0.38, width: 0.16, height: 0.14, permission: ['default'] },
  frame1: { kind: 'frame', title: 'Auto Layout Container', depth: 0, x: 0.54, y: 0.12, width: 0.34, height: 0.30, permission: ['default'] },
  child1: { kind: 'shape', shapeType: 'rectangle', fill: '#a7f3d0', color: '#065f46', strokeEnabled: true, depth: 5, x: 0.57, y: 0.22, width: 0.09, height: 0.08, permission: ['default'] },
  child2: { kind: 'shape', shapeType: 'rectangle', fill: '#bfdbfe', color: '#1e40af', strokeEnabled: true, depth: 6, x: 0.72, y: 0.17, width: 0.10, height: 0.09, permission: ['default'] },
  conn1: { kind: 'connector', from: 'box1', to: 'card2', label: '다음 단계', color: '#6366f1', strokeWidth: 2, endHead: 'arrow', depth: 7, permission: ['default'] },
};

const peers = new Set();
const receipts = new Map();
const errors = [];
let latest = structuredClone(initialItems);
let revision = 0;

try {
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1050 },
    locale: 'ko-KR',
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
  });
  await context.addInitScript(({ token, user }) => {
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    localStorage.setItem('agora_token', token);
    localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_canvas_panel_visibility_v1', JSON.stringify({ tools: false, inspector: true, chat: false }));
  }, { token, user });
  context.setDefaultTimeout(30000);

  await context.route((url) => url.pathname.startsWith('/api/'), (r) => {
    const p = new URL(r.request().url()).pathname;
    let data = { canvas_id: 999055, canvas_name: '고급 스타일링 테스트' };
    if (p === '/api/auth/session/refresh') data = { tokenType: 'Bearer', accessToken: token, user };
    else if (p === '/api/auth/me') data = user;
    else if (p.endsWith('/access')) data = { ws_port: 8002, canvas_access_token: 'fixture' };
    else if (p.endsWith('/settings')) data = { canvas_name: '고급 스타일링 테스트', settings_revision: revision, visibility: 'private', participants: [], can_manage: true };
    return r.fulfill({ json: data });
  });

  await context.routeWebSocket(/\/wss\/port\//, (ws) => {
    const rtc = ws.url().includes('/rtc/');
    if (!rtc) {
      peers.add(ws);
      ws.onClose(() => peers.delete(ws));
    }
    setTimeout(() => ws.send(JSON.stringify(rtc
      ? { type: 'rtc_ready' }
      : { type: 'init_items', items: latest, groups: ['default'], write_groups: ['default'], is_admin: true, sync_protocol: 2, sync_user_id: 7, revision, accepted_count: 0, rtc_canvas_connection_id: 'fixture', rtc_canvas_connection_hash: 'proof' })), 100);
    ws.onMessage((raw) => {
      const data = JSON.parse(String(raw));
      if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      if (data.type === 'canvas_sync') ws.send(JSON.stringify({ type: 'canvas_snapshot', client_id: data.client_id, items: latest, groups: ['default'], write_groups: ['default'], is_admin: true, sync_protocol: 2, sync_user_id: 7, revision, accepted_count: receipts.get(data.client_id) || 0 }));
      if (data.type === 'rtc_join') ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer', peers: [] }));
      if (data.type === 'canvas_ops') {
        receipts.set(data.client_id, data.request_count);
        const touched = {};
        for (const op of data.operations) {
          if (op.action === 'delete') { delete latest[op.id]; continue; }
          if (op.action === 'translate') {
            for (const id of op.ids) {
              latest[id] = { ...latest[id], x: latest[id].x + op.dx, y: latest[id].y + op.dy };
              touched[id] = latest[id];
            }
            continue;
          }
          latest[op.id] = { ...(latest[op.id] || {}), ...(op.patch || {}) };
          for (const field of op.unset || []) delete latest[op.id][field];
          touched[op.id] = latest[op.id];
        }
        const deleted = Object.fromEntries(data.operations.filter((o) => o.action === 'delete').map((o) => [o.id, null]));
        revision++;
        for (const peer of peers) peer.send(JSON.stringify({ type: 'canvas_commit', client_id: data.client_id, author_id: 7, request_count: data.request_count, revision, items: { ...touched, ...deleted } }));
      }
    });
  });

  const page = await context.newPage();
  page.on('pageerror', (e) => {
    console.error('PAGEERROR:', e.message);
    errors.push(e.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('CONSOLE:', m.text());
  });
  await page.goto(origin + '/canvases/999055');
  await page.locator('.canvas-loading-status.is-overlay').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => Boolean(window.frelogCanvas?.read().items?.text1));
  await page.locator('.canvas-world-layer').first().waitFor();

  const inspectorSlot = page.locator('.canvas-panel-slot-inspector');
  const floatingBar = page.locator('.canvas-floating-context-bar');
  const worldBox = await page.locator('.canvas-world-layer').first().boundingBox();
  const waitUntil = async (predicate, label) => {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await page.waitForTimeout(30);
    }
    throw new Error(`Timed out waiting for: ${label}`);
  };

  // 1. Click shape box1 at its world center (0.17, 0.23) -> Inspector + Floating Toolbar appear.
  await page.mouse.click(worldBox.x + 0.17 * worldBox.width, worldBox.y + 0.23 * worldBox.height);
  await inspectorSlot.locator('.inspector-object-editor').waitFor();
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '도형 편집');
  await floatingBar.waitFor();

  // 2. Layout & Geometry: opacity, blendMode, per-corner radii
  await inspectorSlot.getByLabel('객체 자체 투명도', { exact: true }).fill('80');
  await waitUntil(() => Math.abs((latest.box1.opacity ?? 1) - 0.8) < 0.02, 'box1 opacity 80%');
  await inspectorSlot.getByLabel('객체 블렌드 모드', { exact: true }).selectOption('multiply');
  await waitUntil(() => (latest.box1.brush || '').includes('"blendMode":"multiply"'), 'box1 blendMode multiply');

  await inspectorSlot.getByTitle('4개 모서리 개별 지정', { exact: true }).click();
  await inspectorSlot.getByLabel('좌상 TL', { exact: true }).fill('36');
  await inspectorSlot.getByLabel('우상 TR', { exact: true }).fill('12');
  await inspectorSlot.getByLabel('우하 BR', { exact: true }).fill('28');
  await inspectorSlot.getByLabel('좌하 BL', { exact: true }).fill('6');
  await waitUntil(() => (latest.box1.brush || '').includes('"tl":36') && (latest.box1.brush || '').includes('"bl":6'), 'box1 per-corner radii');

  await page.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="box1"]');
    if (!el) return false;
    const cs = getComputedStyle(el);
    const svgPath = el.querySelector('.canvas-shape-svg path')?.getAttribute('d') || '';
    return cs.mixBlendMode === 'multiply' && Math.abs(parseFloat(cs.opacity) - 0.8) < 0.05 && svgPath.includes('Q ');
  });

  // 3. Multi-Layer Fills: add second gradient layer -> switch to conic gradient
  await inspectorSlot.getByLabel('채우기 레이어 추가', { exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-item-id="box1"] .canvas-object-fill-layer').length >= 2);
  await inspectorSlot.getByLabel('채우기 유형').last().selectOption('conic');
  await page.waitForFunction(() => {
    const layers = document.querySelectorAll('[data-item-id="box1"] .canvas-object-fill-layer');
    return Array.from(layers).some((l) => getComputedStyle(l).backgroundImage.includes('conic-gradient'));
  });

  // 4. Advanced Stroke: individual border widths & dashed stroke
  await inspectorSlot.getByTitle('상하좌우 개별 두께 지정', { exact: true }).click();
  await inspectorSlot.getByLabel('상 T', { exact: true }).fill('6');
  await inspectorSlot.getByLabel('좌 L', { exact: true }).fill('4');
  await page.waitForFunction(() => {
    const ring = document.querySelector('[data-item-id="box1"] .canvas-object-stroke-ring');
    return ring && getComputedStyle(ring).borderTopWidth === '6px' && getComputedStyle(ring).borderLeftWidth === '4px';
  });
  await inspectorSlot.getByLabel('점선 패턴', { exact: true }).selectOption('dashed');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-item-id="box1"] .canvas-shape-svg path[stroke-dasharray]')));

  // 5. Effects, Filters & Custom CSS
  await inspectorSlot.getByLabel('효과 추가', { exact: true }).click();
  await inspectorSlot.getByLabel('효과 유형').last().selectOption('background-blur');
  await inspectorSlot.getByLabel('흑백', { exact: true }).fill('50');
  await inspectorSlot.getByLabel('커스텀 인라인 CSS 입력', { exact: true }).fill('letter-spacing: 2px; border-style: dotted;');
  await inspectorSlot.getByRole('button', { name: 'CSS 적용', exact: true }).click();
  await page.waitForFunction(() => {
    const host = document.querySelector('[data-item-id="box1"]');
    const surface = host?.querySelector('.canvas-shape-advanced-surface');
    if (!host || !surface) return false;
    const hcs = getComputedStyle(host);
    const scs = getComputedStyle(surface);
    return (scs.backdropFilter || scs.webkitBackdropFilter || '').includes('blur(')
      && scs.filter.includes('grayscale(')
      && hcs.letterSpacing === '2px';
  });

  // 6. Typography on text1 (world center 0.19, 0.45)
  await page.mouse.click(worldBox.x + 0.19 * worldBox.width, worldBox.y + 0.45 * worldBox.height);
  await page.locator('[data-item-id="text1"]').waitFor();
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '텍스트 편집');
  await inspectorSlot.getByLabel('폰트 굵기', { exact: true }).selectOption('700');
  await inspectorSlot.getByLabel('행간', { exact: true }).fill('2');
  await inspectorSlot.getByLabel('자간', { exact: true }).fill('3');
  await inspectorSlot.getByLabel('텍스트 정렬', { exact: true }).selectOption('center');
  await inspectorSlot.getByLabel('텍스트 초과 처리', { exact: true }).selectOption('truncate');
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="text1"]');
    if (!el) return false;
    const cs = getComputedStyle(el);
    return el.classList.contains('has-custom-typography')
      && el.classList.contains('has-typo-truncate')
      && cs.fontWeight === '700'
      && cs.letterSpacing === '3px'
      && cs.textAlign === 'center';
  });

  // 7. Connector orthogonal routing + flow animation + label style on conn1 (midpoint 0.28, 0.23)
  await page.mouse.click(worldBox.x + 0.28 * worldBox.width, worldBox.y + 0.23 * worldBox.height);
  await page.locator('[data-item-id="conn1"]').waitFor();
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '연결 편집');
  await inspectorSlot.getByLabel('연결선 경로 방식', { exact: true }).selectOption('orthogonal');
  await inspectorSlot.getByLabel('연결선 흐름 애니메이션', { exact: true }).selectOption('forward');
  await inspectorSlot.getByLabel('라벨 배경 색상', { exact: true }).fill('#eef2ff');
  await waitUntil(() => (latest.conn1.brush || '').includes('"routing":"orthogonal"'), 'conn1 orthogonal committed');
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-item-id="conn1"]');
    const svg = el?.querySelector('.connector-advanced-svg.connector-flow-forward');
    const lbl = el?.querySelector('.connector-name-label');
    const pathD = svg?.querySelector('.connector-visible-stroke')?.getAttribute('d') || '';
    const segments = pathD.split('L').length;
    return Boolean(svg && lbl && segments >= 3 && getComputedStyle(lbl).backgroundColor === 'rgb(238, 242, 255)');
  });

  // 8. Auto Layout on frame1 aligning enclosed children child1 & child2
  await page.locator('[data-item-id="frame1"] .portfolio-frame-caption').click();
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '프레임 편집');
  await inspectorSlot.getByLabel('오토 레이아웃 활성화', { exact: true }).click();
  await inspectorSlot.getByLabel('오토 레이아웃 방향', { exact: true }).selectOption('row');
  await inspectorSlot.getByLabel('오토 레이아웃 간격', { exact: true }).fill('24');
  const applyBtn = inspectorSlot.getByRole('button', { name: '내부 하위 객체 자동 정렬 적용', exact: true });
  await applyBtn.waitFor();
  await applyBtn.click();
  await waitUntil(
    () => Math.abs(latest.child1.y - latest.child2.y) < 0.005 && latest.child2.x > latest.child1.x,
    'Auto Layout aligned child1 and child2 horizontally'
  );

  // 9. Floating Context Toolbar: Preset, Bring Front, Style Copy & Paste (Alt+Ctrl+C / Alt+Ctrl+V)
  await page.mouse.click(worldBox.x + 0.39 * worldBox.width, worldBox.y + 0.23 * worldBox.height);
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '도형 편집');
  await floatingBar.getByRole('button', { name: '프리셋', exact: true }).click();
  await floatingBar.getByRole('button', { name: '글래스모피즘', exact: true }).click();
  await waitUntil(() => (latest.card2.brush || '').startsWith('style1:'), 'card2 glassmorphism preset');

  await floatingBar.getByRole('button', { name: '맨 앞으로 가져오기', exact: true }).click();
  await waitUntil(() => (latest.card2.depth || 0) > (latest.note1.depth || 0), 'card2 brought to front');

  // Keyboard Alt+Ctrl+C to copy card2 style
  await page.locator('.canvas-stage').focus();
  await page.keyboard.press('Control+Alt+KeyC');
  // Select note1 (world center 0.42, 0.45) and paste with Alt+Ctrl+V
  await page.mouse.click(worldBox.x + 0.42 * worldBox.width, worldBox.y + 0.45 * worldBox.height);
  await page.locator('[data-item-id="note1"]').waitFor();
  await page.locator('.canvas-stage').focus();
  await page.keyboard.press('Control+Alt+KeyV');
  await waitUntil(() => (latest.note1.brush || '').startsWith('style1:'), 'note1 received pasted style');
  assert.equal(latest.note1.text, '제주도 맛집 리스트', 'pasting style preserves target text content');

  // 10. Multi-selection Intersection, Selection Colors batch replace & Style Tokens
  await page.keyboard.down('Shift');
  await page.mouse.click(worldBox.x + 0.17 * worldBox.width, worldBox.y + 0.23 * worldBox.height);
  await page.keyboard.up('Shift');
  assert.equal(await inspectorSlot.locator('.inspector-heading h2').textContent(), '객체 2개 편집');
  await inspectorSlot.getByRole('tab', { name: '프리셋·토큰', exact: true }).click();

  await inspectorSlot.getByLabel('새 토큰 이름', { exact: true }).fill('제주 카드 토큰');
  await inspectorSlot.getByRole('button', { name: '현재 스타일을 토큰으로 저장', exact: true }).click();
  await inspectorSlot.getByText('제주 카드 토큰', { exact: true }).waitFor();

  const colorPickers = inspectorSlot.getByLabel('선택 색상 일괄 교체', { exact: true });
  assert.ok((await colorPickers.count()) >= 1, 'extracted selection colors listed');
  await colorPickers.first().fill('#14b8a6');
  await waitUntil(
    () => JSON.stringify([latest.note1, latest.box1]).toLowerCase().includes('#14b8a6'),
    'selection color batch replaced across multi-selection'
  );

  assert.deepEqual(errors, [], 'no runtime pageerrors during advanced styling flow');
  console.log('PASS advanced-styling integration flow');
} finally {
  await browser.close();
}
