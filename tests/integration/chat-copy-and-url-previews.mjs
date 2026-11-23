import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:8444';

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    ...(process.env.AGORA_E2E_HOST_RESOLVER
      ? ['--host-resolver-rules=' + process.env.AGORA_E2E_HOST_RESOLVER]
      : []),
  ],
});

const user = {
  email: 'chat-preview@example.invalid',
  nickname: 'PreviewUser',
  tag_number: 1,
  role: 'ROLE_USER',
  status: 'ACTIVE',
  profile_image: '/api/test-avatar',
};

const token =
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(JSON.stringify({ sub: '7', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url') +
  '.sig';

const policies = {
  default: { read: true, write: true, execute: false },
};

const caps = {
  groups: ['default'],
  write_groups: ['default'],
  execute_groups: [],
  is_admin: true,
};

const SVG_PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#0ea5e9"/></svg>'
  );

let latest = {
  box: {
    kind: 'image',
    src: SVG_PHOTO,
    filename: 'fixture.svg',
    imageFrameEnabled: false,
    x: 0.35,
    y: 0.35,
    width: 0.18,
    height: 0.16,
    permission: 'default',
  },
};

const peers = new Set();
const receipts = new Map();
const errors = [];
const previewCalls = [];
let nextChatSequence = 50;
let revision = 0;

try {
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1' || origin.startsWith('https://localhost'),
  });

  await context.addInitScript(({ token: t, user: u }) => {
    if (window !== window.top) return;
    localStorage.setItem('frelog_tool_categories', JSON.stringify({ structure: true }));
    ((t)=>{const f=window.fetch;window.fetch=function(input){return String(input?.url??input).includes('/api/auth/session/refresh')?Promise.resolve(new Response(JSON.stringify({accessToken:t}),{status:200,headers:{'Content-Type':'application/json'}})):f.apply(this,arguments);};})(t);
    localStorage.setItem('agora_user', JSON.stringify(u));

    window.__copiedClipboardText = '';
    const nativeClipboard = navigator.clipboard;
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__copiedClipboardText = String(text ?? '');
            try {
              await nativeClipboard?.writeText?.(window.__copiedClipboardText);
            } catch {
              // Ignore headless focus restrictions.
            }
          },
          readText: async () => window.__copiedClipboardText,
        },
      });
    } catch {
      // Keep native clipboard when non-configurable.
    }
    document.addEventListener('copy', () => {
      const sel = window.getSelection?.()?.toString() || '';
      if (sel) window.__copiedClipboardText = sel;
    }, true);
  }, { token, user });

  context.setDefaultTimeout(45000);

  await context.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/test-avatar' || pathname === '/api/test-preview-thumb') {
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#315e49"/></svg>',
      });
    }
    if (pathname === '/api/link-preview') {
      // Simulate unavailable HTTP endpoint before/outside canvas transport so WS recovery is also exercised.
      return route.fulfill({ status: 404, json: {} });
    }
    if (pathname === '/api/auth/me') return route.fulfill({ json: user });
    if (pathname.endsWith('/access')) {
      return route.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
    }
    if (pathname.endsWith('/settings')) {
      return route.fulfill({
        json: {
          canvas_name: 'Chat Preview Fixture',
          settings_revision: revision,
          visibility: 'private',
          participants: [],
          group_permissions: policies,
          can_manage: true,
        },
      });
    }
    return route.fulfill({ json: { canvas_id: 999004, canvas_name: 'Chat Preview Fixture' } });
  });

  await context.route('https://www.youtube-nocookie.com/embed/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0;background:#111;color:#fff;font:12px sans-serif">YouTube Embed Preview</body></html>',
    })
  );

  await context.route('https://www.youtube.com/oembed**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: {
        title: 'Never Gonna Give You Up (oEmbed)',
        author_name: 'Rick Astley',
        provider_name: 'YouTube',
      },
    })
  );

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
                groups: ['default'],
                sync_protocol: 2,
                sync_user_id: 7,
                revision,
                accepted_count: 0,
                rtc_canvas_connection_id: 'fixture',
                rtc_canvas_connection_hash: 'proof',
              }
        )
      );
    }, 80);

    ws.onMessage((raw) => {
      const data = JSON.parse(String(raw));
      if (data.type === 'rtc_join') {
        ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer-1', peers: [] }));
        return;
      }
      if (data.type === 'mentions_get') {
        ws.send(JSON.stringify({ type: 'mentions_snapshot', request_id: data.request_id, notifications: [] }));
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
          })
        );
        return;
      }
      if (data.type === 'chat_history') {
        const isComment = Boolean(data.object_id);
        ws.send(
          JSON.stringify({
            type: 'chat_history',
            request_id: data.request_id,
            room_id: 'general',
            ...(isComment ? { object_id: data.object_id } : {}),
            total: 1,
            messages: isComment
              ? []
              : [
                  {
                    sequence: 49,
                    text: '복사 테스트 문장 https://example.com/pre-transport',
                    sender: 'Other',
                    tag_number: 2,
                    created_at: Date.now() - 30_000,
                  },
                ],
            has_more: false,
            next_to_sequence: 0,
          })
        );
        return;
      }
      if (data.type === 'chat') {
        const seq = data.object_id ? 10 : nextChatSequence++;
        const msg = {
          type: 'chat',
          ...(data.object_id ? { object_id: data.object_id } : {}),
          sequence: seq,
          text: data.text,
          sender: user.nickname,
          tag_number: user.tag_number,
          created_at: Date.now(),
        };
        for (const peer of peers) peer.send(JSON.stringify(msg));
        return;
      }
      if (data.type === 'runtime_execute' && data.action === 'service') {
        const s = data.service || {};
        if (s.path === '/link-preview') {
          const url = s.body?.url || '';
          previewCalls.push(url);
          let result = {};
          if (url === 'https://example.com/pre-transport') {
            result = {
              title: 'Pre-transport Loaded Title',
              description: 'Recovered after WS transport ready.',
              siteName: 'Example',
            };
          } else if (url === 'https://example.com/article') {
            result = {
              title: 'Example Engineering Blog',
              description: 'Deep dive into canvas sync and architecture.',
              siteName: 'Example',
              image: '/api/test-preview-thumb',
            };
          }
          ws.send(JSON.stringify({ type: 'runtime_result', request_id: data.request_id, ok: true, result }));
          return;
        }
        ws.send(JSON.stringify({ type: 'runtime_result', request_id: data.request_id, ok: true, result: {} }));
      }
    });
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(origin + '/canvases/999004');
  await page.locator('.canvas-loading-status.is-overlay').waitFor({ state: 'hidden' });

  const chatToggle = page.getByRole('button', { name: /채팅 패널 (펼치기|접기)/ });
  if ((await chatToggle.getAttribute('aria-expanded')) === 'false') {
    await chatToggle.click();
  }

  // 1. Pre-transport message recovers after WS transport ready and is selectable.
  const firstEntry = page.locator('.canvas-chat-panel [data-message-id="general-49"]');
  await firstEntry.locator('.link-preview-summary strong').waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector('.canvas-chat-panel [data-message-id="general-49"] .link-preview-summary strong')
      ?.textContent?.includes('Pre-transport Loaded Title')
  );
  assert.equal(
    await firstEntry.locator('.chat-message-bubble').evaluate((el) => getComputedStyle(el).userSelect),
    'text'
  );

  // 2. Selecting text inside chat while a canvas object is ALSO selected keeps Ctrl+C scoped to chat text.
  await page.locator('[data-item-id="box"]').waitFor();
  await page.locator('[data-item-id="box"]').click();
  await page.locator('[data-item-id="box"].selected').waitFor();

  await firstEntry.locator('.simple-markdown p').evaluate((p) => {
    const range = document.createRange();
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    const text = node?.textContent || '';
    const end = text.indexOf('복사 테스트 문장') >= 0 ? '복사 테스트 문장'.length : text.length;
    range.setStart(node, 0);
    range.setEnd(node, end);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.press('ControlOrMeta+c');
  const copiedSelection = await page.evaluate(() => window.__copiedClipboardText);
  assert.equal(copiedSelection.trim(), '복사 테스트 문장');

  // Clearing text selection and refocusing the selected canvas object restores canvas object Ctrl+C copy.
  await page.evaluate(() => window.getSelection?.()?.removeAllRanges());
  await page.locator('.canvas-stage').focus();
  await page.keyboard.press('ControlOrMeta+c');
  await page.getByText('1개 객체를 복사했습니다.', { exact: true }).waitFor();

  // 3. One-click copy button copies the entire chat entry and flips its accessible state.
  await firstEntry.locator('.chat-copy-button').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.canvas-chat-panel [data-message-id="general-49"] .chat-copy-button')
        ?.getAttribute('aria-label') === '복사됨'
  );
  assert.equal(
    await page.evaluate(() => window.__copiedClipboardText),
    '복사 테스트 문장 https://example.com/pre-transport'
  );

  // 4. External URL with full metadata renders thumbnail, site name, title, description.
  const chatInput = page.getByLabel('채팅 메시지 입력', { exact: true });
  await chatInput.fill('참고 글: https://example.com/article');
  await chatInput.press('Enter');
  const articleEntry = page.locator('.canvas-chat-panel [data-message-id="general-50"]');
  await articleEntry.waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector('.canvas-chat-panel [data-message-id="general-50"] .link-preview-summary strong')
      ?.textContent?.includes('Example Engineering Blog')
  );
  assert.equal(
    await articleEntry.locator('.link-preview-summary span').innerText(),
    'Deep dive into canvas sync and architecture.'
  );
  assert.equal(await articleEntry.locator('.link-preview-thumb').count(), 1);

  // 5. URL without server metadata still renders a useful domain/path fallback card.
  await chatInput.fill('문서: https://no-metadata.example.invalid/docs/setup');
  await chatInput.press('Enter');
  const fallbackEntry = page.locator('.canvas-chat-panel [data-message-id="general-51"]');
  await fallbackEntry.waitFor();
  assert.equal(
    await fallbackEntry.locator('.link-preview-summary.is-fallback strong').innerText(),
    'no-metadata.example.invalid/docs/setup'
  );
  assert.equal(
    await fallbackEntry.locator('.link-preview-summary.is-fallback').getAttribute('href'),
    'https://no-metadata.example.invalid/docs/setup'
  );

  // 6. YouTube URL renders 16:9 video preview iframe + summary card (enriched by oEmbed fallback).
  await chatInput.fill('공유 영상 https://youtu.be/dQw4w9WgXcQ?t=25');
  await chatInput.press('Enter');
  const ytEntry = page.locator('.canvas-chat-panel [data-message-id="general-52"]');
  await ytEntry.waitFor();
  const ytIframe = ytEntry.locator('.message-youtube-frame iframe');
  await ytIframe.waitFor();
  const embedSrc = await ytIframe.getAttribute('src');
  assert.ok(embedSrc.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  assert.ok(embedSrc.includes('start=25'));
  await page.waitForFunction(() =>
    document
      .querySelector('.canvas-chat-panel [data-message-id="general-52"] .link-preview-summary strong')
      ?.textContent?.includes('Never Gonna Give You Up')
  );

  // 7. Mobile viewport overflow check: chat preview fits without horizontal overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  if ((await chatToggle.getAttribute('aria-expanded')) === 'false') {
    await chatToggle.click();
    await page.waitForTimeout(150);
  }
  const ytBox = await ytEntry.locator('.message-youtube-preview').boundingBox();
  const chatBox = await page.locator('.canvas-chat-panel').boundingBox();
  assert.ok(
    ytBox && chatBox && ytBox.x >= chatBox.x - 1 && ytBox.x + ytBox.width <= chatBox.x + chatBox.width + 1,
    `mobile YouTube preview overflow: ytBox=${JSON.stringify(ytBox)} chatBox=${JSON.stringify(chatBox)}`
  );

  // 8. Object comment also supports selectable text and YouTube video preview.
  await page.setViewportSize({ width: 1440, height: 900 });
  const settingsToggle = page.getByRole('button', { name: /설정 패널 (펼치기|접기)/ });
  if ((await settingsToggle.getAttribute('aria-expanded')) === 'false') {
    await settingsToggle.click();
  }
  await page.getByRole('button', { name: '객체 댓글', exact: true }).click();
  const commentPanel = page.locator('.object-comments-panel');
  await commentPanel.waitFor();
  const commentInput = commentPanel.locator('textarea');
  await commentInput.fill('댓글 유튜브 https://youtu.be/dQw4w9WgXcQ');
  await commentInput.press('Enter');
  await commentPanel.locator('.message-youtube-frame iframe').waitFor();
  assert.equal(
    await commentPanel.locator('.object-comment .simple-markdown').first().evaluate((el) => getComputedStyle(el).userSelect),
    'text'
  );

  assert.deepEqual(errors, []);
  console.log('PASS: chat selection copy, Ctrl+C unscoped when object selected, copy button, URL summary/fallback, YouTube preview in chat & object comments');
  await context.close();
} finally {
  await browser.close();
}
