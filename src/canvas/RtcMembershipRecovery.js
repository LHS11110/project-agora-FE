// Membership may change while a relay is already in flight. Reconcile the
// authenticated room on the existing socket; pending host operations retain ACKs.
export class RtcMembershipRecovery {
  constructor(send, { now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    Object.assign(this, { send, now, setTimer, clearTimer });
    this.lastRequest = -Infinity; this.timer = null; this.disposed = false;
  }
  handle(event, currentTerm) {
    if (this.disposed || event?.type !== 'error' || !['HOST_FENCED', 'CANVAS_RELAY_TARGET_INVALID'].includes(event.code)) return false;
    // The authoritative membership already superseded the rejected old frame.
    if (typeof event.relay_term === 'string' && event.relay_term !== currentTerm) return true;
    this.refresh();
    return true;
  }
  refresh() {
    if (this.disposed || this.timer !== null) return;
    const delay = Math.max(0, this.lastRequest + 250 - this.now());
    if (delay > 0) { this.retry(delay); return; }
    if (this.send({ type: 'rtc_list' })) this.lastRequest = this.now();
    else this.retry(100); // A full send budget must not lose the recovery request.
  }
  retry(delay) {
    this.timer = this.setTimer(() => { this.timer = null; this.refresh(); }, delay);
  }
  dispose() { this.disposed = true; if (this.timer !== null) this.clearTimer(this.timer); this.timer = null; }
}
