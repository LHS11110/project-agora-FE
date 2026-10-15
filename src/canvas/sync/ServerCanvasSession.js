import { itemSnapshot, changeItems } from '../itemSnapshots.js';
import { operationIds, translateItem } from '../host/hostOperations.js';
import { createId } from '../canvasIds.js';

// One ordered, retryable mutation in flight. The durable server receipt and
// snapshot counter distinguish a lost acknowledgement from an unsaved edit.
export class ServerCanvasSession {
  constructor(options) {
    Object.assign(this, options);
    this.clientId = createId(); this.items = itemSnapshot({}); this.revision = 0;
    this.count = 0; this.queue = []; this.flight = null; this.ready = false;
    this.seeded = false; this.syncAt = 0; this.sentAt = 0; this.nextAt = 0;
    this.queuedBytes = 0;
  }
  get editable() { return this.seeded && !this.blocked; }
  get pendingOperations() { return [...(this.flight?.operations || []), ...this.queue]; }
  notify() {
    this.status({ ready: this.ready, editable: this.editable, queued: this.pendingOperations.length,
      blocked: Boolean(this.blocked), message: this.blocked || '서버에서 최신 캔버스를 불러오고 있습니다.' });
  }
  redraw(touched = []) { this.publish(this.items, touched); this.notify(); }
  seed(items, data = {}) {
    if (data.sync_protocol !== 2) { this.blocked = '서버와 클라이언트의 동기화 버전이 다릅니다. 배포 상태를 확인해주세요.'; this.notify(); return; }
    this.userId = data.sync_user_id;
    const accepted = Number(data.accepted_count) || 0;
    if (this.flight && accepted >= this.flight.request_count) this.accept();
    this.count = accepted;
    const previousIds = Object.keys(this.items);
    this.items = itemSnapshot(Object.fromEntries(Object.entries(items).filter(([, item]) => item?.kind !== 'host-tombstone')));
    this.revision = Number(data.revision) || 0; this.ready = true; this.seeded = true; this.syncAt = 0;
    this.redraw([...new Set([...previousIds, ...Object.keys(this.items)])]);
    // An unconfirmed request retains its exact count, ID and payload.
    if (this.flight) this.sentAt = 0;
  }
  submit(operations) {
    if (!this.editable) return false;
    if (this.pendingOperations.length + operations.length > 20000) { this.reject('저장 대기 중인 변경이 많습니다. 서버 연결을 확인해주세요.'); return false; }
    const bytes = operation => {
      const { doc, base, ...wire } = operation;
      return new TextEncoder().encode(JSON.stringify(wire)).length;
    };
    const sizes = operations.map(bytes);
    if (sizes.some(size => size > 8 * 1024 * 1024)) {
      this.reject('객체 데이터가 서버 전송 한도(8MiB)를 초과했습니다.'); return false;
    }
    const incoming = sizes.reduce((total, size) => total + size, 0);
    if (this.queuedBytes + incoming > 16 * 1024 * 1024) {
      this.reject('저장 대기 데이터가 많습니다. 서버 저장이 끝난 뒤 다시 시도해주세요.'); return false;
    }
    for (const operation of operations) {
      const last = this.queue.at(-1);
      if (operation.action === 'translate' && last?.action === 'translate'
        && operation.ids.length === last.ids.length && operation.ids.every((id, i) => id === last.ids[i])) {
        this.queuedBytes -= bytes(last);
        last.dx += operation.dx; last.dy += operation.dy;
        this.queuedBytes += bytes(last);
      } else if (operation.action === 'patch' && last?.action === 'patch' && operation.id === last.id) {
        const patch = { ...last.patch, ...operation.patch };
        const unset = new Set([...(last.unset || []), ...(operation.unset || [])]);
        for (const key of operation.unset || []) delete patch[key];
        for (const key of Object.keys(operation.patch)) unset.delete(key);
        this.queuedBytes -= bytes(last);
        this.queue[this.queue.length - 1] = { ...last, ...operation, patch, unset: [...unset] };
        this.queuedBytes += bytes(this.queue.at(-1));
      } else { this.queue.push(operation); this.queuedBytes += bytes(operation); }
    }
    this.notify(); return true;
  }
  pause() { this.ready = false; this.syncAt = 0; this.notify(); }
  flushMoves() { this.nextAt = 0; this.tick(); }
  retryRejected() { this.blocked = ''; this.ready = false; this.syncAt = 0; this.tick(); }
  requestSync(now) {
    if (this.syncAt && now - this.syncAt < 2000) return;
    if (this.send({ type: 'canvas_sync', client_id: this.clientId, request_id: createId() })) this.syncAt = now;
  }
  accept() {
    const operations = this.flight?.operations || [];
    this.receipt?.({ status: 'accepted', summary: { created: operations.filter(o => o.action === 'create').length,
      updated: operations.filter(o => ['patch','translate'].includes(o.action)).length, deleted: operations.filter(o => o.action === 'delete').length } });
    this.flight = null;
  }
  receive(_peer, message) { if (message) this.receiveServer(message); }
  receiveServer(data) {
    if (data.type === 'canvas_snapshot') { this.seed(data.items || {}, data); return true; }
    if (data.type === 'canvas_watermark') {
      if (this.seeded && data.revision > this.revision) { this.ready = false; this.requestSync(Date.now()); this.notify(); }
      return true;
    }
    if (data.type === 'canvas_commit') {
      if (!this.seeded) return true;
      if (data.revision <= this.revision) return true;
      if (data.revision !== this.revision + 1 || !this.ready) { this.ready = false; this.requestSync(Date.now()); this.notify(); return true; }
      const changes = new Map(Object.entries(data.items || {}));
      for (const move of data.translations || []) for (const id of move.ids) {
        const item = changes.has(id) ? changes.get(id) : this.items[id];
        if (item) changes.set(id, translateItem(item, move.dx, move.dy));
      }
      this.items = changeItems(this.items, changes); this.revision = data.revision;
      if (data.client_id === this.clientId && data.author_id === this.userId && this.flight?.request_count === data.request_count) {
        this.count = data.request_count; this.accept();
      }
      this.redraw([...changes.keys()]); return true;
    }
    if (data.type === 'canvas_result' || (data.type === 'error' && data.request_id === this.flight?.request_id)) {
      if (!this.flight || data.request_id !== this.flight.request_id) return true;
      if (data.ok) {
        // ACK alone never removes the local draft: wait for its commit/snapshot.
        if (data.duplicate || data.server_revision > this.revision + 1) { this.ready = false; this.requestSync(Date.now()); }
      } else if (['BROKER_BUSY','BROKER_QUEUE_FULL','RATE_LIMITED','BROKER_BACKEND_UNAVAILABLE','QUERY_OUTCOME_UNKNOWN','QUERY_UNAVAILABLE','STORAGE_UNAVAILABLE','CANVAS_WRITE_CONFLICT'].includes(data.code)) {
        this.sentAt = Date.now();
      } else if (data.code === 'CLIENT_SEQUENCE_CONFLICT') {
        this.ready = false; this.requestSync(Date.now());
      } else {
        const touched = this.flight.operations.flatMap(operationIds);
        this.receipt?.({ status: 'rejected', message: data.code });
        this.reject(`변경을 저장하지 못했습니다: ${data.code || '오류'}`);
        this.flight = null; this.redraw(touched);
      }
      this.notify(); return true;
    }
    return false;
  }
  tick() {
    if (!this.available()) { if (this.ready) this.pause(); return; }
    const now = Date.now();
    if (!this.ready) { if (this.seeded) this.requestSync(now); return; }
    if (!this.flight && this.queue.length && now >= this.nextAt) {
      const operations = []; let bytes = 0;
      while (this.queue.length && operations.length < 512) {
        const { doc, base, ...wire } = this.queue[0];
        const size = new TextEncoder().encode(JSON.stringify(wire)).length;
        if (bytes && bytes + size > 1024 * 1024) break;
        operations.push(this.queue.shift()); bytes += size; this.queuedBytes -= size;
      }
      this.flight = { type: 'canvas_ops', client_id: this.clientId, request_count: this.count + 1, request_id: createId(), operations: structuredClone(operations) };
      this.sentAt = 0; this.nextAt = now + (operations.every(o => o.action === 'translate') ? 100 : 33);
    }
    if (this.flight && now - this.sentAt >= 1000 && this.send(this.flight)) this.sentAt = now;
  }
}
