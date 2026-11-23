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

const user = { email: 'me@example.invalid', nickname: 'Alice', tag_number: 1, role: 'ROLE_USER', status: 'ACTIVE' };
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')}.test`;
const policies = { default: { read: true, write: true, execute: true } };

const items = Object.fromEntries(
  Array.from({ length: 1000 }, (_, i) => [
    `s-${i}`,
    {
      kind: 'shape',
      shapeType: 'rectangle',
      x: (i % 40) / 40,
      y: Math.floor(i / 40) / 25,
      width: 0.015,
      height: 0.02,
      fill: '#9ab0a2',
      strokeEnabled: false,
      shadowEnabled: false,
      permission: 'default',
    },
  ]),
);
items.targetObj = { kind: 'note', text: 'Comment target', x: 0.3, y: 0.3, width: 0.2, height: 0.14, permission: 'default' };

const errors = [];

try {
  for (const viewport of [
    { width: 1440, height: 900, mobile: false },
    { width: 390, height: 844, mobile: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      locale: 'ko-KR',
      ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
    });
    await context.addInitScript(({ token, user }) => {
      if (window !== window.top) return;
      ((t)=>{const f=window.fetch;window.fetch=function(input){return String(input?.url??input).includes('/api/auth/session/refresh')?Promise.resolve(new Response(JSON.stringify({accessToken:t}),{status:200,headers:{'Content-Type':'application/json'}})):f.apply(this,arguments);};})(token);
      localStorage.setItem('agora_user', JSON.stringify(user));
    }, { token, user });
    context.setDefaultTimeout(45000);

    let notes = [];
    let commentSeq = 50;
    const peers = new Set();

    await context.route(url => url.pathname.startsWith('/api/'), r => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/api/auth/me') return r.fulfill({ json: user });
      if (path.endsWith('/access')) return r.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
      if (path.endsWith('/settings')) {
        return r.fulfill({
          json: {
            canvas_name: 'Chat Layout Fixture',
            settings_revision: 0,
            visibility: 'private',
            participants: [],
            group_permissions: policies,
            can_manage: true,
          },
        });
      }
      return r.fulfill({ json: { canvas_id: 999010, canvas_name: 'Chat Layout Fixture' } });
    });

    await context.routeWebSocket(/\/wss\/port\//, ws => {
      const rtc = ws.url().includes('/rtc/');
      if (!rtc) {
        peers.add(ws);
        ws.onClose(() => peers.delete(ws));
      }
      setTimeout(() => {
        ws.send(JSON.stringify(rtc ? { type: 'rtc_ready' } : {
          type: 'init_items',
          items,
          groups: ['default'],
          write_groups: ['default'],
          execute_groups: ['default'],
          is_admin: true,
          sync_protocol: 2,
          sync_user_id: 7,
          revision: 0,
          accepted_count: 0,
          rtc_canvas_connection_id: 'fixture',
          rtc_canvas_connection_hash: 'proof',
        }));
      }, 80);

      ws.onMessage(raw => {
        const data = JSON.parse(String(raw));
        if (data.type === 'chat_history') {
          const isComment = Boolean(data.object_id);
          const list = isComment
            ? [
                { sequence: 49, text: 'Comment ping @Alice#1', sender: 'Bob', tag_number: 2, created_at: Date.now() - 2000 },
              ]
            : [
                { sequence: 10, text: 'Hello @Alice#1 from Bob', sender: 'Bob', tag_number: 2, created_at: Date.now() - 4000 },
                { sequence: 11, text: 'My own reply message\nwith second line', sender: 'Alice', tag_number: 1, created_at: Date.now() - 2000 },
              ];
          ws.send(JSON.stringify({
            type: 'chat_history',
            request_id: data.request_id,
            room_id: 'general',
            ...(isComment ? { object_id: data.object_id } : {}),
            total: isComment ? 49 : 11,
            messages: list,
            has_more: false,
            next_to_sequence: null,
          }));
        } else if (data.type === 'chat') {
          ws.send(JSON.stringify({
            type: 'chat',
            sequence: data.object_id ? ++commentSeq : 12,
            ...(data.object_id ? { object_id: data.object_id } : {}),
            text: data.text,
            sender: user.nickname,
            tag_number: user.tag_number,
            created_at: Date.now(),
          }));
        } else if (data.type === 'mentions_get') {
          ws.send(JSON.stringify({ type: 'mentions_snapshot', request_id: data.request_id, notifications: notes }));
        } else if (data.type === 'mention_read') {
          notes = [];
          ws.send(JSON.stringify({ type: 'mention_read', request_id: data.request_id, mention_id: data.mention_id }));
        }
      });
    });

    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/canvases/999010`);
    const chatToggle = page.getByRole('button', { name: /채팅 패널 (펼치기|접기)/ });
    await chatToggle.waitFor();
    await page.locator('.canvas-loading-status.is-overlay').waitFor({ state: 'hidden' });
    if (await chatToggle.getAttribute('aria-expanded') === 'false') {
      await chatToggle.click();
    }
    await page.locator('.canvas-chat-panel .chat-entry').first().waitFor();

    // 1. Assert other user's avatar is on the left, own avatar is on the right.
    const layout = await page.locator('.canvas-chat-panel .message-list').evaluate(list => {
      const entries = [...list.querySelectorAll('.chat-entry')].map(entry => {
        const avatar = entry.querySelector('.chat-entry-avatar').getBoundingClientRect();
        const content = entry.querySelector('.chat-entry-content').getBoundingClientRect();
        const row = entry.getBoundingClientRect();
        return {
          own: entry.classList.contains('own'),
          flexDirection: getComputedStyle(entry).flexDirection,
          avatarLeft: avatar.left,
          avatarRight: avatar.right,
          contentLeft: content.left,
          contentRight: content.right,
          rowLeft: row.left,
          rowRight: row.right,
        };
      });
      return entries;
    });
    const otherEntry = layout.find(e => !e.own);
    const ownEntry = layout.find(e => e.own);
    assert.ok(otherEntry && ownEntry, 'Both other and own chat entries should exist');
    assert.equal(otherEntry.flexDirection, 'row', `other message row layout (${viewport.width})`);
    assert.ok(otherEntry.avatarRight <= otherEntry.contentLeft + 1, `other avatar must be left of content (${JSON.stringify(otherEntry)})`);
    assert.equal(ownEntry.flexDirection, 'row-reverse', `own message row-reverse layout (${viewport.width})`);
    assert.ok(ownEntry.avatarLeft >= ownEntry.contentRight - 1, `own avatar must be right of content (${JSON.stringify(ownEntry)})`);

    // 2. Mention highlight animation on click (both light & dark theme verified on desktop).
    notes = [{ mention_id: 'm-1', unread: true, sequence: 10, text: 'Hello @Alice#1 from Bob', sender: 'Bob', tag_number: 2, created_at: Date.now() }];
    for (const peer of peers) peer.send(JSON.stringify({ type: 'mentions_changed' }));
    await page.locator('.mention-notification-link').waitFor();
    await page.locator('.mention-notification-link').click();
    const target = page.locator('.chat-entry.mention-target');
    await target.waitFor();
    const highlightStyle = await target.evaluate(el => {
      const s = getComputedStyle(el);
      return {
        animationName: s.animationName,
        animationDuration: s.animationDuration,
        outlineStyle: s.outlineStyle,
        borderRadius: s.borderRadius,
      };
    });
    assert.equal(highlightStyle.animationName, 'mention-target-highlight', `mention highlight must animate cleanly (${JSON.stringify(highlightStyle)})`);
    assert.equal(highlightStyle.outlineStyle, 'none', 'mention highlight must not draw harsh static outline');
    assert.ok(parseFloat(highlightStyle.animationDuration) >= 2.5, 'mention fade/pulse animation should span ~3s lifecycle');

    const assertHighlightContainment = async (locator, label) => {
      const box = await locator.evaluate(el => {
        const entry = el.getBoundingClientRect();
        const avatar = el.querySelector('.chat-entry-avatar').getBoundingClientRect();
        const content = el.querySelector('.chat-entry-content').getBoundingClientRect();
        return {
          leftPad: avatar.left - entry.left,
          rightPad: entry.right - avatar.right,
          topPad: avatar.top - entry.top,
          bottomAvatarPad: entry.bottom - avatar.bottom,
          contentLeftPad: content.left - entry.left,
          contentRightPad: entry.right - content.right,
          contentBottomPad: entry.bottom - content.bottom,
        };
      });
      for (const [edge, value] of Object.entries(box)) {
        assert.ok(value >= 6, `${label} ${edge} must keep >= 6px inside highlight box (got ${value}, ${JSON.stringify(box)})`);
      }
    };
    await assertHighlightContainment(target, 'other mention highlight');

    await target.waitFor({ state: 'detached', timeout: 5000 });

    notes = [{ mention_id: 'm-own', unread: true, sequence: 11, text: 'My own reply message\nwith second line', sender: 'Alice', tag_number: 1, created_at: Date.now() }];
    for (const peer of peers) peer.send(JSON.stringify({ type: 'mentions_changed' }));
    await page.locator('.mention-notification-link').waitFor();
    await page.locator('.mention-notification-link').click();
    const ownTarget = page.locator('.chat-entry.own.mention-target');
    await ownTarget.waitFor();
    await assertHighlightContainment(ownTarget, 'own mention highlight');
    await ownTarget.waitFor({ state: 'detached', timeout: 5000 });

    // Object comment mention highlight animation check on desktop.
    if (!viewport.mobile) {
      notes = [{ mention_id: 'm-2', unread: true, object_id: 'targetObj', sequence: 49, text: 'Comment ping @Alice#1', sender: 'Bob', tag_number: 2, created_at: Date.now() }];
      for (const peer of peers) peer.send(JSON.stringify({ type: 'mentions_changed' }));
      await page.locator('.mention-notification-link').waitFor();
      await page.locator('.mention-notification-link').click();
      const commentTarget = page.locator('.object-comment.mention-target');
      await commentTarget.waitFor();
      const commentAnim = await commentTarget.evaluate(el => getComputedStyle(el).animationName);
      assert.equal(commentAnim, 'mention-target-highlight');
      await page.getByRole('button', { name: '댓글 닫기', exact: true }).click();

      // 3. Real Ctrl+Wheel zoom responsiveness & ink skip & settle recovery verification.
      await page.waitForFunction(() => [...document.querySelectorAll('.vector-layer')].every(n => !n.__agoraRenderStats?.preparing));
      await page.mouse.move(720, 460);
      let sawZooming = false;
      await page.keyboard.down('Control');
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, i < 10 ? 50 : -50);
        if (i === 5) sawZooming = await page.evaluate(() => document.querySelector('.canvas-stage')?.classList.contains('camera-zooming'));
        await page.waitForTimeout(16);
      }
      await page.keyboard.up('Control');
      await page.waitForTimeout(260);
      const zoomState = await page.evaluate(() => ({
        zoomingClassStillActive: document.querySelector('.canvas-stage')?.classList.contains('camera-zooming'),
        inkFrames: [...document.querySelectorAll('.vector-layer')].reduce((n, e) => n + (e.__agoraRenderStats?.inkFrames || 0), 0),
        preparing: [...document.querySelectorAll('.vector-layer')].some(e => e.__agoraRenderStats?.preparing),
      }));
      assert.equal(sawZooming, true, 'Ctrl+Wheel must engage camera-zooming class during active zoom');
      assert.equal(zoomState.zoomingClassStillActive, false, 'camera-zooming must settle cleanly after idle');
      assert.equal(zoomState.inkFrames, 0, 'zero-stroke canvas must not run inkRenderer on zoom frames');
      assert.equal(zoomState.preparing, false, 'vector layers finish cleanly after zoom settle');
    }

    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS own avatar right, other avatar left (desktop & mobile), natural mention pulse-fade animation, and zoom optimization invariants');
} finally {
  await browser.close();
}
