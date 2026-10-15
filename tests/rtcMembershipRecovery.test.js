import test from 'node:test';
import assert from 'node:assert/strict';
import { RtcMembershipRecovery } from '../src/canvas/RtcMembershipRecovery.js';
function fixture(send) {
  let now = 0, serial = 0;
  const timers = new Map(), sent = [];
  const recovery = new RtcMembershipRecovery(event => { sent.push(event); return send?.() ?? true; }, {
    now: () => now,
    setTimer: (fn, delay) => { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimer: id => timers.delete(id),
  });
  const advance = value => { now += value; for (const [id, entry] of [...timers]) if (entry.at <= now) { timers.delete(id); entry.fn(); } };
  return { recovery, timers, sent, advance };
}
test('departed targets refresh membership on the current socket without reconnecting or losing budget-blocked recovery', () => {
  let blocked = true;
  const f = fixture(() => !blocked), event = { type: 'error', code: 'CANVAS_RELAY_TARGET_INVALID' };
  assert.equal(f.recovery.handle(event, 'current'), true);
  for (let i = 0; i < 20; i++) f.recovery.handle(event, 'current');
  assert.equal(f.sent.length, 1); assert.equal(f.timers.size, 1);
  blocked = false; f.advance(100);
  assert.deepEqual(f.sent, [{ type: 'rtc_list' }, { type: 'rtc_list' }]);
  for (let i = 0; i < 20; i++) f.recovery.handle(event, 'current');
  f.advance(249); assert.equal(f.sent.length, 2);
  f.advance(1); assert.equal(f.sent.length, 3);
  f.recovery.handle(event, 'current'); f.recovery.dispose(); f.advance(500);
  assert.equal(f.sent.length, 3); assert.equal(f.timers.size, 0);
});
test('old-term rejections cannot reset a newly synchronized host; real access and protocol errors remain visible', () => {
  const f = fixture();
  assert.equal(f.recovery.handle({ type: 'error', code: 'HOST_FENCED', relay_term: 'old' }, 'new'), true);
  assert.equal(f.sent.length, 0);
  assert.equal(f.recovery.handle({ type: 'error', code: 'HOST_FENCED', relay_term: 'new' }, 'new'), true);
  assert.deepEqual(f.sent, [{ type: 'rtc_list' }]);
  for (const code of ['ITEM_ACCESS_DENIED', 'CANVAS_RELAY_TYPE_INVALID', 'CANVAS_RELAY_TOO_LARGE', 'RATE_LIMITED']) assert.equal(f.recovery.handle({ type: 'error', code }, 'new'), false);
  assert.equal(f.recovery.handle({ type: 'host_batch_result', code: 'HOST_FENCED' }, 'new'), false, 'persistence rejection retains its existing fencing handler');
});
