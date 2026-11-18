import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:8444';
const screenshotDir = process.env.AGORA_TABLET_SCREENSHOTS_DIR || '';

const TABLET_VIEWPORTS = [
  { name: 'portrait-768', width: 768, height: 1024 },
  { name: 'portrait-820', width: 820, height: 1180 },
  { name: 'portrait-1024', width: 1024, height: 1366 },
  { name: 'landscape-1024', width: 1024, height: 768 },
  { name: 'landscape-1180', width: 1180, height: 820 },
];

const user = {
  user_id: 7,
  email: 'tablet@example.invalid',
  nickname: 'TabletTester',
  tag_number: 1,
  role: 'ROLE_USER',
  status: 'ACTIVE',
};
const token =
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64url') +
  '.tablet';

const htmlSource = [
  '<div style="padding:16px;font-family:sans-serif">',
  '  <h2 id="top-title">HTML Scroll Target</h2>',
  ...Array.from({ length: 45 }, (_, i) => `  <p style="margin:28px 0">Row ${i + 1} scrollable HTML content</p>`),
  '</div>',
].join('\n');

const initialItems = {
  html1: {
    kind: 'code',
    language: 'html',
    code: htmlSource,
    x: 0.25,
    y: 0.2,
    width: 0.36,
    height: 0.34,
    permission: 'default',
  },
};

function overlaps(a, b, tol = 2) {
  return !(
    a.right <= b.left + tol ||
    b.right <= a.left + tol ||
    a.bottom <= b.top + tol ||
    b.bottom <= a.top + tol
  );
}

async function setupMockContext(browser, viewport) {
  let revision = 0;
  let latest = structuredClone(initialItems);
  const receipts = new Map();
  const peers = new Set();
  const policies = { default: { read: true, write: true, execute: true } };
  const caps = { groups: ['default'], write_groups: ['default'], execute_groups: ['default'], is_admin: true };
  const settings = () => ({
    canvas_name: '태블릿 및 HTML 테스트 보드',
    settings_revision: revision,
    visibility: 'private',
    participants: [],
    group_permissions: policies,
    can_manage: true,
  });

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: 'ko-KR',
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(({ token, user }) => {
    if (window !== window.top) return;
    localStorage.setItem('agora_token', token);
    localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_ui_locale', 'ko');
    localStorage.setItem('agora_home_intro_seen', '1');
  }, { token, user });
  context.setDefaultTimeout(30000);

  await context.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let json = {};
    if (pathname === '/api/auth/me') json = user;
    else if (pathname === '/api/canvases/search' || pathname === '/api/canvases') {
      json = { items: [], content: [], total: 0, totalElements: 0, totalPages: 0 };
    } else if (pathname.endsWith('/access')) {
      json = { ws_port: 8002, canvas_access_token: 'fixture', canvas_id: 999003, canvas_name: '태블릿 및 HTML 테스트 보드' };
    } else if (pathname.endsWith('/settings')) {
      json = settings();
    } else if (pathname.endsWith('/runtime/settings')) {
      json = { revision: 0, languages: {}, catalog: {} };
    } else {
      json = { ok: true, canvas_id: 999003 };
    }
    return route.fulfill({ json });
  });

  await context.routeWebSocket(/\/wss\/port\//, (ws) => {
    const isRtc = ws.url().includes('/rtc/');
    if (!isRtc) {
      peers.add(ws);
      ws.onClose(() => peers.delete(ws));
    }
    setTimeout(() => {
      ws.send(
        JSON.stringify(
          isRtc
            ? { type: 'rtc_ready' }
            : {
                type: 'init_items',
                items: latest,
                ...caps,
                sync_protocol: 2,
                sync_user_id: 7,
                revision,
                accepted_count: 0,
                rtc_canvas_connection_id: 'fixture',
                rtc_canvas_connection_hash: 'proof',
              },
        ),
      );
    }, 50);

    ws.onMessage((raw) => {
      const data = JSON.parse(String(raw));
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      if (data.type === 'canvas_sync') {
        ws.send(
          JSON.stringify({
            type: 'canvas_snapshot',
            client_id: data.client_id,
            items: latest,
            ...caps,
            sync_protocol: 2,
            sync_user_id: 7,
            revision,
            accepted_count: receipts.get(data.client_id) || 0,
          }),
        );
      } else if (data.type === 'rtc_join' || data.type === 'rtc_list') {
        ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer-7', peers: [] }));
      } else if (data.type === 'canvas_ops') {
        receipts.set(data.client_id, data.request_count);
        const touched = {};
        for (const op of data.operations) {
          if (op.action === 'delete') delete latest[op.id];
          else if (op.action === 'translate') {
            for (const id of op.ids) {
              latest[id] = { ...latest[id], x: latest[id].x + op.dx, y: latest[id].y + op.dy };
              touched[id] = latest[id];
            }
          } else {
            latest[op.id] = { ...latest[op.id], ...op.patch };
            touched[op.id] = latest[op.id];
          }
        }
        revision++;
        for (const peer of peers) {
          peer.send(
            JSON.stringify({
              type: 'canvas_commit',
              client_id: data.client_id,
              author_id: 7,
              request_count: data.request_count,
              revision,
              items: touched,
            }),
          );
        }
      }
    });
  });

  return context;
}

async function measureCanvasRects(page) {
  return page.evaluate(() => {
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') return null;
      return {
        left: Math.round(r.left),
        top: Math.round(r.top),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };
    const toolsEl = document.querySelector('.canvas-tools');
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      toolsOverflowX: toolsEl ? toolsEl.scrollWidth > toolsEl.clientWidth + 1 : false,
      toolsScroll: toolsEl ? { sw: toolsEl.scrollWidth, cw: toolsEl.clientWidth } : null,
      rects: {
        titleGroup: rectOf(document.querySelector('.canvas-title-group')),
        headerRight: rectOf(document.querySelector('.canvas-header-right')),
        agentLauncher: rectOf(document.querySelector('.canvas-agent-launcher')),
        toolsSlot: rectOf(document.querySelector('.canvas-panel-slot-tools')),
        inspectorSlot: rectOf(document.querySelector('.canvas-panel-slot-inspector')),
        chatSlot: rectOf(document.querySelector('.canvas-panel-slot-chat:not(.is-collapsed) .canvas-panel-content') || document.querySelector('.canvas-panel-slot-chat')),
        chatToggle: rectOf(document.querySelector('.canvas-panel-slot-chat .canvas-panel-toggle')),
        minimap: rectOf(document.querySelector('.canvas-minimap:not(.is-collapsed)')),
        quickDock: rectOf(document.querySelector('.canvas-quick-dock')),
        topline: rectOf(document.querySelector('.board-topline')),
      },
    };
  });
}

function assertNoCanvasOverlap(report, tag) {
  assert.equal(report.docOverflow, false, `${tag}: document horizontal overflow`);
  assert.equal(report.toolsOverflowX, false, `${tag}: tools horizontal overflow ${JSON.stringify(report.toolsScroll)}`);

  const r = report.rects;
  for (const [key, box] of Object.entries(r)) {
    if (!box) continue;
    assert.ok(box.left >= -1 && box.top >= -1 && box.right <= report.vw + 1 && box.bottom <= report.vh + 1, `${tag}: ${key} out of viewport ${JSON.stringify(box)} (${report.vw}x${report.vh})`);
  }

  const pairs = [
    ['titleGroup', 'headerRight'],
    ['titleGroup', 'agentLauncher'],
    ['headerRight', 'agentLauncher'],
    ['titleGroup', 'toolsSlot'],
    ['headerRight', 'inspectorSlot'],
    ['agentLauncher', 'toolsSlot'],
    ['agentLauncher', 'inspectorSlot'],
    ['agentLauncher', 'minimap'],
    ['agentLauncher', 'chatSlot'],
    ['toolsSlot', 'chatSlot'],
    ['inspectorSlot', 'chatSlot'],
    ['toolsSlot', 'minimap'],
    ['inspectorSlot', 'minimap'],
    ['minimap', 'chatSlot'],
    ['quickDock', 'chatSlot'],
    ['quickDock', 'toolsSlot'],
    ['quickDock', 'inspectorSlot'],
    ['quickDock', 'topline'],
    ['chatSlot', 'topline'],
    ['inspectorSlot', 'topline'],
    ['chatToggle', 'toolsSlot'],
    ['chatToggle', 'quickDock'],
    ['chatToggle', 'topline'],
  ];

  for (const [a, b] of pairs) {
    if (r[a] && r[b]) {
      assert.equal(overlaps(r[a], r[b]), false, `${tag}: overlap between ${a} ${JSON.stringify(r[a])} and ${b} ${JSON.stringify(r[b])}`);
    }
  }
}

async function verifyHtmlWheelAndPan(page) {
  const htmlObj = page.locator('[data-item-id="html1"]');
  const iframeEl = htmlObj.locator('.html-object-content > iframe');
  const stageWorld = page.locator('.canvas-world-layer').first();
  assert.equal(await htmlObj.getByRole('button', { name: '미리보기 실행', exact: true }).count(), 0);
  await iframeEl.waitFor({ state: 'visible' });

  // Wait for iframe srcDoc to render tall content.
  await page.waitForFunction(() => {
    const f = document.querySelector('[data-item-id="html1"] iframe');
    return Boolean(f?.contentDocument?.getElementById('top-title'));
  }).catch(async () => {
    // Fallback for opaque sandbox origin: wait briefly for frame load via Playwright frames.
    await page.waitForTimeout(400);
  });

  const getIframeFrame = () => {
    const f = page.frames().find((fr) => fr !== page.mainFrame() && fr.url().startsWith('about:srcdoc'));
    return f || page.mainFrame().childFrames().find((fr) => fr !== page.mainFrame());
  };
  await page.waitForFunction(() => Boolean(document.querySelector('[data-item-id="html1"] iframe')));
  await page.waitForTimeout(300);

  const iframeBox = await iframeEl.boundingBox();
  assert.ok(iframeBox && iframeBox.width > 50 && iframeBox.height > 50, 'HTML iframe box missing');
  const centerX = iframeBox.x + iframeBox.width / 2;
  const centerY = iframeBox.y + iframeBox.height / 2;

  // 1) Unselected: pointer-events must be none on iframe; wheel moves canvas, NOT iframe scrollY.
  assert.equal(await htmlObj.evaluate((el) => el.classList.contains('selected')), false);
  assert.equal(await iframeEl.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
  const worldBefore = await stageWorld.getAttribute('style');
  await page.mouse.move(centerX, centerY);
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(150);
  const worldAfterWheelUnselected = await stageWorld.getAttribute('style');
  assert.notEqual(worldAfterWheelUnselected, worldBefore, 'Wheel over unselected HTML object must pan the canvas');
  const htmlFrame = getIframeFrame();
  if (htmlFrame) {
    assert.equal(await htmlFrame.evaluate(() => window.scrollY), 0, 'Unselected HTML iframe must not scroll');
  }

  // Space+drag over unselected HTML object must also pan the canvas cleanly.
  await page.keyboard.down('Space');
  assert.equal(await page.locator('.canvas-stage').evaluate((el) => el.classList.contains('space-panning')), true);
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX - 45, centerY - 35, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.canvas-stage').evaluate((el) => el.classList.contains('space-panning')), false);
  const worldAfterSpacePan = await stageWorld.getAttribute('style');
  assert.notEqual(worldAfterSpacePan, worldAfterWheelUnselected, 'Space+drag over HTML object must pan canvas');

  // 2) Single-click selects HTML object; iframe pointer-events becomes auto; wheel scrolls inside iframe!
  const updatedBox = await iframeEl.boundingBox();
  const selX = updatedBox.x + updatedBox.width / 2;
  const selY = updatedBox.y + updatedBox.height / 2;
  await page.mouse.click(selX, selY);
  await page.waitForTimeout(120);
  assert.equal(await htmlObj.evaluate((el) => el.classList.contains('selected')), true, 'Clicking HTML object must select it');
  assert.equal(await iframeEl.evaluate((el) => getComputedStyle(el).pointerEvents), 'auto');

  const worldWhileSelected = await stageWorld.getAttribute('style');
  await page.mouse.move(selX, selY);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(200);
  assert.equal(await stageWorld.getAttribute('style'), worldWhileSelected, 'Wheel inside selected HTML iframe must not pan canvas');
  const scrolledFrame = getIframeFrame();
  assert.ok(scrolledFrame, 'Expected rendered HTML iframe frame');
  const scrollY = await scrolledFrame.evaluate(() => window.scrollY);
  assert.ok(scrollY > 0, `Expected wheel inside selected HTML iframe to scroll content (got scrollY=${scrollY})`);

  // 3) Click empty canvas outside object -> deselects, and wheel once again moves canvas.
  const emptyPoint = await page.evaluate(() => {
    const stage = document.querySelector('.canvas-stage');
    const sr = stage.getBoundingClientRect();
    const obj = document.querySelector('[data-item-id="html1"]').getBoundingClientRect();
    const candidates = [
      { x: obj.right + 48, y: obj.top + 30 },
      { x: obj.left - 48, y: obj.top + 30 },
      { x: obj.left + 20, y: obj.bottom + 48 },
      { x: obj.left + 20, y: obj.top - 64 },
      { x: sr.left + sr.width * 0.72, y: sr.top + sr.height * 0.35 },
    ];
    for (const pt of candidates) {
      if (pt.x < sr.left + 20 || pt.x > sr.right - 20 || pt.y < sr.top + 20 || pt.y > sr.bottom - 20) continue;
      const hit = document.elementFromPoint(pt.x, pt.y);
      if (hit && stage.contains(hit) && !hit.closest('.canvas-object, [data-canvas-ui], .canvas-floating-context-bar, .canvas-panel-slot, .canvas-minimap, .canvas-agent-launcher, .canvas-quick-dock, .board-topline')) {
        return pt;
      }
    }
    return null;
  });
  assert.ok(emptyPoint, 'Expected an unobstructed empty stage point to click');
  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(150);
  assert.equal(await htmlObj.evaluate((el) => el.classList.contains('selected')), false);
  await page.mouse.move(selX, selY);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);
  assert.notEqual(await stageWorld.getAttribute('style'), worldWhileSelected, 'After deselecting, wheel over HTML object pans canvas again');
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--ignore-certificate-errors'],
});

const pageErrors = [];
try {
  if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });

  // Part A: Verify HTML object hover-to-pan vs selected-to-scroll at desktop and tablet sizes.
  for (const vp of [{ name: 'desktop-1440', width: 1440, height: 900 }, { name: 'tablet-768', width: 768, height: 1024 }]) {
    const context = await setupMockContext(browser, vp);
    const page = await context.newPage();
    page.on('pageerror', (err) => pageErrors.push(`${vp.name}-html: ${err.message}`));
    await page.goto(`${origin}/canvases/999003`);
    await page.locator('.canvas-loading-status.is-overlay').waitFor({ state: 'hidden' });
    await verifyHtmlWheelAndPan(page);
    await context.close();
  }
  console.log('PASS HTML object wheel/Space pan when unselected & internal scroll when selected (desktop + tablet)');

  // Part B: Verify tablet canvas + secondary routes across all 5 tablet viewports.
  for (const vp of TABLET_VIEWPORTS) {
    const context = await setupMockContext(browser, vp);
    const page = await context.newPage();
    page.on('pageerror', (err) => pageErrors.push(`${vp.name}: ${err.message}`));

    // 1) Canvas default (chat collapsed) + Canvas with tools & chat expanded
    await page.goto(`${origin}/canvases/999003`);
    await page.locator('[data-item-id="html1"]').waitFor({ state: 'visible' });
    await page.locator('.canvas-loading-status.is-overlay').waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    const collapsedReport = await measureCanvasRects(page);
    assertNoCanvasOverlap(collapsedReport, `${vp.name}-canvas-default`);
    if (screenshotDir) {
      await page.screenshot({ path: path.join(screenshotDir, `canvas-${vp.name}-default.png`) });
    }

    // Open both tools & chat panels if collapsed so we verify Tools + Inspector + Chat + QuickDock simultaneously.
    const toolsCollapsed = await page.locator('.canvas-panel-slot-tools.is-collapsed').count();
    if (toolsCollapsed > 0) {
      await page.locator('.canvas-panel-slot-tools .canvas-panel-toggle').click();
      await page.waitForTimeout(200);
    }
    const chatCollapsed = await page.locator('.canvas-panel-slot-chat.is-collapsed').count();
    if (chatCollapsed > 0) {
      await page.locator('.canvas-panel-slot-chat .canvas-panel-toggle').click();
      await page.waitForTimeout(250);
    }
    const expandedReport = await measureCanvasRects(page);
    assertNoCanvasOverlap(expandedReport, `${vp.name}-canvas-chat-open`);
    assert.ok(expandedReport.rects.chatSlot?.width >= 200 && expandedReport.rects.chatSlot?.height >= 150, `${vp.name}: expanded chat collapsed unexpectedly (${JSON.stringify(expandedReport.rects.chatSlot)})`);
    if (screenshotDir) {
      await page.screenshot({ path: path.join(screenshotDir, `canvas-${vp.name}-chat-open.png`) });
    }

    // 2) /search AppShell sidebar & main check
    await page.goto(`${origin}/search`);
    await page.locator('.app-sidebar').waitFor({ state: 'visible' });
    await page.waitForTimeout(200);
    const searchReport = await page.evaluate(() => {
      const aside = document.querySelector('.app-sidebar');
      const ar = aside?.getBoundingClientRect();
      const children = [...aside.querySelectorAll('.sidebar-create-link, .sidebar-language-control, .language-switcher, .side-link')];
      const bad = children
        .map((el) => ({ cls: el.className, rect: el.getBoundingClientRect() }))
        .filter((item) => item.rect.width > 0 && (item.rect.right > ar.right + 1 || item.rect.left < ar.left - 1));
      return {
        docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        sidebarWidth: Math.round(ar.width),
        overflowing: bad,
      };
    });
    assert.equal(searchReport.docOverflow, false, `${vp.name}-search docOverflow`);
    assert.equal(searchReport.overflowing.length, 0, `${vp.name}-search sidebar overflow: ${JSON.stringify(searchReport.overflowing)}`);
    if (screenshotDir && (vp.width === 768 || vp.height === 768)) {
      await page.screenshot({ path: path.join(screenshotDir, `search-${vp.name}.png`) });
    }

    // 3) /docs TOC viewport containment & no horizontal overflow
    await page.goto(`${origin}/docs`);
    await page.locator('.docs-toc').waitFor({ state: 'visible' });
    await page.waitForTimeout(150);
    const docsReport = await page.evaluate(() => {
      const toc = document.querySelector('.docs-toc')?.getBoundingClientRect();
      return {
        docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        vh: window.innerHeight,
        tocBottom: toc ? Math.round(toc.bottom) : 0,
      };
    });
    assert.equal(docsReport.docOverflow, false, `${vp.name}-docs docOverflow`);
    assert.ok(docsReport.tocBottom <= docsReport.vh + 1, `${vp.name}-docs TOC extends past viewport (${docsReport.tocBottom} > ${docsReport.vh})`);
    if (screenshotDir && (vp.width === 768 || vp.height === 768)) {
      await page.screenshot({ path: path.join(screenshotDir, `docs-${vp.name}.png`) });
    }

    await context.close();
    console.log(`PASS tablet layout (${vp.width}x${vp.height}): canvas, /search, /docs`);
  }

  assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
} finally {
  await browser.close();
}
