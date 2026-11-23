import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:8444';
const insecure = process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1' || origin.startsWith('https://localhost:8444');

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    ...(process.env.AGORA_E2E_HOST_RESOLVER ? [`--host-resolver-rules=${process.env.AGORA_E2E_HOST_RESOLVER}`] : []),
  ],
});

const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.form-audit`;
const user = {
  user_id: 7,
  email: 'formaudit@example.invalid',
  nickname: 'FormAudit',
  tag_number: 1,
  role: 'ROLE_USER',
  status: 'ACTIVE',
  created_at: '2026-10-20T10:00:00',
};

const items = {};
const valueTypes = ['real', 'integer', 'select', 'text'];
for (let i = 0; i < 40; i++) {
  const col = i % 8;
  const row = Math.floor(i / 8);
  const vt = valueTypes[i % valueTypes.length];
  items[`val-${i}`] = {
    kind: 'value',
    title: `Value ${i}`,
    valueType: vt,
    valueMin: 0,
    valueMax: 100,
    valueStep: vt === 'real' ? 0.1 : 1,
    valueNumber: 1,
    valueText: 'hello',
    valueOptions: ['Opt A', 'Opt B', 'Opt C'],
    x: 0.04 + col * 0.09,
    y: 0.24 + row * 0.08,
    width: 0.08,
    height: 0.07,
    permission: 'default',
  };
}
for (let i = 0; i < 6; i++) {
  items[`q-${i}`] = {
    kind: 'question',
    questionType: i % 2 === 0 ? 'choice' : 'short-answer',
    questionPrompt: `Question ${i}?`,
    questionOptions: ['Alpha', 'Beta', 'Gamma'],
    questionAnswer: '',
    questionMaxScore: 10,
    questionScore: -1,
    questionVersion: 1,
    x: 0.04 + i * 0.13,
    y: 0.14,
    width: 0.12,
    height: 0.09,
    permission: 'default',
  };
}
items['code-1'] = {
  kind: 'code',
  language: 'python',
  filename: 'app.py',
  code: 'print("hello world")',
  x: 0.04,
  y: 0.04,
  width: 0.18,
  height: 0.09,
  permission: 'default',
};
items['table-1'] = {
  kind: 'table',
  columns: ['Key', 'Value'],
  rows: [['a', '1'], ['b', '2']],
  x: 0.24,
  y: 0.04,
  width: 0.18,
  height: 0.09,
  permission: 'default',
};
items['note-1'] = {
  kind: 'note',
  text: 'Sticky note',
  color: '#fef08a',
  x: 0.44,
  y: 0.04,
  width: 0.14,
  height: 0.09,
  permission: 'default',
};
items['nb-1'] = {
  kind: 'shape',
  shapeType: 'rectangle',
  runtimeRole: 'notebook',
  notebookCells: [
    { id: 'c1', cellType: 'code', source: '1 + 1' },
    { id: 'c2', cellType: 'markdown', source: '## Notes' },
  ],
  x: 0.6,
  y: 0.04,
  width: 0.22,
  height: 0.12,
  permission: 'default',
};

const policies = {
  'admin-group': { read: true, write: true, execute: true },
  default: { read: true, write: true, execute: true },
};

try {
  const cdpIssues = [];
  const pageErrors = [];

  async function installRoutes(context, { authenticated = true } = {}) {
    if (authenticated) {
      await context.addInitScript(({ authToken, authUser }) => {
        ((t)=>{const f=window.fetch;window.fetch=function(input){return String(input?.url??input).includes('/api/auth/session/refresh')?Promise.resolve(new Response(JSON.stringify({accessToken:t}),{status:200,headers:{'Content-Type':'application/json'}})):f.apply(this,arguments);};})(authToken);
        localStorage.setItem('agora_user', JSON.stringify(authUser));
        sessionStorage.setItem('frelog.home-intro.v1', 'seen');
      }, { authToken: token, authUser: user });
    } else {
      await context.addInitScript(() => {
        sessionStorage.setItem('frelog.home-intro.v1', 'seen');
      });
    }

    await context.route((url) => url.pathname.startsWith('/api/'), (route) => {
      const reqPath = new URL(route.request().url()).pathname;
      if (reqPath === '/api/auth/providers') return route.fulfill({ json: { google: true, naver: true, kakao: true } });
      if (reqPath === '/api/auth/email/status') return route.fulfill({ json: { available: true } });
      if (reqPath === '/api/auth/me') {
        return authenticated
          ? route.fulfill({ json: user })
          : route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      }
      if (reqPath === '/api/auth/mfa') return route.fulfill({ json: { available: true, enabled: false } });
      if (reqPath === '/api/auth/passkeys') return route.fulfill({ json: [] });
      if (reqPath === '/api/auth/passkeys/status') return route.fulfill({ json: { available: true } });
      if (reqPath === '/api/users/me/activity') return route.fulfill({ json: { days: {}, lastPersistedAt: null } });
      if (reqPath.endsWith('/access')) return route.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
      if (reqPath.endsWith('/settings')) {
        return route.fulfill({
          json: {
            canvas_name: 'Form Audit Fixture',
            description: 'Fixture',
            settings_revision: 0,
            visibility: 'private',
            participants: [{ nickname: user.nickname, tag_number: user.tag_number }],
            groups: { 'admin-group': [{ nickname: user.nickname, tag_number: user.tag_number }], default: [] },
            group_permissions: policies,
            initial_group: 'default',
            can_manage: true,
          },
        });
      }
      if (reqPath.endsWith('/bots')) return route.fulfill({ json: [] });
      if (reqPath.endsWith('/agent/sessions')) return route.fulfill({ json: { sessions: [], next_offset: null } });
      if (reqPath.endsWith('/agent/status')) return route.fulfill({ json: { configured: true, model: 'k-exaone_v2.5', telemetry: { limits: {} } } });
      if (reqPath === '/api/canvases') {
        return route.fulfill({
          json: [{ canvas_id: 999081, canvas_name: 'Form Audit Fixture', description: 'Fixture', user_count: 1, visibility: 'private' }],
        });
      }
      return route.fulfill({ json: { canvas_id: 999081, canvas_name: 'Form Audit Fixture', user_count: 1 } });
    });

    await context.routeWebSocket(/\/wss\/port\//, (ws) => {
      const rtc = ws.url().includes('/rtc/');
      const clientId = new URL(ws.url()).searchParams.get('client_id') || '';
      const snap = (type = 'init_items', cid = clientId) => ({
        type,
        client_id: cid,
        items,
        groups: ['admin-group', 'default'],
        write_groups: ['default'],
        execute_groups: ['default'],
        is_admin: true,
        sync_protocol: 2,
        edit_protocol: 2,
        sync_user_id: 7,
        revision: 0,
        accepted_count: 0,
        rtc_canvas_connection_id: 'fixture',
        rtc_canvas_connection_hash: 'proof',
      });
      setTimeout(() => ws.send(JSON.stringify(rtc ? { type: 'rtc_ready' } : snap('init_items'))), 80);
      ws.onMessage((raw) => {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', request_id: msg.request_id }));
        else if (msg.type === 'canvas_sync') ws.send(JSON.stringify(snap('canvas_snapshot', msg.client_id || clientId)));
        else if (msg.type === 'rtc_join') ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer', peers: [] }));
      });
    });
  }

  async function assertDomClean(page, label) {
    const result = await page.evaluate(() => {
      const formEls = [...document.querySelectorAll('input, textarea, select')];
      const missingIdOrName = formEls
        .filter((el) => !el.getAttribute('id') && !el.getAttribute('name'))
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          cls: el.className || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          placeholder: el.getAttribute('placeholder') || '',
        }));
      const idCounts = new Map();
      for (const el of document.querySelectorAll('[id]')) {
        const id = el.getAttribute('id');
        if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
      }
      const duplicateIds = [...idCounts.entries()].filter(([, n]) => n > 1);
      return { totalFormEls: formEls.length, missingIdOrName, duplicateIds };
    });
    assert.deepEqual(result.missingIdOrName, [], `${label}: form elements missing id/name: ${JSON.stringify(result.missingIdOrName)}`);
    assert.deepEqual(result.duplicateIds, [], `${label}: duplicate DOM ids: ${JSON.stringify(result.duplicateIds)}`);
    return result.totalFormEls;
  }

  // 1. Public + signup pages
  {
    const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: insecure });
    await installRoutes(context, { authenticated: false });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Audits.enable');
    cdp.on('Audits.issueAdded', ({ issue }) => cdpIssues.push({ route: 'public', issue }));

    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await assertDomClean(page, '/');

    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await assertDomClean(page, '/login');
    const signupTab = page.getByRole('button', { name: '회원가입', exact: true });
    if (await signupTab.count()) {
      await signupTab.click();
      await page.waitForTimeout(300);
      await assertDomClean(page, '/login-signup');
    }
    await context.close();
  }

  // 2. Authenticated workspace + heavy canvas + dialogs + Monaco
  {
    const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: insecure });
    await installRoutes(context, { authenticated: true });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Audits.enable');
    cdp.on('Audits.issueAdded', ({ issue }) => cdpIssues.push({ route: 'app', issue }));

    await page.goto(`${origin}/search`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '캔버스 탐색' }).waitFor();
    await assertDomClean(page, '/search');
    await page.getByRole('button', { name: '새 캔버스 만들기', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await assertDomClean(page, '/search-create-dialog');
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();

    await page.goto(`${origin}/profile`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '패스키', exact: true }).waitFor();
    await assertDomClean(page, '/profile');

    await page.goto(`${origin}/canvases/999081`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-item-id="val-0"]').waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    const canvasInputCount = await assertDomClean(page, '/canvases/999081-initial');
    assert.ok(canvasInputCount >= 20, `Expected >=20 form elements on populated canvas, got ${canvasInputCount}`);

    // Select a value object to mount Object Inspector & FloatingContextToolbar controls
    await page.locator('[data-item-id="val-0"]').click({ force: true });
    await page.waitForTimeout(300);
    await assertDomClean(page, '/canvases/999081-selected-val');

    // Open ValueObject settings form
    const valSettingsBtn = page.locator('[data-item-id="val-0"] button[aria-label="값 객체 설정"]');
    if (await valSettingsBtn.count()) {
      await valSettingsBtn.click();
      await page.waitForTimeout(200);
      await assertDomClean(page, '/canvases/999081-val-settings');
    }

    // Click code-1 on canvas stage to promote from raster cache to live DOM, then double-click to mount Monaco
    const codePoint = await page.locator('.canvas-stage').evaluate((stage) => {
      const b = stage.getBoundingClientRect();
      const m = new DOMMatrixReadOnly(stage.querySelector('.canvas-world-layer').style.transform);
      return { x: b.left + m.e + (0.04 * 1600 + 80) * m.a, y: b.top + m.f + (0.04 * 1000 + 40) * m.d };
    });
    await page.mouse.click(codePoint.x, codePoint.y);
    await page.locator('[data-item-id="code-1"]').waitFor({ timeout: 10000 });
    await page.mouse.dblclick(codePoint.x, codePoint.y);
    await page.waitForSelector('[data-item-id="code-1"] .monaco-editor textarea.inputarea', { timeout: 10000 });
    await page.waitForTimeout(300);
    await assertDomClean(page, '/canvases/999081-monaco');
    await page.keyboard.press('Escape');

    // Pan & zoom viewport with wheel/mouse across repeated canvas widgets
    await page.mouse.move(720, 500);
    await page.mouse.wheel(120, 80);
    await page.waitForTimeout(250);
    await assertDomClean(page, '/canvases/999081-after-pan');

    // Open Agent Panel and its Settings section
    const agentBtn = page.getByRole('button', { name: /AI 에이전트/ });
    if (await agentBtn.count()) {
      await agentBtn.first().click();
      await page.locator('#canvas-agent-panel').waitFor({ timeout: 5000 }).catch(() => {});
      const settingsToggle = page.locator('.canvas-agent-settings-toggle');
      if (await settingsToggle.count()) await settingsToggle.click();
      await assertDomClean(page, '/canvases/999081-agent-panel');
      await page.keyboard.press('Escape');
    }

    // Open Canvas Settings Dialog
    const canvasSettingsBtn = page.getByRole('button', { name: '캔버스 세부 설정', exact: true });
    if (await canvasSettingsBtn.count()) {
      await canvasSettingsBtn.click();
      await page.getByRole('dialog').waitFor({ timeout: 5000 });
      await assertDomClean(page, '/canvases/999081-settings-dialog');
      await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
    }

    await context.close();
  }

  const formIssues = cdpIssues.filter(({ issue }) => {
    const type = issue.details?.genericIssueDetails?.errorType || '';
    return issue.code === 'GenericIssue' && (type.includes('Form') || type.includes('Id') || type.includes('Input'));
  });
  const duplicateIdIssues = cdpIssues.filter(({ issue }) => issue.details?.genericIssueDetails?.errorType === 'FormDuplicateIdForInputError');

  assert.deepEqual(formIssues, [], `CDP reported form issues: ${JSON.stringify(formIssues)}`);
  assert.deepEqual(duplicateIdIssues, [], `CDP reported duplicate id issues: ${JSON.stringify(duplicateIdIssues)}`);
  assert.deepEqual(pageErrors, [], `Unexpected page errors: ${JSON.stringify(pageErrors)}`);
  console.log('PASS: zero Chrome Audits form id/name or duplicate-id issues across routes, repeated canvas widgets, dialogs, and Monaco');
} finally {
  await browser.close();
}
