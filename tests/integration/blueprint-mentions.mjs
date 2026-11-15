import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { applyTextDelta } from '../../src/canvas/sync/itemDelta.js';
import { mentionsUser } from '../../src/canvas/comments/mentions.js';

const liveMode = Boolean(process.env.AGORA_E2E_STATE);
const createToken = sub => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600, sub })).toString('base64url')}.fixture`;
const state = liveMode
    ? JSON.parse(await fs.readFile(process.env.AGORA_E2E_STATE, 'utf8'))
    : {
        complete_id: '999004',
        sessions: [
            { token: createToken(101), user: { user_id: 101, email: 'owner@example.invalid', nickname: 'Owner', tag_number: 1, role: 'ROLE_USER', status: 'ACTIVE' } },
            { token: createToken(102), user: { user_id: 102, email: 'peer@example.invalid', nickname: 'Peer', tag_number: 2, role: 'ROLE_USER', status: 'ACTIVE' } },
        ],
    };
const origin = process.env.AGORA_E2E_ORIGIN || (liveMode ? 'https://localhost' : 'https://localhost:8444');
const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const resolverArgs = process.env.AGORA_E2E_HOST_RESOLVER
    ? ['--host-resolver-rules=' + process.env.AGORA_E2E_HOST_RESOLVER]
    : liveMode ? ['--host-resolver-rules=MAP 118.34.144.201 127.0.0.1'] : [];
const browser = await chromium.launch({ executablePath: process.env.AGORA_E2E_CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', ...resolverArgs, '--disable-features=LocalNetworkAccessChecks', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const pages = [];
function createMockBroker(users) {
    let revision = 0, generalSeq = 0, mentionSeq = 0;
    const latest = {}, receipts = new Map(), sockets = new Set(), generalMessages = [], commentThreads = new Map(), commentSeqs = new Map(), mentions = [], vmFiles = new Map();
    const policies = { default: { read: true, write: true, execute: true } };
    const cloneItems = () => structuredClone(latest);
    const broadcast = payload => { const raw = JSON.stringify(payload); for (const entry of sockets) entry.ws.send(raw); };
    const settingsFor = user => ({ canvas_id: Number(state.complete_id), canvas_name: 'Blueprint & Mentions Fixture', settings_revision: 0, visibility: 'private', participants: users, group_permissions: policies, can_manage: user.user_id === users[0].user_id });
    const executeRuntime = data => {
        const code = String(data.code || ''), lang = String(data.language || '');
        if (lang === 'python') {
            const writeRe = /open\(\s*["']([^"']+)["']\s*,\s*["']w["']\s*\)\.write\(\s*["']([^"']*)["']\s*\)/g;
            for (const m of code.matchAll(writeRe)) vmFiles.set(m[1], m[2]);
            const prints = [...code.matchAll(/print\(\s*["']([^"']*)["']\s*\)/g)].map(m => m[1]);
            return { exitCode: 0, output: prints.map(line => line + '\n').join('') };
        }
        if (lang === 'javascript') {
            const m = code.match(/console\.log\(\s*["']([^"']*)["']\s*,\s*require\(\s*["']fs["']\s*\)\.readFileSync\(\s*["']([^"']+)["']\s*,\s*["']utf8["']\s*\)\s*\)/);
            if (m) return { exitCode: 0, output: `${m[1]} ${vmFiles.get(m[2]) ?? ''}\n` };
        }
        return { exitCode: 0, output: '' };
    };
    return async function attach(context, auth) {
        const me = auth.user;
        await context.route(url => url.pathname.startsWith('/api/'), r => {
            const path = new URL(r.request().url()).pathname;
            if (path === '/api/auth/me') return r.fulfill({ json: me });
            if (path.endsWith('/access')) return r.fulfill({ json: { ws_port: 8002, canvas_access_token: 'fixture' } });
            if (path.endsWith('/settings')) return r.fulfill({ json: settingsFor(me) });
            return r.fulfill({ json: { canvas_id: Number(state.complete_id), canvas_name: 'Blueprint & Mentions Fixture' } });
        });
        await context.routeWebSocket(/\/wss\/port\//, ws => {
            const rtc = ws.url().includes('/rtc/');
            const clientId = new URL(ws.url()).searchParams.get('client_id') || '';
            const socketEntry = { ws, user: me, clientId };
            if (!rtc) { sockets.add(socketEntry); ws.onClose(() => sockets.delete(socketEntry)); }
            setTimeout(() => ws.send(JSON.stringify(rtc ? { type: 'rtc_ready' } : { type: 'init_items', items: cloneItems(), groups: ['default'], write_groups: ['default'], execute_groups: ['default'], is_admin: me.user_id === users[0].user_id, sync_protocol: 2, sync_user_id: me.user_id, revision, accepted_count: receipts.get(clientId) || 0, rtc_canvas_connection_id: 'fixture', rtc_canvas_connection_hash: 'proof' })), 50);
            ws.onMessage(raw => {
                const d = JSON.parse(String(raw));
                if (d.type === 'ping') { ws.send(JSON.stringify({ type: 'pong', canvas_id: Number(state.complete_id), timestamp: Date.now() })); return; }
                if (d.type === 'rtc_join') { ws.send(JSON.stringify({ type: 'rtc_peers', self_peer_id: 'peer-' + clientId, peers: [] })); return; }
                if (d.type === 'canvas_settings_get') { ws.send(JSON.stringify({ type: 'canvas_settings_snapshot', settings: settingsFor(me) })); return; }
                if (d.type === 'canvas_sync') { ws.send(JSON.stringify({ type: 'canvas_snapshot', client_id: d.client_id, items: cloneItems(), groups: ['default'], write_groups: ['default'], execute_groups: ['default'], is_admin: me.user_id === users[0].user_id, sync_protocol: 2, sync_user_id: me.user_id, revision, accepted_count: receipts.get(d.client_id) || 0 })); return; }
                if (d.type === 'canvas_ops') {
                    if ((receipts.get(d.client_id) || 0) >= d.request_count) { ws.send(JSON.stringify({ type: 'canvas_result', request_id: d.request_id, ok: true, duplicate: true, server_revision: revision })); return; }
                    receipts.set(d.client_id, d.request_count);
                    const touched = {}, deleted = [];
                    for (const op of d.operations) {
                        if (op.action === 'delete') { delete latest[op.id]; deleted.push(op.id); continue; }
                        if (op.action === 'translate') { for (const id of op.ids) { if (!latest[id]) continue; latest[id] = { ...latest[id], x: latest[id].x + op.dx, y: latest[id].y + op.dy }; touched[id] = structuredClone(latest[id]); } continue; }
                        const next = { ...(latest[op.id] || {}), ...op.patch };
                        if (op.text_edits) for (const [field, edit] of Object.entries(op.text_edits)) next[field] = applyTextDelta(String(latest[op.id]?.[field] || ''), edit);
                        for (const field of op.unset || []) delete next[field];
                        latest[op.id] = next; touched[op.id] = structuredClone(next);
                    }
                    revision++;
                    broadcast({ type: 'canvas_commit', client_id: d.client_id, author_id: me.user_id, request_count: d.request_count, revision, items: { ...touched, ...Object.fromEntries(deleted.map(id => [id, null])) } });
                    return;
                }
                if (d.type === 'chat') {
                    const objectId = d.object_id ? String(d.object_id) : null;
                    const list = objectId ? (commentThreads.get(objectId) || []) : generalMessages;
                    if (objectId && !commentThreads.has(objectId)) commentThreads.set(objectId, list);
                    const sequence = objectId ? (commentSeqs.get(objectId) || 0) + 1 : ++generalSeq;
                    if (objectId) commentSeqs.set(objectId, sequence);
                    const entry = { room_id: 'general', ...(objectId ? { object_id: objectId } : {}), sequence, text: String(d.text || ''), sender: me.nickname, tag_number: me.tag_number, created_at: Date.now() };
                    list.push(entry);
                    let createdMention = false;
                    for (const participant of users) {
                        if (participant.user_id !== me.user_id && mentionsUser(entry.text, participant)) {
                            mentions.push({ mention_id: `m-${++mentionSeq}`, user_id: participant.user_id, unread: true, ...entry });
                            createdMention = true;
                        }
                    }
                    ws.send(JSON.stringify({ type: 'event_ack', request_id: d.request_id, ok: true, sequence }));
                    broadcast({ type: 'chat', ...entry });
                    if (createdMention) broadcast({ type: 'mentions_changed' });
                    return;
                }
                if (d.type === 'chat_history') {
                    const objectId = d.object_id ? String(d.object_id) : null;
                    const list = objectId ? (commentThreads.get(objectId) || []) : generalMessages;
                    let slice;
                    if (d.from_sequence != null && d.to_sequence != null) slice = list.filter(m => m.sequence >= d.from_sequence && m.sequence <= d.to_sequence);
                    else {
                        const eligible = d.to_sequence != null ? list.filter(m => m.sequence <= d.to_sequence) : list;
                        slice = eligible.slice(-Math.max(1, Number(d.limit) || 50));
                    }
                    const firstSeq = slice[0]?.sequence || 0, hasMore = list.length > 0 && firstSeq > list[0].sequence;
                    ws.send(JSON.stringify({ type: 'chat_history', request_id: d.request_id, room_id: 'general', ...(objectId ? { object_id: objectId } : {}), total: list.length, messages: slice, has_more: hasMore, next_to_sequence: hasMore ? firstSeq - 1 : 0 }));
                    return;
                }
                if (d.type === 'mentions_get') {
                    ws.send(JSON.stringify({ type: 'mentions_snapshot', request_id: d.request_id, notifications: mentions.filter(m => m.user_id === me.user_id && m.unread) }));
                    return;
                }
                if (d.type === 'mention_read') {
                    const note = mentions.find(m => m.mention_id === d.mention_id && m.user_id === me.user_id);
                    if (!note) { ws.send(JSON.stringify({ type: 'error', request_id: d.request_id, code: 'MENTION_NOT_FOUND', message: 'MENTION_NOT_FOUND' })); return; }
                    note.unread = false;
                    ws.send(JSON.stringify({ type: 'mention_read', request_id: d.request_id, mention_id: d.mention_id }));
                    broadcast({ type: 'mentions_changed' });
                    return;
                }
                if (d.type === 'runtime_execute') {
                    ws.send(JSON.stringify({ type: 'runtime_result', request_id: d.request_id, ok: true, result: executeRuntime(d) }));
                }
            });
        });
    };
}
const attachMock = liveMode ? null : createMockBroker(state.sessions.map(s => s.user));
async function ready(page) { await page.waitForFunction(() => window.frelogCanvas && window.testSocket?.readyState === 1 && document.querySelector('.connection-pill.connected') && !document.querySelector('.canvas-loading-status.is-overlay'), null, { timeout: 60000 }) }
async function open(auth) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 2200, height: 1400 }, locale: 'ko-KR' });
    if (attachMock) await attachMock(context, auth);
    await context.addInitScript(({ token, user }) => {
        localStorage.setItem('agora_token', token); localStorage.setItem('agora_user', JSON.stringify(user)); localStorage.setItem('frelog_locale', 'ko');
        const send = WebSocket.prototype.send; const registered = new WeakSet();
        WebSocket.prototype.send = function (data) { try { const x = JSON.parse(data); if (x.type === 'canvas_settings_get') { window.testSocket = this; window.testInbox ||= []; if (!registered.has(this)) { registered.add(this); const record = raw => { try { window.testInbox.push(typeof raw === 'string' ? JSON.parse(raw) : raw) } catch { } }; const prev = this.onmessage; if (typeof prev === 'function') this.onmessage = function (event) { record(event.data); return prev.call(this, event); }; else this.addEventListener('message', event => record(event.data)); } } } catch { } return send.call(this, data) };
    }, auth);
    const page = await context.newPage(); pages.push(page); page.on('pageerror', e => console.error('PAGE ERROR', e.message));
    await page.goto(`${origin}/canvases/${state.complete_id}`); await ready(page); return { page, context };
}
async function request(page, event, type) {
    const id = 'e2e-' + crypto.randomUUID(); await page.evaluate(({ event, id }) => window.testSocket.send(JSON.stringify({ ...event, request_id: id })), { event, id });
    const handle = await page.waitForFunction(({ id, type }) => window.testInbox.find(e => e.request_id === id && (e.type === type || e.type === 'error')), { id, type }, { timeout: 30000 });
    const result = await handle.jsonValue(); if (result.type === 'error') throw new Error('Server request failed: ' + JSON.stringify(result)); return result;
}
async function apply(page, items, remove = []) { await page.evaluate(({ items, remove }) => window.frelogCanvas.apply(window.frelogCanvas.plan({ version: 1, mode: 'merge', items, remove })), { items, remove }) }
try {
    const { page: a } = await open(state.sessions[0]); console.log('Owner connected');
    await apply(a, { 'comment-target': { kind: 'shape', shapeType: 'rectangle', x: 700, y: 300, width: 240, height: 140, permission: 'default' } });
    await a.waitForFunction(() => window.testInbox.some(e => e.type === 'canvas_commit' && e.items?.['comment-target']), null, { timeout: 30000 });
    await a.getByRole('button', { name: '객체 댓글', exact: true }).click();
    const panel = a.getByRole('complementary', { name: '객체 댓글', exact: true });
    const token = `@${state.sessions[1].user.nickname}#${state.sessions[1].user.tag_number}`;
    const input = panel.getByLabel('객체 댓글 입력'); await input.fill('@'); await panel.getByRole('option', { name: token, exact: true }).click(); await a.keyboard.insertText('offline comment'); await panel.getByRole('button', { name: '전송', exact: true }).click();
    await a.waitForFunction(() => window.testInbox.some(e => e.type === 'chat' && e.object_id === 'comment-target' && e.text.includes('offline comment')), null, { timeout: 30000 });
    await request(a, { type: 'chat', room_id: 'general', text: token + ' offline chat' }, 'event_ack');
    for (let index = 0; index < 55; index++)await request(a, { type: 'chat', room_id: 'general', text: 'filler ' + index }, 'event_ack');
    const ownerMentions = await request(a, { type: 'mentions_get', user_id: state.sessions[1].user.user_id }, 'mentions_snapshot'); assert.equal(ownerMentions.notifications.length, 0);
    console.log('Mentions stored while recipient was offline; identity spoofing rejected');
    const { page: b, context: bc } = await open(state.sessions[1]); const { page: b2, context: b2c } = await open(state.sessions[1]);
    for (const page of [b, b2]) await page.getByLabel('멘션 알림', { exact: true }).getByRole('button', { name: /offline comment/ }).waitFor({ timeout: 30000 });
    const notes = await request(b, { type: 'mentions_get' }, 'mentions_snapshot'); assert.equal(notes.notifications.length, 2);
    await assert.rejects(request(a, { type: 'mention_read', mention_id: notes.notifications[0].mention_id, user_id: state.sessions[1].user.user_id }, 'mention_read'), /MENTION_NOT_FOUND/);
    await b.getByLabel('멘션 알림', { exact: true }).getByRole('button', { name: /offline comment/ }).click();
    await b.getByRole('complementary', { name: '객체 댓글', exact: true }).getByText(/offline comment/).waitFor({ timeout: 30000 });
    await b.waitForFunction(() => !document.querySelector('.mention-notifications')?.textContent.includes('offline comment'), null, { timeout: 30000 });
    await b2.waitForFunction(() => !document.querySelector('.mention-notifications')?.textContent.includes('offline comment'), null, { timeout: 30000 });
    await b.getByLabel('멘션 알림', { exact: true }).getByRole('button', { name: /offline chat/ }).click();
    await b.locator('.chat-entry.mention-target').getByText(/offline chat/).waitFor({ timeout: 30000 });
    await b.waitForFunction(() => !document.querySelector('.mention-notifications'), null, { timeout: 30000 });
    await b2.waitForFunction(() => !document.querySelector('.mention-notifications'), null, { timeout: 30000 });
    await b.reload(); await ready(b); const read = await request(b, { type: 'mentions_get' }, 'mentions_snapshot'); assert.equal(read.notifications.length, 0);
    console.log('Offline delivery, old-message navigation, per-user read acknowledgement and cross-browser synchronization passed');
    await panel.getByRole('button', { name: '댓글 닫기' }).click();
    const items = {
        'bp-run': { kind: 'shape', shapeType: 'rectangle', runtimeRole: 'executor', x: 50, y: 180, width: 340, height: 180, permission: 'default' },
        'bp-python': { kind: 'text', renderMode: 'code', language: 'python', filename: 'first.py', text: 'print("BLUEPRINT FIRST")\nopen("blueprint-shared.txt","w").write("shared")', x: 480, y: 180, width: 440, height: 220, permission: 'default' },
        'bp-js': { kind: 'text', renderMode: 'code', language: 'javascript', filename: 'second.js', text: 'console.log("BLUEPRINT SECOND",require("fs").readFileSync("blueprint-shared.txt","utf8"))', x: 480, y: 510, width: 440, height: 200, permission: 'default' },
        'bp-out': { kind: 'shape', shapeType: 'rectangle', runtimeRole: 'output', x: 1040, y: 180, width: 440, height: 260, permission: 'default' },
        'bp-mirror': { kind: 'shape', shapeType: 'rectangle', runtimeRole: 'output', x: 1040, y: 540, width: 440, height: 260, permission: 'default' },
        'bp-disconnected': { kind: 'shape', shapeType: 'rectangle', runtimeRole: 'output', x: 50, y: 560, width: 330, height: 230, permission: 'default' },
        'bp-edge1': { kind: 'connector', from: 'bp-run', to: 'bp-python', permission: 'default' },
        'bp-edge2': { kind: 'connector', from: 'bp-python', to: 'bp-js', permission: 'default' },
        'bp-edge3': { kind: 'connector', from: 'bp-python', to: 'bp-out', permission: 'default' },
        'bp-edge4': { kind: 'connector', from: 'bp-js', to: 'bp-out', permission: 'default' },
        'bp-edge5': { kind: 'connector', from: 'bp-out', to: 'bp-mirror', permission: 'default' }
    };
    await apply(a, items);
    await b.waitForFunction(() => window.frelogCanvas.read().items['bp-run']?.runtimeRole === 'executor', null, { timeout: 30000 });
    const node = (page, id) => page.locator(`.canvas-object[data-item-id="${id}"]`);
    assert.equal(await node(a, 'bp-python').getByRole('button', { name: '실행', exact: true }).count(), 0);
    assert.equal(await node(a, 'bp-out').locator('.blueprint-results').count(), 0);
    await node(a, 'bp-run').getByRole('button', { name: '코드 실행', exact: true }).click();
    for (const page of [a, b, b2]) for (const id of ['bp-out', 'bp-mirror']) {
        await node(page, id).getByText('BLUEPRINT FIRST', { exact: true }).waitFor({ timeout: 60000 });
        await node(page, id).getByText('BLUEPRINT SECOND shared', { exact: true }).waitFor({ timeout: 60000 });
    }
    assert.equal(await node(a, 'bp-disconnected').locator('.blueprint-results').count(), 0);
    await node(a, 'bp-run').getByText('실행 완료', { exact: true }).waitFor({ timeout: 30000 });
    console.log('Execution node, ordered multi-language execution, chained result nodes and shared persisted results passed');
    await b.reload(); await ready(b); await node(b, 'bp-mirror').getByText('BLUEPRINT SECOND shared', { exact: true }).waitFor({ timeout: 30000 });
    await node(a, 'bp-python').locator('.syntax-code-preview').dblclick(); const editor = node(a, 'bp-python').locator('.monaco-editor textarea.inputarea').first(); await editor.waitFor({ timeout: 30000 }); await editor.focus(); await a.keyboard.press('Control+A'); await a.keyboard.insertText('print("BLUEPRINT EDITED")\nopen("blueprint-shared.txt","w").write("shared")');
    await a.waitForFunction(() => window.frelogCanvas.read().items['bp-python'].text.includes('BLUEPRINT EDITED'), null, { timeout: 10000 });
    assert.equal(await node(a, 'bp-out').getByText('BLUEPRINT FIRST', { exact: true }).count(), 1);
    await node(a, 'bp-run').getByRole('button', { name: '코드 실행', exact: true }).click(); await node(b, 'bp-mirror').getByText('BLUEPRINT EDITED', { exact: true }).waitFor({ timeout: 45000 }); await node(a, 'bp-run').getByText('실행 완료', { exact: true }).waitFor({ timeout: 30000 }); assert.equal(await node(b, 'bp-mirror').getByText('BLUEPRINT SECOND shared', { exact: true }).count(), 1);
    await apply(a, { 'bp-cycle': { kind: 'connector', from: 'bp-mirror', to: 'bp-out', permission: 'default' } });
    await node(a, 'bp-run').getByRole('button', { name: '코드 실행', exact: true }).click(); await node(a, 'bp-run').getByRole('alert').getByText('블루프린트에 순환 연결이 있습니다.').waitFor({ timeout: 10000 });
    await apply(a, {}, ['bp-cycle']);
    console.log('Reload persistence, live code editing, explicit rerun and cycle rejection passed');
    await bc.close(); await b2c.close();
    console.log('ALL END-TO-END CHECKS PASSED');
} catch (error) { for (let i = 0; i < pages.length; i++) { if (!pages[i].isClosed()) await pages[i].screenshot({ path: `/tmp/agora-completion-failure-${i}.png` }).catch(() => { }); } throw error }
finally { await browser.close() }
