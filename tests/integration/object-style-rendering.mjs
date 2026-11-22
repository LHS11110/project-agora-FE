// Verifies that every persisted object style setting (style1: envelope + native fields)
// reaches the rendered DOM as intended, for each object kind that exposes the setting.
// Run against a dev server: AGORA_E2E_ORIGIN=https://localhost:5199 node tests/integration/object-style-rendering.mjs
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5199';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});

const now = Math.floor(Date.now() / 1000);
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${b64({ alg: 'HS256' })}.${b64({ exp: now + 3600, sid: 'style-session', tokenUse: 'access' })}.style`;
const user = { user_id: 7, email: 'style@example.invalid', nickname: 'Styler', tag_number: 3, role: 'ROLE_USER', status: 'ACTIVE' };
const env = (envelope) => `style1:${JSON.stringify(envelope)}`;
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const grid = (index) => ({ x: 0.03 + (index % 5) * 0.19, y: 0.05 + Math.floor(index / 5) * 0.23, width: 0.15, height: 0.17 });
const base = (index, extra) => ({ ...grid(index), depth: index + 1, permission: ['default'], ...extra });

const items = {
  // 1. Rectangle shape: every fill type + per-corner radius + inside dashed stroke + all effects + filters.
  rect: base(0, {
    kind: 'shape', shapeType: 'rectangle', fill: '#e2e8f0', color: '#0f172a', strokeWidth: 3, opacity: 0.7,
    brush: env({
      blendMode: 'screen',
      cornerRadius: { linked: false, tl: 30, tr: 4, br: 18, bl: 0 },
      fills: [
        { id: 'a', type: 'linear', angle: 90, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 100 }] },
        { id: 'b', type: 'radial', opacity: 0.5, blendMode: 'multiply', stops: [{ color: '#ffffff', pos: 0 }, { color: '#000000', pos: 100 }] },
        { id: 'c', type: 'solid', color: '#00ff00', visible: false },
      ],
      stroke: { enabled: true, color: '#ff00aa', width: 3, align: 'inside', dashPattern: 'dashed', dash: 9, gap: 5, cap: 'butt', join: 'bevel' },
      effects: [
        { id: 'd', type: 'drop-shadow', color: '#112233', opacity: 0.5, x: 3, y: 6, blur: 10, spread: 2 },
        { id: 'i', type: 'inner-shadow', color: '#ffffff', opacity: 0.4, x: 0, y: 2, blur: 4, spread: 1 },
        { id: 'off', type: 'drop-shadow', enabled: false, color: '#ff0000', opacity: 1, x: 20, y: 20, blur: 0 },
      ],
      filters: { grayscale: 40, brightness: 120 },
    }),
  }),
  // 2. Ellipse: conic fill + outside dotted stroke + background blur.
  ellipse: base(1, {
    kind: 'shape', shapeType: 'ellipse', fill: '#ffffff', color: '#334155', strokeWidth: 2,
    brush: env({
      fills: [{ id: 'a', type: 'conic', angle: 45, stops: [{ color: '#ff0000', pos: 0 }, { color: '#00ff00', pos: 100 }] }],
      stroke: { enabled: true, color: '#123456', width: 4, align: 'outside', dashPattern: 'dotted', gap: 6, cap: 'round', join: 'round' },
      effects: [{ id: 'bb', type: 'background-blur', blur: 8 }],
    }),
  }),
  // 3. Triangle: image fill (tile), inner shadow, background blur, layer blur, custom dash.
  triangle: base(2, {
    kind: 'shape', shapeType: 'triangle', fill: '#ffffff', color: '#334155', strokeWidth: 2,
    brush: env({
      fills: [{ id: 'img', type: 'image', url: pixel, size: 'tile' }],
      stroke: { enabled: true, color: '#00aa00', width: 2, align: 'center', dashPattern: 'custom', dash: 12, gap: 3 },
      effects: [
        { id: 'i', type: 'inner-shadow', color: '#000000', opacity: 0.6, x: 0, y: 3, blur: 6 },
        { id: 'bb', type: 'background-blur', blur: 6 },
        { id: 'lb', type: 'layer-blur', blur: 2 },
      ],
    }),
  }),
  // 4. Rectangle with unlinked per-side stroke widths (solid).
  sides: base(3, {
    kind: 'shape', shapeType: 'rectangle', fill: '#fef3c7', color: '#92400e', strokeWidth: 2,
    brush: env({ stroke: { enabled: true, color: '#92400e', width: 2, align: 'inside', dashPattern: 'solid', sides: { linked: false, top: 6, right: 1, bottom: 3, left: 4 } } }),
  }),
  // 5. Arrow shape: dashed stroke + drop shadow (filter path).
  arrow: base(4, {
    kind: 'shape', shapeType: 'arrow', color: '#7c3aed', strokeWidth: 3, endHead: 'triangle',
    brush: env({
      stroke: { enabled: true, color: '#7c3aed', width: 3, dashPattern: 'dashed', dash: 6, gap: 4, cap: 'square' },
      effects: [{ id: 'd', type: 'drop-shadow', color: '#000000', opacity: 0.3, x: 2, y: 2, blur: 3 }],
    }),
  }),
  // 6. Text: all typography, fills, per-side stroke, background blur, filters, custom CSS.
  text: base(5, {
    kind: 'text', renderMode: 'markdown', color: '#1e293b', fontSize: 18,
    text: '첫 번째 문단입니다.\n\n두 번째 문단입니다.\n\n세 번째 문단입니다.\n\n네 번째 문단입니다.\n\n다섯 번째 문단입니다.\n\n여섯 번째 문단입니다.',
    brush: env({
      cornerRadius: 12,
      fills: [{ id: 'a', type: 'solid', color: '#fde68a', opacity: 0.8 }],
      stroke: { enabled: true, color: '#b45309', width: 2, align: 'inside', dashPattern: 'solid', sides: { linked: false, top: 5, right: 2, bottom: 2, left: 2 } },
      effects: [{ id: 'bb', type: 'background-blur', blur: 5 }],
      filters: { sepia: 30 },
      typography: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, lineHeight: 2, letterSpacing: 3, paragraphSpacing: 20, textAlign: 'right', overflowMode: 'truncate', textColor: '#dc2626' },
      customCss: 'text-transform: uppercase; outline: 2px solid rgb(1, 2, 3); position: fixed; background-image: url(javascript:alert(1))',
    }),
  }),
  // 7. Text with auto-fit overflow: long text must shrink to fit.
  autofit: base(6, {
    kind: 'text', renderMode: 'plain', color: '#111827', fontSize: 28,
    text: Array.from({ length: 14 }, (_, i) => `자동 맞춤 줄 ${i + 1}`).join('\n'),
    brush: env({ typography: { overflowMode: 'auto-fit' } }),
  }),
  // 8. Note: gradient fill + radius (custom note style), typography color.
  note: base(7, {
    kind: 'note', color: '#fef08a', text: '포스트잇 메모',
    brush: env({
      cornerRadius: 20,
      fills: [{ id: 'a', type: 'linear', angle: 180, stops: [{ color: '#fef08a', pos: 0 }, { color: '#fca5a5', pos: 100 }] }],
      typography: { textColor: '#1d4ed8', fontWeight: 800 },
    }),
  }),
  // 9. Code: fills + dashed stroke + typography.
  code: base(8, {
    kind: 'text', renderMode: 'code', language: 'javascript', filename: 'main.js', text: 'const answer = 42;\nconsole.log(answer);',
    brush: env({
      fills: [{ id: 'a', type: 'solid', color: '#0b1020' }],
      stroke: { enabled: true, color: '#22d3ee', width: 2, dashPattern: 'dashed', dash: 5, gap: 3 },
      typography: { letterSpacing: 1, fontWeight: 600 },
    }),
  }),
  // 10. Table: fill + stroke + typography alignment.
  table: base(9, {
    kind: 'table', columns: ['A', 'B'], rows: [['1', '2'], ['3', '4']],
    brush: env({
      fills: [{ id: 'a', type: 'solid', color: '#ecfeff' }],
      stroke: { enabled: true, color: '#0891b2', width: 3 },
      typography: { textAlign: 'center', textColor: '#155e75' },
    }),
  }),
  // 11. Image: radius + stroke + filters + drop shadow.
  image: base(10, {
    kind: 'image', src: pixel, filename: 'pixel.png',
    brush: env({
      cornerRadius: 16,
      stroke: { enabled: true, color: '#ef4444', width: 4 },
      filters: { invert: 100, hueRotate: 90 },
      effects: [{ id: 'd', type: 'drop-shadow', color: '#000000', opacity: 0.4, x: 0, y: 8, blur: 12 }],
    }),
  }),
  // 12. Frame: dashed outline stroke.
  frame: base(11, {
    kind: 'frame', title: '스타일 프레임',
    brush: env({ stroke: { enabled: true, color: '#16a34a', width: 3, dashPattern: 'dashed', dash: 10, gap: 4 } }),
  }),
  // 13. Chart / 14. Value / 15. Question / 16. Link: card fills + strokes + typography.
  chart: base(12, {
    kind: 'chart', chartType: 'bar', title: '차트', columns: ['항목', '값'], rows: [['A', '3'], ['B', '5']],
    brush: env({ fills: [{ id: 'a', type: 'solid', color: '#fdf4ff' }], stroke: { enabled: true, color: '#a21caf', width: 2 }, typography: { fontFamily: 'Georgia, serif' } }),
  }),
  value: base(13, {
    kind: 'value', valueType: 'real', valueNumber: 0.42, valueText: '', title: '값',
    brush: env({ fills: [{ id: 'a', type: 'solid', color: '#f0fdf4' }], stroke: { enabled: true, color: '#15803d', width: 2 } }),
  }),
  link: base(14, {
    kind: 'link', mediaType: 'link', url: 'https://example.com/', title: '링크 카드',
    brush: env({ fills: [{ id: 'a', type: 'solid', color: '#eff6ff' }], stroke: { enabled: true, color: '#1d4ed8', width: 2 }, typography: { fontWeight: 700 } }),
  }),
  // Connector endpoints (plain) and styled connectors.
  endA: base(15, { kind: 'shape', shapeType: 'rectangle', fill: '#f1f5f9', color: '#475569', strokeWidth: 1.5, width: 0.06, height: 0.06 }),
  endB: { ...base(16, { kind: 'shape', shapeType: 'rectangle', fill: '#f1f5f9', color: '#475569', strokeWidth: 1.5 }), x: 0.47, y: 0.86, width: 0.06, height: 0.06 },
  conn: {
    kind: 'connector', from: 'endA', to: 'endB', label: '흐름 라벨', color: '#6366f1', strokeWidth: 2, endHead: 'triangle', opacity: 0.8, depth: 40, permission: ['default'],
    brush: env({
      blendMode: 'multiply',
      stroke: { enabled: true, color: '#f97316', width: 5, dashPattern: 'dashed', dash: 7, gap: 3, cap: 'butt', join: 'miter' },
      connector: { routing: 'orthogonal', dashAnimation: 'reverse', animationSpeed: 2, labelStyle: { background: '#eef2ff', color: '#3730a3', borderColor: '#4338ca', pill: false } },
      typography: { fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: 2, lineHeight: 1.8 },
      filters: { saturate: 150 },
    }),
  },
  // Shape with stroke disabled and effects disabled.
  plainOff: { ...base(17, {
    kind: 'shape', shapeType: 'rectangle', fill: '#ffffff', color: '#000000', strokeWidth: 2,
    brush: env({ stroke: { enabled: false }, effects: [{ id: 'd', type: 'drop-shadow', enabled: false }] }),
  }), x: 0.66, y: 0.74 },
};

const errors = [];
let latest = structuredClone(items);
let revision = 0;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); };

try {
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 }, locale: 'ko-KR', ignoreHTTPSErrors: true });
  await context.addInitScript(({ user }) => {
    sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    localStorage.setItem('agora_user', JSON.stringify(user));
    localStorage.setItem('frelog_canvas_panel_visibility_v1', JSON.stringify({ tools: false, inspector: false, chat: false }));
  }, { user });
  await context.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const path = new URL(route.request().url()).pathname;
    let data = { canvas_id: 999077, canvas_name: '스타일 렌더링 검증' };
    if (path === '/api/auth/session/refresh') data = { tokenType: 'Bearer', accessToken: token, user };
    else if (path === '/api/auth/me') data = user;
    else if (path.endsWith('/access')) data = { ws_port: 8002, canvas_access_token: 'fixture' };
    else if (path.endsWith('/settings')) data = { canvas_name: '스타일 렌더링 검증', settings_revision: revision, visibility: 'private', participants: [], can_manage: true };
    else if (path.endsWith('/link-preview')) data = { title: '링크 카드', description: '', image: '' };
    return route.fulfill({ json: data });
  });
  await context.routeWebSocket(/\/wss\/port\//, (ws) => {
    const rtc = ws.url().includes('/rtc/');
    setTimeout(() => ws.send(JSON.stringify(rtc
      ? { type: 'rtc_ready' }
      : { type: 'init_items', items: latest, groups: ['default'], write_groups: ['default'], is_admin: true, sync_protocol: 2, sync_user_id: 7, revision, accepted_count: 0, rtc_canvas_connection_id: 'fixture', rtc_canvas_connection_hash: 'proof' })), 100);
    ws.onMessage((raw) => {
      const data = JSON.parse(String(raw));
      if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      if (data.type === 'canvas_sync') ws.send(JSON.stringify({ type: 'canvas_snapshot', client_id: data.client_id, items: latest, groups: ['default'], write_groups: ['default'], is_admin: true, sync_protocol: 2, sync_user_id: 7, revision, accepted_count: 0 }));
      if (data.type === 'rtc_join') ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer', peers: [] }));
    });
  });

  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/canvases/999077`);
  await page.waitForFunction(() => Boolean(window.frelogCanvas?.read().items?.rect), null, { timeout: 45000 });
  await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`[data-item-id="${id}"]`)), Object.keys(items).filter((id) => !id.startsWith('end')), { timeout: 30000 });
  await page.waitForTimeout(800);

  const probe = await page.evaluate(() => {
    const q = (id, sel = '') => document.querySelector(`[data-item-id="${id}"]${sel ? ` ${sel}` : ''}`);
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const host = (id) => q(id);
    const out = {};
    // rect
    {
      const el = host('rect');
      const layers = [...el.querySelectorAll('.canvas-object-fill-layer')];
      const surface = el.querySelector('.canvas-shape-advanced-surface');
      const strokePath = el.querySelector('.canvas-shape-svg path[stroke]');
      const inner = [...el.querySelectorAll('.canvas-shape-advanced-surface > div')].find((d) => (d.style.boxShadow || '').includes('inset'));
      out.rect = {
        opacity: cs(el).opacity, blend: cs(el).mixBlendMode,
        layerBgs: layers.map((l) => cs(l).backgroundImage), layer2: layers[1] ? { opacity: cs(layers[1]).opacity, blend: cs(layers[1]).mixBlendMode } : null,
        fillHostRadius: cs(el.querySelector('.canvas-shape-fill-host'))?.borderRadius,
        path: strokePath?.getAttribute('d') || '', dash: strokePath?.getAttribute('stroke-dasharray'), cap: strokePath?.getAttribute('stroke-linecap'), join: strokePath?.getAttribute('stroke-linejoin'),
        strokeColor: strokePath?.getAttribute('stroke'), clip: strokePath?.getAttribute('clip-path'),
        boxShadow: cs(surface)?.boxShadow, filter: cs(surface)?.filter, inner: inner?.style.boxShadow || '',
      };
    }
    {
      const el = host('ellipse');
      const surface = el.querySelector('.canvas-shape-advanced-surface');
      const strokePath = el.querySelector('.canvas-shape-svg path[stroke]');
      out.ellipse = {
        bg: cs(el.querySelector('.canvas-object-fill-layer'))?.backgroundImage,
        mask: strokePath?.getAttribute('mask'), dash: strokePath?.getAttribute('stroke-dasharray'), strokeColor: strokePath?.getAttribute('stroke'),
        backdrop: cs(surface)?.backdropFilter || cs(surface)?.webkitBackdropFilter,
      };
    }
    {
      const el = host('triangle');
      const surface = el.querySelector('.canvas-shape-advanced-surface');
      const layer = el.querySelector('.canvas-object-fill-layer');
      const strokePath = el.querySelector('.canvas-shape-svg path[stroke]');
      const anyInset = [...el.querySelectorAll('*')].some((n) => (n.style?.boxShadow || '').includes('inset') || (n.getAttribute?.('filter') || '').includes('url('));
      const anyBackdrop = [...el.querySelectorAll('*')].some((n) => { const s = getComputedStyle(n); return (s.backdropFilter || s.webkitBackdropFilter || 'none') !== 'none'; });
      out.triangle = {
        bg: cs(layer)?.backgroundImage, repeat: cs(layer)?.backgroundRepeat, dash: strokePath?.getAttribute('stroke-dasharray'),
        filter: cs(surface)?.filter, innerShadowRendered: anyInset, backdropRendered: anyBackdrop,
      };
    }
    {
      const ring = q('sides', '.canvas-object-stroke-ring');
      out.sides = ring ? { t: cs(ring).borderTopWidth, r: cs(ring).borderRightWidth, b: cs(ring).borderBottomWidth, l: cs(ring).borderLeftWidth, color: cs(ring).borderTopColor } : null;
    }
    {
      const el = host('arrow');
      const p = el.querySelector('.canvas-shape-svg path[stroke]');
      out.arrow = { dash: p?.getAttribute('stroke-dasharray'), cap: p?.getAttribute('stroke-linecap'), color: p?.getAttribute('stroke'), filter: cs(el.querySelector('.canvas-shape-advanced-surface'))?.filter };
    }
    {
      const el = host('text');
      const md = el.querySelector('.simple-markdown') || el.querySelector('.unified-plain-preview');
      const paragraphs = [...el.querySelectorAll('.simple-markdown p')];
      const ring = el.querySelector('.canvas-object-stroke-ring');
      const backdrop = el.querySelector('.canvas-object-style-backdrop');
      const fill = el.querySelector('.canvas-object-fill-layer');
      out.text = {
        family: cs(md)?.fontFamily, weight: cs(md)?.fontWeight, lineHeight: cs(md)?.lineHeight, fontSize: cs(md)?.fontSize, letter: cs(md)?.letterSpacing,
        align: cs(md)?.textAlign, color: cs(md)?.color, p2Margin: paragraphs[1] ? cs(paragraphs[1]).marginTop : null,
        truncated: md ? md.scrollHeight > md.clientHeight + 1 : null, clamp: cs(md)?.webkitLineClamp, overflow: cs(md)?.overflow,
        transform: cs(el).textTransform, outline: cs(el).outlineColor + ' ' + cs(el).outlineWidth, position: cs(el).position, bgImage: cs(el).backgroundImage,
        ring: ring ? { t: cs(ring).borderTopWidth, r: cs(ring).borderRightWidth, color: cs(ring).borderTopColor } : null,
        fill: fill ? { bg: cs(fill).backgroundColor, opacity: cs(fill).opacity } : null,
        radius: cs(backdrop)?.borderRadius, backdrop: cs(backdrop)?.backdropFilter || cs(el).backdropFilter, filter: cs(el).filter,
      };
    }
    {
      const el = host('autofit');
      const container = el.querySelector('.unified-content-body');
      const preview = container?.querySelector('.editing-surface-preview');
      out.autofit = { zoom: preview?.style.zoom || '', overflowing: container.scrollHeight > container.clientHeight + 2, scrollH: container.scrollHeight, clientH: container.clientHeight };
    }
    {
      const el = host('note');
      const content = el.querySelector('.sticky-note-content .simple-markdown') || el.querySelector('.sticky-note-content');
      out.note = { custom: el.classList.contains('has-custom-note-style'), bg: cs(el.querySelector('.canvas-object-fill-layer'))?.backgroundImage, clip: cs(el).clipPath, color: cs(content)?.color, weight: cs(content)?.fontWeight, radius: cs(el.querySelector('.canvas-object-style-backdrop'))?.borderRadius };
    }
    {
      const el = host('code');
      const pre = el.querySelector('pre') || el.querySelector('.unified-content-body');
      const dashRect = el.querySelector('.canvas-object-stroke-dash-svg rect');
      out.code = { fill: cs(el.querySelector('.canvas-object-fill-layer'))?.backgroundColor, dash: dashRect?.getAttribute('stroke-dasharray'), dashColor: dashRect?.getAttribute('stroke'), letter: cs(pre)?.letterSpacing, weight: cs(pre)?.fontWeight };
    }
    {
      const el = host('table');
      const td = el.querySelector('td');
      const ring = el.querySelector('.canvas-object-stroke-ring');
      out.table = { fill: cs(el.querySelector('.canvas-object-fill-layer'))?.backgroundColor, ring: ring ? cs(ring).borderTopWidth + ' ' + cs(ring).borderTopColor : null, align: cs(td)?.textAlign, color: cs(td)?.color };
    }
    {
      const el = host('image');
      const img = el.querySelector('img');
      const ring = el.querySelector('.canvas-object-stroke-ring');
      out.image = { filter: cs(el).filter, radius: cs(el.querySelector('.image-object-media') || img)?.borderRadius, ring: ring ? cs(ring).borderTopWidth + ' ' + cs(ring).borderTopColor : null, shadow: cs(el.querySelector('.canvas-object-style-backdrop'))?.boxShadow };
    }
    {
      const rect = q('frame', '.portfolio-frame-outline rect');
      out.frame = rect ? { stroke: cs(rect).stroke, width: cs(rect).strokeWidth, dash: cs(rect).strokeDasharray } : null;
    }
    for (const id of ['chart', 'value', 'link']) {
      const el = host(id);
      const ring = el.querySelector('.canvas-object-stroke-ring');
      out[id] = { fill: cs(el.querySelector('.canvas-object-fill-layer'))?.backgroundColor, ring: ring ? cs(ring).borderTopWidth + ' ' + cs(ring).borderTopColor : null, family: cs(el).fontFamily, weight: cs(el.querySelector('strong') || el)?.fontWeight };
    }
    {
      const el = host('conn');
      const svg = el.querySelector('svg.connector-advanced-svg');
      const stroke = el.querySelector('.connector-visible-stroke');
      const label = el.querySelector('.connector-name-label');
      out.conn = {
        hostOpacity: cs(el).opacity, svgOpacity: svg ? cs(svg).opacity : null, blend: svg ? cs(svg).mixBlendMode : null, flow: svg?.getAttribute('class'), duration: svg?.style.getPropertyValue('--connector-flow-duration'),
        filter: svg ? cs(svg).filter : null, stroke: stroke ? { color: cs(stroke).stroke, width: cs(stroke).strokeWidth, dash: cs(stroke).strokeDasharray, cap: cs(stroke).strokeLinecap, join: cs(stroke).strokeLinejoin } : null,
        segments: (stroke?.getAttribute('d') || '').split('L').length,
        label: label ? { bg: cs(label).backgroundColor, color: cs(label).color, border: cs(label).borderTopColor, radius: cs(label).borderTopLeftRadius, family: cs(label).fontFamily, weight: cs(label).fontWeight, letter: cs(label).letterSpacing, lineHeight: cs(label).lineHeight } : null,
      };
    }
    {
      const el = host('plainOff');
      out.plainOff = { strokePaths: el.querySelectorAll('.canvas-shape-svg path[stroke]').length, boxShadow: cs(el.querySelector('.canvas-shape-advanced-surface'))?.boxShadow, filter: cs(el.querySelector('.canvas-shape-advanced-surface'))?.filter };
    }
    return out;
  });

  const p = probe;
  // Rectangle
  check('rect: object opacity', Math.abs(parseFloat(p.rect.opacity) - 0.7) < 0.01, p.rect.opacity);
  check('rect: blend mode', p.rect.blend === 'screen', p.rect.blend);
  check('rect: linear + radial fill layers, hidden layer skipped', p.rect.layerBgs.length === 2 && p.rect.layerBgs[0].includes('linear-gradient(90deg') && p.rect.layerBgs[1].includes('radial-gradient'), JSON.stringify(p.rect.layerBgs));
  check('rect: fill layer opacity/blend', p.rect.layer2?.opacity === '0.5' && p.rect.layer2?.blend === 'multiply', JSON.stringify(p.rect.layer2));
  check('rect: per-corner radius', p.rect.fillHostRadius === '30px 4px 18px 0px' && p.rect.path.includes('Q '), p.rect.fillHostRadius);
  check('rect: dashed inside stroke', p.rect.dash === '9 5' && p.rect.cap === 'butt' && p.rect.join === 'bevel' && p.rect.strokeColor === '#ff00aa' && /url\(#/.test(p.rect.clip || ''), JSON.stringify(p.rect));
  check('rect: drop shadow (disabled one ignored)', p.rect.boxShadow.includes('rgba(17, 34, 51, 0.5)') && p.rect.boxShadow.includes('3px 6px 16px 2px') && !p.rect.boxShadow.includes('255, 0, 0'), p.rect.boxShadow);
  check('rect: inner shadow', p.rect.inner.includes('inset'), p.rect.inner);
  check('rect: filters', p.rect.filter.includes('grayscale(0.4)') && p.rect.filter.includes('brightness(1.2)'), p.rect.filter);
  // Ellipse
  check('ellipse: conic fill', (p.ellipse.bg || '').includes('conic-gradient(from 45deg'), p.ellipse.bg);
  check('ellipse: outside dotted stroke', /url\(#/.test(p.ellipse.mask || '') && p.ellipse.dash === '4 6' && p.ellipse.strokeColor === '#123456', JSON.stringify(p.ellipse));
  check('ellipse: background blur', (p.ellipse.backdrop || '').includes('blur(8px)'), p.ellipse.backdrop);
  // Triangle
  check('triangle: image fill tiled', (p.triangle.bg || '').includes('url(') && p.triangle.repeat === 'repeat', `${p.triangle.bg} ${p.triangle.repeat}`);
  check('triangle: custom dash', p.triangle.dash === '12 3', p.triangle.dash);
  check('triangle: layer blur', (p.triangle.filter || '').includes('blur(2px)'), p.triangle.filter);
  check('triangle: inner shadow rendered', p.triangle.innerShadowRendered);
  check('triangle: background blur rendered', p.triangle.backdropRendered);
  // Sides
  check('rect sides: per-side widths', p.sides && p.sides.t === '6px' && p.sides.r === '1px' && p.sides.b === '3px' && p.sides.l === '4px', JSON.stringify(p.sides));
  // Arrow
  check('arrow: dashed stroke + cap', p.arrow.dash === '6 4' && p.arrow.cap === 'square' && p.arrow.color === '#7c3aed', JSON.stringify(p.arrow));
  check('arrow: drop shadow filter', (p.arrow.filter || '').includes('drop-shadow'), p.arrow.filter);
  // Text
  check('text: font family', (p.text.family || '').includes('JetBrains Mono'), p.text.family);
  check('text: font weight', p.text.weight === '700', p.text.weight);
  check('text: line height x2', Math.abs(parseFloat(p.text.lineHeight) / parseFloat(p.text.fontSize) - 2) < 0.05, `${p.text.lineHeight} / ${p.text.fontSize}`);
  check('text: letter spacing', p.text.letter === '3px', p.text.letter);
  check('text: paragraph spacing', p.text.p2Margin === '20px', p.text.p2Margin);
  check('text: text align', p.text.align === 'right', p.text.align);
  check('text: text color', p.text.color === 'rgb(220, 38, 38)', p.text.color);
  check('text: truncate overflow', p.text.overflow === 'hidden' && p.text.truncated === true, JSON.stringify({ overflow: p.text.overflow, truncated: p.text.truncated, clamp: p.text.clamp }));
  check('text: custom CSS allowed props', p.text.transform === 'uppercase' && p.text.outline.startsWith('rgb(1, 2, 3)'), `${p.text.transform} ${p.text.outline}`);
  check('text: custom CSS rejects disallowed props', p.text.position !== 'fixed' && !p.text.bgImage.includes('javascript'), `${p.text.position} ${p.text.bgImage}`);
  check('text: per-side stroke ring', p.text.ring && p.text.ring.t === '5px' && p.text.ring.r === '2px' && p.text.ring.color === 'rgb(180, 83, 9)', JSON.stringify(p.text.ring));
  check('text: solid fill with opacity', p.text.fill && p.text.fill.bg === 'rgb(253, 230, 138)' && p.text.fill.opacity === '0.8', JSON.stringify(p.text.fill));
  check('text: uniform radius', p.text.radius === '12px', p.text.radius);
  check('text: background blur', (p.text.backdrop || '').includes('blur(5px)'), p.text.backdrop);
  check('text: filters', (p.text.filter || '').includes('sepia(0.3)'), p.text.filter);
  check('autofit: long text shrinks to fit', !p.autofit.overflowing && parseFloat(p.autofit.zoom) < 1, JSON.stringify(p.autofit));
  // Note
  check('note: custom note style', p.note.custom && /linear-gradient\((180deg, )?rgb\(254, 240, 138\)/.test(p.note.bg || '') && p.note.radius === '20px', JSON.stringify(p.note));
  check('note: typography color/weight', p.note.color === 'rgb(29, 78, 216)' && p.note.weight === '800', `${p.note.color} ${p.note.weight}`);
  // Code
  check('code: fill', p.code.fill === 'rgb(11, 16, 32)', p.code.fill);
  check('code: dashed stroke', p.code.dash === '5 3' && p.code.dashColor === '#22d3ee', `${p.code.dash} ${p.code.dashColor}`);
  check('code: typography', p.code.letter === '1px' && p.code.weight === '600', `${p.code.letter} ${p.code.weight}`);
  // Table
  check('table: fill', p.table.fill === 'rgb(236, 254, 255)', p.table.fill);
  check('table: stroke', p.table.ring === '3px rgb(8, 145, 178)', p.table.ring);
  check('table: typography align/color', p.table.align === 'center' && p.table.color === 'rgb(21, 94, 117)', `${p.table.align} ${p.table.color}`);
  // Image
  check('image: filters', (p.image.filter || '').includes('invert(1)') && (p.image.filter || '').includes('hue-rotate(90deg)'), p.image.filter);
  check('image: radius', p.image.radius === '16px', p.image.radius);
  check('image: stroke', p.image.ring === '4px rgb(239, 68, 68)', p.image.ring);
  check('image: drop shadow', (p.image.shadow || '').includes('rgba(0, 0, 0, 0.4)'), p.image.shadow);
  // Frame
  check('frame: dashed outline', p.frame && p.frame.stroke === 'rgb(22, 163, 74)' && p.frame.width === '3px' && p.frame.dash.replace(/px/g, '').replace(/,/g, '') === '10 4', JSON.stringify(p.frame));
  // Cards
  check('chart: fill + stroke + font family', p.chart.fill === 'rgb(253, 244, 255)' && p.chart.ring === '2px rgb(162, 28, 175)' && p.chart.family.includes('Georgia'), JSON.stringify(p.chart));
  check('value: fill + stroke', p.value.fill === 'rgb(240, 253, 244)' && p.value.ring === '2px rgb(21, 128, 61)', JSON.stringify(p.value));
  check('link: fill + stroke + weight', p.link.fill === 'rgb(239, 246, 255)' && p.link.ring === '2px rgb(29, 78, 216)' && p.link.weight === '700', JSON.stringify(p.link));
  // Connector
  check('connector: opacity', Math.abs(parseFloat(p.conn.svgOpacity) * parseFloat(p.conn.hostOpacity) - 0.8) < 0.01, `${p.conn.hostOpacity} x ${p.conn.svgOpacity}`);
  check('connector: blend mode', p.conn.blend === 'multiply', p.conn.blend);
  check('connector: reverse flow at 2x speed', (p.conn.flow || '').includes('connector-flow-reverse') && p.conn.duration === '0.60s', `${p.conn.flow} ${p.conn.duration}`);
  check('connector: stroke color/width/dash/cap/join', p.conn.stroke && p.conn.stroke.color === 'rgb(249, 115, 22)' && p.conn.stroke.width === '5px' && p.conn.stroke.dash.replace(/px/g, '').replace(/,/g, '') === '7 3' && p.conn.stroke.cap === 'butt' && p.conn.stroke.join === 'miter', JSON.stringify(p.conn.stroke));
  check('connector: orthogonal routing', p.conn.segments >= 3, String(p.conn.segments));
  check('connector: filters', (p.conn.filter || '').includes('saturate(1.5)'), p.conn.filter);
  check('connector: label style', p.conn.label && p.conn.label.bg === 'rgb(238, 242, 255)' && p.conn.label.color === 'rgb(55, 48, 163)' && p.conn.label.border === 'rgb(67, 56, 202)' && p.conn.label.radius === '4px', JSON.stringify(p.conn.label));
  check('connector: label typography', p.conn.label && p.conn.label.family.includes('Georgia') && p.conn.label.weight === '700' && p.conn.label.letter === '2px', JSON.stringify(p.conn.label));
  // Disabled
  check('disabled stroke/effects render nothing', p.plainOff.strokePaths === 0 && (p.plainOff.boxShadow === 'none' || !p.plainOff.boxShadow) && (p.plainOff.filter === 'none' || !p.plainOff.filter), JSON.stringify(p.plainOff));

  check('no page errors', errors.length === 0, errors.join(' | '));
  if (process.env.STYLE_SCREENSHOT) await page.screenshot({ path: process.env.STYLE_SCREENSHOT });
  if (process.env.STYLE_DEBUG) console.log(JSON.stringify(await page.evaluate(process.env.STYLE_DEBUG), null, 1));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok ? '' : ` -> ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} style checks passed`);
assert.equal(failed.length, 0, `${failed.length} style checks failed`);
