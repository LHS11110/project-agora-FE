import assert from 'node:assert/strict';
import { translate } from '../../src/i18n/locale.js';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5223';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const user = { email: 'locale@example.invalid', nickname: 'Locale Test', tag_number: 7, role: 'ROLE_USER', status: 'ACTIVE' };
const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 600 })).toString('base64url') + '.locale';
const settings = { canvas_name: 'Locale fixture', settings_revision: 0, visibility: 'private', can_manage: true };
const snapshot = {
  items: {
    note1: { kind: 'note', text: 'Locale sticky', color: '#fef08a', depth: 1, x: 0.06, y: 0.14, width: 0.18, height: 0.16, permission: ['default'] },
    val1: {
      kind: 'value', title: '', valueType: 'button', valueMin: 0, valueMax: 1, valueStep: 1,
      valueNumber: 0, valueText: '', valueOptions: ['꺼짐', '켜짐'], depth: 2,
      x: 0.28, y: 0.14, width: 0.22, height: 0.20, permission: ['default'],
    },
    nb1: {
      kind: 'shape', shapeType: 'rectangle', runtimeRole: 'notebook', depth: 3,
      x: 0.54, y: 0.14, width: 0.36, height: 0.38, permission: ['default'],
      notebookCells: [{ id: 'c1', cellType: 'code', source: 'print(1)' }], notebookResults: {},
    },
    box1: {
      kind: 'shape', shapeType: 'rectangle', fill: '#e2e8f0', color: '#0f172a', strokeEnabled: true,
      depth: 4, x: 0.06, y: 0.36, width: 0.18, height: 0.16, permission: ['default'],
    },
  },
  groups: ['default'],
  write_groups: ['default'],
  execute_groups: ['default'],
  is_admin: true,
  sync_protocol: 2,
  sync_user_id: 7,
  revision: 0,
  accepted_count: 0,
};

try {
  const context = await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ token, user }) => {
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    localStorage.setItem('agora_token', token);
    localStorage.setItem('agora_user', JSON.stringify(user));
  }, { token, user });
  const errors = [];
  await context.route(url => url.pathname.startsWith('/api/'), route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/auth/session/refresh') return route.fulfill({ json: { accessToken: token, user } });
    if (pathname === '/api/auth/me') return route.fulfill({ json: user });
    if (pathname.endsWith('/access')) return route.fulfill({ json: { ws_port: 8002, canvas_access_token: 'locale-fixture' } });
    if (pathname.includes('/agent/sessions')) {
      return route.fulfill({
        json: {
          sessions: [],
          draft: { id: 'draft-locale-1', owner_id: 7, status: 'draft', title: '', created_at: new Date().toISOString() },
          has_more: false,
        },
      });
    }
    if (pathname.includes('/agent')) return route.fulfill({ json: { ok: true, hasPersonalKey: false } });
    return route.fulfill({ json: settings });
  });
  await context.routeWebSocket(/\/wss\/port\//, ws => {
    const rtc = ws.url().includes('/rtc/');
    setTimeout(() => ws.send(JSON.stringify(rtc ? { type: 'rtc_ready' } : { type: 'init_items', ...snapshot })), 100);
    ws.onMessage(raw => {
      const event = JSON.parse(String(raw));
      if (event.type === 'canvas_sync') {
        ws.send(JSON.stringify({ type: 'canvas_snapshot', ...snapshot, client_id: event.client_id }));
      } else if (event.type === 'rtc_join') {
        ws.send(JSON.stringify({ type: 'rtc_peers', peers: [], self_peer_id: 'locale-peer' }));
      }
    });
  });

  const open = async () => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/canvases/1');
    await page.waitForFunction(() => window.frelogCanvas?.read().items?.nb1, null, { timeout: 15000 }).catch(async error => {
      console.error(page.url(), errors, (await page.locator('body').innerText()).slice(0, 500));
      throw error;
    });
    return page;
  };

  const page = await open();
  const secondTab = await open();
  const switcher = page.locator('.canvas-app-page select[name="ui-locale"]:visible').first();
  assert.deepEqual(await switcher.locator('option').allTextContents(), ['한국어', 'English', '简体中文', '日本語', 'Français']);

  // Select seeded note object to keep object inspector + advanced styling mounted across live locale switches.
  await page.locator('[data-item-id="note1"]').click();
  await page.locator('.inspector-advanced-styling').waitFor();

  const cases = [
    ['en', 'en', 'Connected', 'Navigate', '圆形', 'Circle'],
    ['zh', 'zh-Hans', '已连接', '导航与协作', '圆形', '圆形'],
    ['ja', 'ja', '接続済み', '移動・共同作業', '三角形', '三角形'],
    ['fr', 'fr', 'Connecté', 'Navigation et collaboration', 'Cercle', 'Cercle'],
    ['ko', 'ko', '연결됨', '탐색·협업', '원', '원'],
  ];

  for (const [code, lang, status, navCategory] of cases) {
    await switcher.selectOption(code);
    await page.waitForFunction(({ lang, status }) =>
      document.documentElement.lang === lang && document.querySelector('.connection-pill')?.textContent.trim() === status,
    { lang, status });
    await page.waitForFunction(category =>
      document.querySelector('[data-tool-folder-id="navigate"]')?.textContent.includes(category), navCategory);
    await secondTab.waitForFunction(lang => document.documentElement.lang === lang, lang);

    // Mounted memoized objects re-translate live without page reload.
    const expectedValueTitle = translate('버튼 값', code);
    const expectedValueSync = translate('실시간 공유', code);
    const expectedNotebookRun = translate('모두 실행', code);
    await page.waitForFunction(({ title, sync, run }) => {
      const valText = document.querySelector('[data-item-id="val1"] .canvas-value-object')?.textContent || '';
      const nbText = document.querySelector('[data-item-id="nb1"] .notebook-content')?.textContent || '';
      return valText.includes(title) && valText.includes(sync) && nbText.includes(run);
    }, { title: expectedValueTitle, sync: expectedValueSync, run: expectedNotebookRun });

    // Selected object inspector & advanced styling re-translate live.
    const expectedEditLabel = translate('포스트잇 편집', code);
    const expectedStyleHeading = translate('상세 디자인 · 스타일 편집', code);
    await page.waitForFunction(({ editLabel, styleHeading }) => {
      const inspectorText = document.querySelector('.canvas-inspector')?.textContent || '';
      return inspectorText.includes(editLabel) && inspectorText.includes(styleHeading);
    }, { editLabel: expectedEditLabel, styleHeading: expectedStyleHeading });

    // Agent launcher reflects active locale.
    const expectedAgent = translate('AI 에이전트', code);
    await page.waitForFunction(text =>
      document.querySelector('.canvas-agent-launcher')?.textContent.includes(text), expectedAgent);
  }

  // Test Shape Picker search in zh ('圆形'), ja ('三角形'), fr ('Cercle').
  const toolsToggle = page.locator('.quick-dock-more');
  if (await toolsToggle.getAttribute('aria-expanded') !== 'true') await toolsToggle.click();
  const diagramHeading = page.locator('[data-tool-folder-id="diagram"] .canvas-category-heading');
  await diagramHeading.waitFor({ state: 'visible' });
  if (await diagramHeading.getAttribute('aria-expanded') !== 'true') await diagramHeading.click();
  await page.locator('[data-folder-tool-id="shape"] button').click();
  await page.locator('input[name="shape-search"]').waitFor({ state: 'visible' });
  for (const [code, query, expectedLabel] of [
    ['zh', '圆形', '圆形'],
    ['ja', '三角形', '三角形'],
    ['fr', 'Cercle', 'Cercle'],
  ]) {
    await switcher.selectOption(code);
    await page.locator('input[name="shape-search"]').fill(query);
    await page.waitForFunction(label =>
      document.querySelector('.shape-picker')?.textContent.includes(label), expectedLabel);
  }
  await page.locator('input[name="shape-search"]').fill('');

  // Open AI Agent panel in French to verify secondary panel localization.
  await page.locator('.canvas-agent-launcher').click();
  await page.locator('#canvas-agent-panel').waitFor();
  const agentRequestLabel = translate('에이전트에게 요청', 'fr');
  await page.locator('#canvas-agent-panel').getByLabel(agentRequestLabel).waitFor();

  assert.equal(await page.evaluate(() => localStorage.getItem('frelog_locale')), 'fr');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'fr' && window.frelogCanvas?.read().items?.nb1);
  assert.equal(await switcher.inputValue(), 'fr');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByText('Paramètres du canevas', { exact: true }).waitFor();
  await page.keyboard.press('Escape').catch(() => {});

  // Compact viewport switcher layout check (700px expanded topbar & 600px folded topbar).
  const measureVisibleSwitcher = () => page.evaluate(() => {
    const sel = Array.from(document.querySelectorAll('.canvas-app-page select[name="ui-locale"]')).find(el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    });
    if (!sel) return null;
    const rect = sel.getBoundingClientRect();
    return { width: rect.width, height: rect.height, docOverflow: document.documentElement.scrollWidth - window.innerWidth };
  });

  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(100);
  const compactTopbar = await measureVisibleSwitcher();
  assert.ok(compactTopbar && compactTopbar.width >= 50, `Unexpected compact switcher size at 700px: ${JSON.stringify(compactTopbar)}`);
  assert.ok(compactTopbar.docOverflow <= 2, `Compact viewport overflowed at 700px: ${compactTopbar.docOverflow}`);

  await page.setViewportSize({ width: 600, height: 900 });
  await page.locator('.canvas-topbar > .canvas-chrome-toggle').click();
  await page.locator('.canvas-folded-language select[name="ui-locale"]').waitFor({ state: 'visible' });
  const compactFolded = await measureVisibleSwitcher();
  assert.ok(compactFolded && compactFolded.width >= 50, `Unexpected folded switcher size at 600px: ${JSON.stringify(compactFolded)}`);
  assert.ok(compactFolded.docOverflow <= 2, `Compact folded viewport overflowed at 600px: ${compactFolded.docOverflow}`);

  assert.deepEqual(errors, []);
  console.log('PASS Canvas 5-language UI, live mounted object/inspector re-translation, shape search, agent panel, reload and cross-tab sync');
} finally {
  await browser.close();
}
