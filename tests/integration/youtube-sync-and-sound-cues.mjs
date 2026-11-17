import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:8444';

const writerUser = {
  email: 'roles@example.invalid',
  nickname: 'Roles',
  tag_number: 1,
  role: 'ROLE_USER',
  status: 'ACTIVE',
};
const readerUser = {
  email: 'reader@example.invalid',
  nickname: 'Reader',
  tag_number: 2,
  role: 'ROLE_USER',
  status: 'ACTIVE',
};
const makeToken = (sub) =>
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url') +
  '.sig';

const policies = {
  'admin-group': { read: true, write: true, execute: true },
  default: { read: true, write: false, execute: false },
};

const initialItems = {
  box: { kind: 'shape', shapeType: 'rectangle', x: 0.55, y: 0.1, width: 0.2, height: 0.18, permission: 'default' },
};

const canvasPeers = new Set();
const rtcSockets = new Set();
const rtcPeers = new Map();
const receipts = new Map();
const errors = [];
const packets = [];
let latest = structuredClone(initialItems);
let revision = 0;
let writes = 0;
let readerWrites = 0;
let rtcGeneration = 0;
let nextChatSequence = 200;
let notes = [
  {
    mention_id: 'initial-backlog-1',
    unread: true,
    sequence: 10,
    text: '@Roles#1 previous backlog mention',
    sender: 'Other',
    tag_number: 2,
    created_at: Date.now() - 60_000,
  },
];

async function installRoutes(context, { user, token, caps }) {
  await context.addInitScript(({ token: t, user: u }) => {
    if (window !== window.top) return;
    localStorage.setItem('frelog_tool_categories', JSON.stringify({ structure: true }));
    localStorage.setItem('agora_token', t);
    localStorage.setItem('agora_user', JSON.stringify(u));

    window.__soundCues = [];
    window.__oscillatorStarts = [];
    window.__displayMediaMode = 'stream';
    window.addEventListener('agora:sound-cue', (event) => {
      window.__soundCues.push(event.detail?.cue);
    });

    const wrapAudioContext = (NativeCtx) => {
      if (!NativeCtx) return NativeCtx;
      return class TrackedAudioContext extends NativeCtx {
        createOscillator() {
          const osc = super.createOscillator();
          const origStart = osc.start.bind(osc);
          osc.start = (...args) => {
            window.__oscillatorStarts.push({
              freq: osc.frequency?.value || 0,
              state: this.state,
            });
            return origStart(...args);
          };
          return osc;
        }
      };
    };
    if (window.AudioContext) {
      window.AudioContext = wrapAudioContext(window.AudioContext);
    }
    if (window.webkitAudioContext) {
      window.webkitAudioContext = wrapAudioContext(window.webkitAudioContext);
    }

    const patchDisplayMedia = () => {
      const devices = navigator.mediaDevices;
      if (!devices) return;
      devices.getDisplayMedia = async () => {
        if (window.__displayMediaMode === 'cancel') {
          const err = new Error('Permission denied');
          err.name = 'NotAllowedError';
          throw err;
        }
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx?.fillRect(0, 0, 64, 64);
        return canvas.captureStream(1);
      };
    };
    patchDisplayMedia();
  }, { token, user });

  const settings = () => ({
    canvas_name: 'YouTube & Sound Cue E2E',
    settings_revision: revision,
    visibility: 'private',
    participants: [],
    group_permissions: policies,
    can_manage: Boolean(caps.is_admin),
  });

  await context.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: user });
    if (path.endsWith('/access')) return route.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
    if (path.endsWith('/settings')) return route.fulfill({ json: settings() });
    return route.fulfill({ json: { canvas_id: 999004, canvas_name: 'YouTube & Sound Cue E2E' } });
  });

  await context.routeWebSocket(/\/wss\/port\//, (ws) => {
    const isRtc = ws.url().includes('/rtc/');
    const clientSet = isRtc ? rtcSockets : canvasPeers;
    clientSet.add(ws);
    const sendVoiceNotice = (senderWs, peerId, notice) => {
      for (const [otherWs, other] of rtcPeers) {
        if (otherWs !== senderWs && other.voice_active) {
          otherWs.send(JSON.stringify({ type: 'voice_notice', event: notice, peer_id: peerId }));
        }
      }
    };
    ws.onClose(() => {
      clientSet.delete(ws);
      if (isRtc && rtcPeers.has(ws)) {
        const closed = rtcPeers.get(ws);
        rtcPeers.delete(ws);
        for (const [otherWs] of rtcPeers) {
          otherWs.send(JSON.stringify({ type: 'rtc_peer_left', peer_id: closed.peerId }));
        }
        if (closed.voice_active) sendVoiceNotice(ws, closed.peerId, 'voice_leave');
      }
    });

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
              sync_user_id: user.tag_number === 1 ? 7 : 8,
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
      packets.push(data);
      if (data.type === 'canvas_sync') {
        ws.send(
          JSON.stringify({
            type: 'canvas_snapshot',
            client_id: data.client_id,
            items: latest,
            ...caps,
            sync_protocol: 2,
            sync_user_id: user.tag_number === 1 ? 7 : 8,
            revision,
            accepted_count: receipts.get(data.client_id) || 0,
          })
        );
      } else if (data.type === 'rtc_join') {
        const gen = ++rtcGeneration;
        const peerId = `peer-${gen}`;
        const existingPeers = [...rtcPeers.values()].map((peer) => ({
          peer_id: peer.peerId,
          nickname: peer.nickname,
          tag_number: peer.tag_number,
          groups: peer.groups,
          voice_active: peer.voice_active,
          voice_muted: peer.voice_muted,
          screen_sharing: peer.screen_sharing,
        }));
        const publicPeer = {
          peer_id: peerId,
          nickname: user.nickname,
          tag_number: user.tag_number,
          groups: ['default'],
          voice_active: false,
          voice_muted: false,
          screen_sharing: false,
        };
        rtcPeers.set(ws, { peerId, ...publicPeer });
        ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: peerId, peers: existingPeers }));
        for (const [otherWs] of rtcPeers) {
          if (otherWs !== ws) {
            otherWs.send(JSON.stringify({ type: 'rtc_peer_joined', peer: publicPeer }));
          }
        }
      } else if (data.type === 'voice_state') {
        const peer = rtcPeers.get(ws);
        if (!peer) return;
        const prevActive = peer.voice_active;
        const prevSharing = peer.screen_sharing;
        const nextActive = Boolean(data.active);
        const nextMuted = nextActive && Boolean(data.muted);
        const nextSharing = nextActive && data.screen_sharing === true;
        peer.voice_active = nextActive;
        peer.voice_muted = nextMuted;
        peer.screen_sharing = nextSharing;
        for (const [otherWs] of rtcPeers) {
          otherWs.send(
            JSON.stringify({
              type: 'voice_state',
              peer_id: peer.peerId,
              active: nextActive,
              muted: nextMuted,
              screen_sharing: nextSharing,
            })
          );
        }
        const notices = [];
        if (!prevActive && nextActive) {
          notices.push('voice_join');
          if (nextSharing) notices.push('screen_share_start');
        } else if (prevActive && !nextActive) {
          notices.push('voice_leave');
        } else if (prevActive && nextActive) {
          if (!prevSharing && nextSharing) notices.push('screen_share_start');
          else if (prevSharing && !nextSharing) notices.push('screen_share_stop');
        }
        for (const cue of notices) sendVoiceNotice(ws, peer.peerId, cue);
      } else if (data.type === 'chat_history') {
        const isComment = Boolean(data.object_id);
        ws.send(
          JSON.stringify({
            type: 'chat_history',
            request_id: data.request_id,
            room_id: 'general',
            ...(isComment ? { object_id: data.object_id } : {}),
            total: 2,
            messages: [
              {
                sequence: isComment ? 159 : 198,
                text: 'Old history @Roles#1 should not chime',
                sender: 'Other',
                tag_number: 2,
                created_at: Date.now() - 120_000,
              },
            ],
            has_more: false,
            next_to_sequence: 0,
          })
        );
      } else if (data.type === 'chat') {
        const seq = data.object_id ? 160 : nextChatSequence++;
        const msg = {
          type: 'chat',
          ...(data.object_id ? { object_id: data.object_id } : {}),
          sequence: seq,
          text: data.text,
          sender: user.nickname,
          tag_number: user.tag_number,
          created_at: Date.now(),
        };
        for (const peer of canvasPeers) peer.send(JSON.stringify(msg));
      } else if (data.type === 'mentions_get') {
        ws.send(
          JSON.stringify({
            type: 'mentions_snapshot',
            request_id: data.request_id,
            notifications: notes.filter((n) => !n.target || n.target === user.nickname),
          })
        );
      } else if (data.type === 'mention_read') {
        notes = notes.filter((n) => n.mention_id !== data.mention_id);
        ws.send(
          JSON.stringify({
            type: 'mention_read',
            request_id: data.request_id,
            mention_id: data.mention_id,
          })
        );
      } else if (data.type === 'canvas_ops') {
        if ((receipts.get(data.client_id) || 0) >= data.request_count) {
          ws.send(
            JSON.stringify({
              type: 'canvas_result',
              request_id: data.request_id,
              ok: true,
              duplicate: true,
              server_revision: revision,
            })
          );
          return;
        }
        writes++;
        if (user === readerUser) readerWrites++;
        const touched = {};
        receipts.set(data.client_id, data.request_count);
        for (const op of data.operations) {
          if (op.action === 'delete') {
            delete latest[op.id];
            continue;
          }
          if (op.action === 'translate') {
            for (const id of op.ids) {
              latest[id] = { ...latest[id], x: latest[id].x + op.dx, y: latest[id].y + op.dy };
              touched[id] = latest[id];
            }
            continue;
          }
          latest[op.id] = { ...latest[op.id], ...op.patch };
          for (const field of op.unset || []) delete latest[op.id][field];
          touched[op.id] = latest[op.id];
        }
        const deleted = Object.fromEntries(
          data.operations.filter((o) => o.action === 'delete').map((o) => [o.id, null])
        );
        revision++;
        for (const peer of canvasPeers) {
          peer.send(
            JSON.stringify({
              type: 'canvas_commit',
              client_id: data.client_id,
              author_id: user.tag_number === 1 ? 7 : 8,
              request_count: data.request_count,
              revision,
              items: { ...touched, ...deleted },
            })
          );
        }
      }
    });
  });

  await context.route('https://www.youtube-nocookie.com/embed/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<body>YouTube Sync Fixture<script>
        window.mockMedia = { time: 0, state: 2, muted: false, cmds: [] };
        function report() {
          parent.postMessage(JSON.stringify({
            event: 'infoDelivery',
            info: { currentTime: mockMedia.time, playerState: mockMedia.state, duration: 120, muted: mockMedia.muted, volume: mockMedia.muted ? 0 : 100 }
          }), '*');
        }
        addEventListener('message', (e) => {
          let d;
          try { d = JSON.parse(e.data); } catch { return; }
          if (d.event === 'command') {
            mockMedia.cmds.push({ func: d.func, args: d.args || [] });
            if (d.func === 'seekTo') mockMedia.time = Number(d.args[0] || 0);
            if (d.func === 'playVideo') mockMedia.state = 1;
            if (d.func === 'pauseVideo') mockMedia.state = 2;
            if (d.func === 'mute') mockMedia.muted = true;
            if (d.func === 'unMute') mockMedia.muted = false;
            report();
          } else if (d.event === 'listening') {
            report();
          }
        });
        setInterval(report, 150);
      </script></body>`,
    })
  );
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    ...(process.env.AGORA_E2E_HOST_RESOLVER ? ['--host-resolver-rules=' + process.env.AGORA_E2E_HOST_RESOLVER] : []),
  ],
});

try {
  const writerContext = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1440, height: 960 },
    locale: 'ko-KR',
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
  });
  const readerContext = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    locale: 'ko-KR',
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
  });

  await installRoutes(writerContext, {
    user: writerUser,
    token: makeToken('writer'),
    caps: { groups: ['default'], write_groups: ['default'], execute_groups: ['default'], is_admin: true },
  });
  await installRoutes(readerContext, {
    user: readerUser,
    token: makeToken('reader'),
    caps: { groups: ['default'], write_groups: [], execute_groups: [], is_admin: false },
  });

  const writer = await writerContext.newPage();
  const observer = await writerContext.newPage();
  const reader = await readerContext.newPage();
  for (const [label, p] of [
    ['writer', writer],
    ['observer', observer],
    ['reader', reader],
  ]) {
    p.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  }

  const waitForCanvasReady = (p) =>
    p.waitForFunction(
      () =>
        Boolean(window.frelogCanvas?.read().items?.box) &&
        Boolean(document.querySelector('.connection-pill.connected')) &&
        !document.querySelector('.canvas-loading-status')
    );

  await writer.goto(`${origin}/canvases/999004`);
  await waitForCanvasReady(writer);
  await observer.goto(`${origin}/canvases/999004`);
  await waitForCanvasReady(observer);
  await reader.goto(`${origin}/canvases/999004`);
  await waitForCanvasReady(reader);

  // Wait briefly so initial mentions_snapshot / backlog resolves, verifying zero false mention chimes on load.
  await writer.waitForTimeout(300);
  assert.deepEqual(await writer.evaluate(() => window.__soundCues), [], 'initial unread mention backlog must not chime');

  // --- PART 1: YouTube Independent Per-User Viewing (No Cross-User Sync) ---
  await writer.locator('.canvas-stage').evaluate((stage) => {
    stage.focus();
    const data = new DataTransfer();
    data.setData('text/plain', 'https://youtu.be/dQw4w9WgXcQ?t=25');
    stage.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });

  await observer.waitForFunction(() =>
    Object.values(window.frelogCanvas?.read().items || {}).some(
      (i) => i.kind === 'link' && i.mediaType === 'youtube'
    )
  );
  const ytId = await writer.evaluate(
    () => Object.entries(window.frelogCanvas.read().items).find(([, i]) => i.mediaType === 'youtube')?.[0]
  );
  assert.ok(ytId, 'pasted YouTube link created independent YouTube link object');

  const ytSnapshot = await observer.evaluate((id) => window.frelogCanvas.read().items[id], ytId);
  assert.equal(ytSnapshot.mediaState, undefined, 'YouTube link must not store shared mediaState');
  assert.equal(ytSnapshot.mediaLoop, undefined, 'YouTube link must not store shared mediaLoop');

  await reader.waitForFunction((id) => Boolean(window.frelogCanvas?.read().items[id]), ytId);
  const writerYt = writer.locator(`[data-item-id="${ytId}"]`);
  const readerYt = reader.locator(`[data-item-id="${ytId}"]`);

  // Pasted object is auto-selected on writer; deselecting restores pan guard, selecting removes it.
  assert.equal(await readerYt.locator('.shared-media-activate').count(), 0);
  assert.equal(await writerYt.locator('.shared-media-activate').count(), 0);
  await writer.locator('.canvas-stage').click({ position: { x: 180, y: 180 } });
  assert.equal(await writerYt.locator('.shared-media-activate').count(), 0);
  await writerYt.click({ position: { x: 10, y: 10 } });
  await writerYt.hover();
  assert.equal(await writerYt.locator('.shared-media-activate').count(), 0);

  // Neither writer nor reader exposes shared YouTube sync buttons or scrubber.
  for (const card of [writerYt, readerYt]) {
    if (card === readerYt) {
      await readerYt.click({ position: { x: 10, y: 10 } });
      await readerYt.hover();
    }
    assert.equal(await card.getByRole('button', { name: '공유 재생', exact: true }).count(), 0);
    assert.equal(await card.getByRole('button', { name: '공유 일시정지', exact: true }).count(), 0);
    assert.equal(await card.getByRole('button', { name: '반복 재생', exact: true }).count(), 0);
    assert.equal(await card.getByLabel('공유 재생 위치').count(), 0);
  }

  for(const [page,card]of [[writer,writerYt],[observer,observer.locator(`[data-item-id="${ytId}"]`)],[reader,readerYt]]){const loaded=page.waitForEvent('framenavigated',{predicate:frame=>frame.url().includes('youtube-nocookie.com/embed/')});await card.getByRole('button',{name:'YouTube 재생',exact:true}).click();await loaded;}
  const writerSrc = await writerYt.locator('iframe').getAttribute('src');
  const readerSrc = await readerYt.locator('iframe').getAttribute('src');
  assert.ok(writerSrc?.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'writer renders embed URL');
  assert.ok(writerSrc?.includes('playsinline=1&rel=0&start=25'), 'writer preserves ?t=25 start param');
  assert.ok(readerSrc?.includes('playsinline=1&rel=0&start=25'), 'reader preserves ?t=25 start param');

  const writerFrame = writer.frames().find((f) => f.url().includes('youtube-nocookie.com/embed/'));
  const observerFrame = observer.frames().find((f) => f.url().includes('youtube-nocookie.com/embed/'));
  const readerFrame = reader.frames().find((f) => f.url().includes('youtube-nocookie.com/embed/'));
  assert.ok(writerFrame && observerFrame && readerFrame, 'all three browsers render the YouTube embed iframe');
  await Promise.all([writerFrame, observerFrame, readerFrame].map((f) => f.waitForFunction(() => Boolean(window.mockMedia))));

  // Playing & seeking in writer's YouTube iframe stays local and does NOT sync observer or reader.
  await writerYt.locator('iframe').evaluate((node) => node.focus());
  await writerFrame.evaluate(() => {
    mockMedia.state = 1;
    mockMedia.time = 67;
    report();
  });
  await new Promise((r) => setTimeout(r, 350));
  const writerStored = await writer.evaluate((id) => window.frelogCanvas.read().items[id], ytId);
  assert.equal(writerStored.mediaState, undefined, 'local playback must not emit shared mediaState');
  assert.deepEqual(
    await observerFrame.evaluate(() => ({ state: mockMedia.state, time: mockMedia.time, cmds: mockMedia.cmds })),
    { state: 2, time: 0, cmds: [] },
    'observer playback must remain independent from writer'
  );
  assert.deepEqual(
    await readerFrame.evaluate(() => ({ state: mockMedia.state, time: mockMedia.time, cmds: mockMedia.cmds })),
    { state: 2, time: 0, cmds: [] },
    'reader playback must remain independent from writer'
  );
  assert.equal(readerWrites, 0, 'read-only viewer issued zero writes');

  await observer.reload();
  await waitForCanvasReady(observer);
  await observer.waitForFunction(
    (id) => window.frelogCanvas?.read().items[id]?.mediaType === 'youtube' && !window.frelogCanvas.read().items[id]?.mediaState,
    ytId
  );
  assert.equal(await observer.locator(`[data-item-id="${ytId}"] iframe`).count(),0,'reload returns to an inert preview');
  await observer.locator(`[data-item-id="${ytId}"]`).getByRole('button',{name:'YouTube 재생',exact:true}).click();
  assert.ok(
    (await observer.locator(`[data-item-id="${ytId}"] iframe`).getAttribute('src'))?.includes('start=25'),
    'reloaded observer still embeds independent YouTube with start=25'
  );
  console.log('PASS YouTube independent viewing: ?t=25 embed, pan guard when unselected, zero shared controls, and no cross-user sync');

  // --- PART 2: Web Audio Sound Cues (Voice Join, Screen Share, Voice Leave, Chat & Object Comment Mentions) ---
  await writer.getByRole('button', { name: '음성 통화', exact: true }).click();
  await writer.locator('.canvas-chat-panel .canvas-voice').waitFor();

  // 1) Voice join cue + real AudioContext oscillator creation.
  await writer.getByRole('button', { name: '통화 참여', exact: true }).click();
  await writer.waitForFunction(() => window.__soundCues.includes('voice_join'));
  assert.ok(
    await writer.evaluate(() => window.__oscillatorStarts.length > 0),
    'sound cue creates and starts real Web Audio oscillators'
  );
  const cuesAfterJoin = await writer.evaluate(() => window.__soundCues.length);

  // 2) Temporary broker reconnect must NOT replay join or leave cue.
  const prevRtcGen = rtcGeneration;
  for (const sock of [...rtcSockets]) sock.close({ code: 1012, reason: 'temporary reconnect test' });
  for (let i = 0; i < 120 && rtcGeneration === prevRtcGen; i++) await writer.waitForTimeout(50);
  await writer.waitForFunction(() => document.querySelector('.voice-status')?.textContent?.includes('통화 중'));
  assert.equal(
    await writer.evaluate(() => window.__soundCues.length),
    cuesAfterJoin,
    'temporary broker reconnect must not emit voice_leave or voice_join cues'
  );

  // 3) Observer joins voice -> both observer and already-connected writer hear voice_join; non-voice reader hears nothing.
  await observer.getByRole('button', { name: '음성 통화', exact: true }).click();
  await observer.locator('.canvas-chat-panel .canvas-voice').waitFor();
  await observer.waitForFunction(() => document.querySelector('.voice-join')?.disabled === false);
  await observer.getByRole('button', { name: '통화 참여', exact: true }).click();
  await observer.waitForFunction(() => window.__soundCues.includes('voice_join'));
  await writer.waitForFunction(() => window.__soundCues.filter((c) => c === 'voice_join').length === 2);
  assert.deepEqual(await reader.evaluate(() => window.__soundCues), [], 'non-voice reader must not receive voice_join cue');

  // 4) Cancelled screen share prompt must NOT emit screen_share_start to self or peers.
  await writer.evaluate(() => {
    window.__displayMediaMode = 'cancel';
  });
  await writer.getByRole('button', { name: '화면 공유', exact: true }).click();
  await writer.waitForTimeout(200);
  assert.equal(
    await writer.evaluate(() => window.__soundCues.length),
    cuesAfterJoin + 1,
    'cancelled screen share permission prompt must not emit cue'
  );
  assert.deepEqual(await observer.evaluate(() => window.__soundCues), ['voice_join']);

  // 5) Active screen share emits screen_share_start to both sharer and connected peers (not non-voice reader).
  await writer.evaluate(() => {
    window.__displayMediaMode = 'stream';
  });
  await writer.getByRole('button', { name: '화면 공유', exact: true }).click();
  await writer.waitForFunction(() => window.__soundCues.includes('screen_share_start'));
  await observer.waitForFunction(() => window.__soundCues.includes('screen_share_start'));
  assert.deepEqual(await reader.evaluate(() => window.__soundCues), [], 'non-voice reader must not receive screen_share_start');

  // 6) Stopping screen share emits screen_share_stop to both sharer and connected peers (not non-voice reader).
  await writer.getByRole('button', { name: '화면 공유 중지', exact: true }).click();
  await writer.waitForFunction(() => window.__soundCues.includes('screen_share_stop'));
  await observer.waitForFunction(() => window.__soundCues.includes('screen_share_stop'));
  assert.deepEqual(await reader.evaluate(() => window.__soundCues), [], 'non-voice reader must not receive screen_share_stop');

  // 7) Leaving voice call emits voice_leave to self and remaining connected peers; then observer leaves alone.
  await writer.getByRole('button', { name: '통화 나가기', exact: true }).click();
  await writer.waitForFunction(() => window.__soundCues.includes('voice_leave'));
  await observer.waitForFunction(() => window.__soundCues.includes('voice_leave'));
  await observer.waitForTimeout(120);
  await observer.getByRole('button', { name: '통화 나가기', exact: true }).click();
  await observer.waitForFunction(() => window.__soundCues.filter((c) => c === 'voice_leave').length === 2);
  await writer.waitForTimeout(150);
  assert.equal(
    await writer.evaluate(() => window.__soundCues.filter((c) => c === 'voice_leave').length),
    1,
    'disconnected user must not hear peer voice_leave cue'
  );
  assert.deepEqual(await reader.evaluate(() => window.__soundCues), [], 'non-voice reader must still have zero sound cues');

  // 8) Self-mention in general chat must NOT emit mention cue (also ignore chat_history).
  await writer.getByRole('tab', { name: '채팅', exact: true }).click();
  await writer.waitForTimeout(150);
  const cuesBeforeSelfMention = await writer.evaluate(() => window.__soundCues.length);
  await writer.getByLabel('채팅 메시지 입력', { exact: true }).fill('self ping @Roles#1');
  await writer.getByLabel('채팅 메시지 입력', { exact: true }).press('Enter');
  await writer.waitForTimeout(200);
  assert.equal(
    await writer.evaluate(() => window.__soundCues.length),
    cuesBeforeSelfMention,
    'self-mention and chat history must not emit mention chime'
  );

  // 7) Live general chat mention + trailing mentions_changed must chime only ONCE.
  notes.push({
    mention_id: 'live-chat-note-1',
    target: 'Roles',
    unread: true,
    sequence: 205,
    text: '확인해주세요 @Roles#1',
    sender: 'Other',
    tag_number: 2,
    created_at: Date.now(),
  });
  for (const peer of canvasPeers) {
    peer.send(
      JSON.stringify({
        type: 'chat',
        sequence: 205,
        text: '확인해주세요 @Roles#1',
        sender: 'Other',
        tag_number: 2,
        created_at: Date.now(),
      })
    );
    peer.send(JSON.stringify({ type: 'mentions_changed' }));
  }
  await writer.waitForFunction(
    (prev) => window.__soundCues.filter((c) => c === 'mention').length === prev + 1,
    0
  );
  await writer.waitForTimeout(200);
  assert.equal(
    await writer.evaluate(() => window.__soundCues.filter((c) => c === 'mention').length),
    1,
    'live chat mention + mentions_changed deduplicates into a single mention cue'
  );

  // 8) Live object comment mention from another user emits mention cue.
  for (const peer of canvasPeers) {
    peer.send(
      JSON.stringify({
        type: 'chat',
        object_id: 'box',
        sequence: 165,
        text: '@Roles#1 객체 댓글 확인!',
        sender: 'Other',
        tag_number: 2,
        created_at: Date.now(),
      })
    );
  }
  await writer.waitForFunction(
    () => window.__soundCues.filter((c) => c === 'mention').length === 2
  );

  const finalCues = await writer.evaluate(() => window.__soundCues);
  assert.deepEqual(finalCues, [
    'voice_join',
    'voice_join',
    'screen_share_start',
    'screen_share_stop',
    'voice_leave',
    'mention',
    'mention',
  ]);
  const observerVoiceCues = await observer.evaluate(() => window.__soundCues.slice(0, 5));
  assert.deepEqual(observerVoiceCues, [
    'voice_join',
    'screen_share_start',
    'screen_share_stop',
    'voice_leave',
    'voice_leave',
  ]);
  assert.deepEqual(await reader.evaluate(() => window.__soundCues), []);
  assert.deepEqual(errors, []);
  console.log('PASS Web Audio sound cues: peer voice_join, screen_share_start/stop, voice_leave (voice-only), mentions, dedup & negative guards');

  await writerContext.close();
  await readerContext.close();
} finally {
  await browser.close();
}
