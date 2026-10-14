import { inheritItemDocument,includesDocument } from './documentCache.js';
import { canPeerAccessItem, compareSyncVersions, INITIAL_SYNC_VERSION, normalizeSyncVersion } from '../collaborativeSync.js';
import { collaborativeField, isCollaborativeItem } from '../collaborativeSync.js';
import { loadItemDoc, HOST_TOMBSTONE_KIND, HOST_VERSION_FIELD } from './hostOperations.js';
import { electHost, HOST_PEER_FPS, HOST_PROTOCOL, HOST_SAVE_FPS, HOST_MOVE_INTERVAL_MS, reduceHostOperations, operationIds, validateTranslation } from './hostOperations.js';

const encoder = new TextEncoder();
const clone = value => JSON.parse(JSON.stringify(value));
const hasId = id => typeof id === 'string' && id.length > 0 && id.length <= 128 && !['__proto__', 'constructor', 'prototype'].includes(id);
const validCount = count => Number.isSafeInteger(count) && count >= 0;
const summarize = operations => {
  const summary = { total: operations.reduce((n, operation) => n + operationIds(operation).length, 0), created: 0, updated: 0, deleted: 0 };
  for (const operation of operations) summary[operation.action === 'create' ? 'created' : operation.action === 'delete' ? 'deleted' : 'updated'] += operationIds(operation).length;
  return summary;
};

/** Host-authoritative replication; no timers can promote a partitioned follower. */
export class HostCanvasSession {
  constructor({ send, persist, publish, status, reject, receipt = () => {}, available, now = () => Date.now() }) {
    Object.assign(this, { send, persist, publish, status, reject, receipt, available, now });
    this.records = {}; this.itemCache = {}; this.connectorDependencies=new Map(); this.members = []; this.memberIndex = new Map(); this.term = ''; this.selfId = ''; this.hostId = '';
    this.ready = false; this.seeded = false; this.sequence = 0; this.clock = 0;
    this.localCounter = 0; this.localQueue = []; this.pending = new Map();
    this.lastMoveProposal = -Infinity; this.translationPeers = new Set(); this.hostSupportsTranslations = false;
    this.inbox = []; this.broadcasts = []; this.broadcastBytes = 0; this.serverDirty = new Map();
    this.states = new Map(); this.snapshotAcks = new Set(); this.snapshotSent = new Set();
    this.peerSequence = new Map(); this.lastPeerTick = -Infinity; this.lastSaveTick = -Infinity;
    this.outgoingStates = new Map();
    this.readySent=new Map();this.recordTransfers=new Map();
    this.partAckPeers=new Set();this.partAcks=new Map();
    this.completedTransfers=new Set();this.ackQueue=new Map();
    this.transferFields=new Map();this.stateRequestSent=new Map();
    this.lastCounts = new Map(); this.peerClients = new Map(); this.everReady = false;
    this.clientRegistered = false; this.lastHelloTick = -Infinity;
    this.clientId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  get isHost() { return this.selfId !== '' && this.hostId === this.selfId; }
  get editable() { return this.everReady && !this.faulted; }
  get items() { return this.itemCache; }
  setRecord(id,record) {
    const before=this.records[id]?.item;
    inheritItemDocument(before,record?.item);
    if(before?.kind==='connector')for(const target of [before.from,before.to]){
      const ids=this.connectorDependencies.get(target);ids?.delete(id);if(!ids?.size)this.connectorDependencies.delete(target);
    }
    if(record)this.records[id]=record;else delete this.records[id];
    if(record?.item)this.itemCache[id]=record.item;else delete this.itemCache[id];
    if(record?.item?.kind==='connector')for(const target of [record.item.from,record.item.to]){
      if(!this.connectorDependencies.has(target))this.connectorDependencies.set(target,new Set());this.connectorDependencies.get(target).add(id);
    }
  }
  get pendingOperations() {
    const approved=this.lastCounts.get(this.clientKey(this.member(this.selfId),this.clientId)) ?? -1;
    // An ordered commit/snapshot may arrive before its request ACK. Keep the
    // request pending for confirmation, but do not replay an applied delta.
    return [...this.pending.values()].filter(entry=>entry.requestCount>approved).flatMap(entry => entry.operations).concat(this.localQueue);
  }
  setReady(ready, message = '호스트와 최신 상태를 동기화하고 있습니다.') {
    this.ready = ready;
    if (ready) this.everReady = true;
    const queued = this.pendingOperations.length;
    const blocked = [...this.pending.values()].some(entry => entry.stage === 'rejected');
    const key = JSON.stringify([ready, this.editable, this.isHost, this.hostId, message, queued, blocked]);
    if (key === this.statusKey) return;
    this.statusKey = key;
    this.status({ ready, editable: this.editable, queued, blocked, isHost: this.isHost, hostId: this.hostId, message });
  }
  pause() { this.setReady(false); }
  abort(message) {
    this.faulted = true; this.setReady(false, message);
    if (this.isHost) for (const peer of this.members) if (peer.peer_id !== this.selfId) this.send(peer.peer_id, this.frame('host_fault', { message }));
  }
  seed(items) {
    const touched=[];
    for (const [id, item] of Object.entries(items)) {
      if (item?.type === 'chat_room' || !hasId(id)) continue;
      const version = normalizeSyncVersion(item[HOST_VERSION_FIELD]) || INITIAL_SYNC_VERSION;
      if (!this.records[id] || this.records[id].version.clock === 0 || compareSyncVersions(version, this.records[id].version) > 0) {
        const hydrated = clone(item);
        delete hydrated[HOST_VERSION_FIELD];
        if (isCollaborativeItem(item)) try { hydrated[collaborativeField(item)] = loadItemDoc(item).content; } catch { /* Keep legacy plain text. */ }
        this.setRecord(id, { item: item.kind === HOST_TOMBSTONE_KIND ? null : hydrated, permission: item.permission, version });touched.push(id);
        this.clock = Math.max(this.clock, version.clock);
      }
    }
    this.seeded = true;
    this.publish(this.items, touched);
  }
  configure(selfId, host) {
    if (!host || host.protocol !== HOST_PROTOCOL) {
      this.abort('서버가 호스트 선출 프로토콜을 지원하지 않습니다. 최신 서버를 적용한 뒤 다시 접속해주세요.');
      return;
    }
    if (typeof host.term !== 'string' || !host.term
      || !Array.isArray(host.members) || host.members.some(peer => !hasId(peer.peer_id))
      || new Set(host.members.map(peer => peer.peer_id)).size !== host.members.length
      || !host.members.some(peer => peer.peer_id === selfId) || electHost(host.members) !== host.peer_id) {
      this.setReady(false, '호스트 선출 정보를 기다리고 있습니다.'); return;
    }
    if (this.term === host.term && this.selfId === selfId) return;
    this.selfId = selfId; this.hostId = host.peer_id; this.term = host.term; this.members = clone(host.members);
    this.memberIndex = new Map(this.members.map(peer => [peer.peer_id, peer]));
    this.sequence = 0; this.faulted = false; this.states.clear(); this.snapshotAcks.clear(); this.snapshotSent.clear();
    this.peerSequence.clear(); this.inbox = []; this.broadcasts = []; this.broadcastBytes = 0;
    for (const entry of this.pending.values()) { entry.sentAt = -Infinity; entry.confirmation = null; }
    this.peerClients.clear(); this.clientRegistered = false; this.lastHelloTick = -Infinity;
    this.translationPeers.clear(); this.hostSupportsTranslations = false; this.lastMoveProposal = -Infinity;
    this.serverDirty.clear(); this.stateAssembled = false;
    this.stateReplySent = false; this.incomingStates = new Map();
    this.outgoingStates.clear();
    this.readySent.clear();this.recordTransfers.clear();
    this.partAckPeers.clear();this.partAcks.clear();
    this.completedTransfers.clear();this.ackQueue.clear();
    this.transferFields.clear();this.stateRequestSent.clear();
    this.setReady(false, this.hostId ? '호스트와 최신 상태를 동기화하고 있습니다.' : '모든 참여자의 권한을 동기화할 호스트를 기다리고 있습니다.');
    this.publish(this.items, []);
  }
  member(id) { return this.memberIndex.get(id); }
  clientKey(peer, clientId) { return JSON.stringify([peer?.nickname || '', peer?.tag_number ?? 0, clientId]); }
  filteredRecords(peer) { return Object.fromEntries(Object.entries(this.records).filter(([, record]) => canPeerAccessItem(record.item || { permission: record.permission }, peer))); }
  frame(type, fields = {}) { return { type, protocol: HOST_PROTOCOL, term: this.term, ...fields }; }
  submit(operations) {
    if (!this.editable || !Array.isArray(operations)) return false;
    const copied=clone(operations);
    try{for(const operation of copied)if(operation?.action==='translate')validateTranslation(operation);}
    catch(error){this.reject(error.message);return false;}
    for(const operation of copied){
      const previous=this.localQueue.at(-1),keys=Object.keys(operation.patch||{}),oldKeys=Object.keys(previous?.patch||{});
      if(operation.action==='translate' && previous?.action==='translate' && operation.ids.length===previous.ids.length
        && operation.ids.every((id,i)=>id===previous.ids[i])){
        previous.dx+=operation.dx;previous.dy+=operation.dy;continue;
      }
      const textOnly=entry=>entry?.action==='patch' && typeof entry.doc==='string' && !(entry.unset||[]).length;
      if(previous?.id===operation.id && textOnly(previous) && textOnly(operation) && keys.length===1 && oldKeys.length===1
        && keys[0]===oldKeys[0] && ['text','code'].includes(keys[0]) && includesDocument(operation.doc,previous.doc))this.localQueue[this.localQueue.length-1]=operation;
      else this.localQueue.push(operation);
    }
    this.setReady(this.ready);
    return true;
  }
  flushMoves() { this.lastMoveProposal=-Infinity; this.lastPeerTick=-Infinity; this.tick(); }
  restorePersistence(changes){
    for(const change of changes)if(this.records[change.id]===change.record && !this.serverDirty.has(change.id))this.serverDirty.set(change.id,change);
  }
  snapshot(peerId) {
    const peer = this.member(peerId);
    return peer && this.sendRecords(peerId, 'host_snapshot', this.filteredRecords(peer), { sequence: this.sequence, counters: [...this.lastCounts] });
  }
  mergeCounters(counters = []) {
    if (!Array.isArray(counters)) return;
    for (const entry of counters) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [key, count] = entry;
      if (typeof key !== 'string' || key.length > 512 || !validCount(count)) continue;
      try {
        const owner = JSON.parse(key);
        if (!Array.isArray(owner) || owner.length !== 3 || typeof owner[0] !== 'string'
          || !validCount(owner[1]) || !hasId(owner[2])) continue;
        this.lastCounts.set(key, Math.max(count, this.lastCounts.get(key) || 0));
      } catch { /* Ignore malformed client counter keys. */ }
    }
  }
  registerClient(lastCount) {
    if (!validCount(lastCount)) return;
    const current = [...this.pending.values()][0];
    const confirmed = current ? current.requestCount - 1 : this.localCounter;
    if (lastCount < confirmed) { this.abort('호스트의 요청 카운트가 이전 성공 응답보다 낮습니다. 동기화를 다시 확인해주세요.'); return; }
    if (!current) this.localCounter = lastCount;
    else if (lastCount === current.requestCount) { current.stage = 'waiting'; current.sentAt = -Infinity; }
    this.clientRegistered = true;
  }
  finishConfirmedRequests() {
    for (const [requestId, entry] of this.pending) {
      const result = entry.confirmation;
      if (!result || result.sequence > this.sequence) continue;
      this.pending.delete(requestId);
      this.mergeCounters([[this.clientKey(this.member(this.selfId), this.clientId), entry.requestCount]]);
      this.receipt({ ...result, summary: result.summary || summarize(entry.operations) });
      this.setReady(this.ready);
    }
  }
  respond(peerId, type, fields) {
    const result = this.frame(type, { ...fields, sequence: this.sequence });
    if (peerId === this.selfId) { this.receive(peerId, result); return true; }
    return this.send(peerId, result);
  }
  retryRejected() {
    for (const entry of this.pending.values()) if (entry.stage === 'rejected') {
      entry.stage = 'waiting'; entry.sentAt = -Infinity; entry.confirmation = null;
      this.receipt({ status: 'waiting', message: '같은 요청을 다시 전송합니다.' });
    }
    this.setReady(this.ready);
  }
  checkRequest(peer, data) {
    const fields = { clientId: data.clientId, requestCount: data.requestCount, requestId: data.requestId };
    if (!hasId(data.clientId) || !validCount(data.requestCount) || data.requestCount < 1
      || data.requestId !== `${data.clientId}-${data.requestCount}`) {
      this.respond(peer.peer_id, 'host_reject', { ...fields, status: 'rejected', message: '올바른 요청 카운트가 필요합니다.' }); return false;
    }
    if (this.peerClients.get(peer.peer_id) !== data.clientId) {
      this.respond(peer.peer_id, 'host_retry', { ...fields, message: '먼저 요청 카운트를 동기화해주세요.' }); return false;
    }
    const lastCount = this.lastCounts.get(this.clientKey(peer, data.clientId)) || 0;
    if (data.requestCount === lastCount) {
      this.respond(peer.peer_id, 'host_ack', { ...fields, lastCount, status: 'accepted', duplicate: true }); return false;
    }
    if (data.requestCount < lastCount || data.requestCount !== lastCount + 1) {
      this.respond(peer.peer_id, 'host_reject', { ...fields, status: 'rejected',
        message: data.requestCount < lastCount ? '이미 지나간 요청 카운트입니다.' : '이전 요청의 성공 응답을 먼저 확인해주세요.' }); return false;
    }
    return true;
  }
  sendRecords(peerId, type, records, fields = {}) {
    const { counters, ...payloadFields } = fields;
    const transferKey=`${peerId}:${type}:${fields.sequence ?? 0}`;
    if(this.completedTransfers.delete(transferKey))return true;
    if (counters) {
      const counterKey = `${peerId}:${type}:${fields.sequence ?? 0}:counters`;
      for (let index = this.outgoingStates.get(counterKey) || 0; index < counters.length; index += 512) {
        if (!this.send(peerId, this.frame('host_counters', { targetType: type, counters: counters.slice(index, index + 512) }))) {
          this.outgoingStates.set(counterKey, index); return false;
        }
      }
      this.outgoingStates.set(counterKey, counters.length);
    }
    let partitions=this.recordTransfers.get(transferKey);
    if(!partitions){partitions = []; let current = {}, bytes = 0;
    for (const [id, record] of Object.entries(records)) {
      const size = encoder.encode(JSON.stringify({ [id]: record })).length;
      if (size > 15 * 1024 * 1024) { this.abort('객체의 동기화 데이터가 전송 한도를 초과했습니다.'); return false; }
      if (bytes && bytes + size > 256 * 1024) { partitions.push(current); current = {}; bytes = 0; }
      current[id] = record; bytes += size;
    }
    partitions.push(current);
    this.recordTransfers.set(transferKey,partitions);}
    const current=partitions[0];
    if (partitions.length === 1) {
      const sent = this.send(peerId, this.frame(type, { ...payloadFields, records: current }));
      if(sent)this.recordTransfers.delete(transferKey);
      if (sent) this.outgoingStates.delete(`${peerId}:${type}:${fields.sequence ?? 0}:counters`);
      return sent;
    }
    const key = `${peerId}:${type}:${fields.sequence ?? 0}`;
    this.transferFields.set(key,{peerId,type,fields});
    const credit=this.partAckPeers.has(peerId);
    if(credit && !this.partAcks.has(key))this.partAcks.set(key,new Set());
    for (let index = this.outgoingStates.get(key) || 0; index < partitions.length; index++) {
      if(credit && index-this.partAcks.get(key).size>=4){this.outgoingStates.set(key,index);return false;}
      if (!this.send(peerId, this.frame('host_state_part', {
        snapshotType: type, ...payloadFields, part_ack:credit, index, count: partitions.length, records: partitions[index],
      }))) { this.outgoingStates.set(key, index); return false; }
      this.outgoingStates.set(key,index+1);
    }
    if(credit && this.partAcks.get(key).size<partitions.length)return false;
    this.outgoingStates.delete(key);
    this.transferFields.delete(key);
    this.partAcks.delete(key);
    this.recordTransfers.delete(transferKey);
    this.outgoingStates.delete(`${key}:counters`);
    return true;
  }
  mergeState(records, peer) {
    if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('잘못된 동기화 상태입니다.');
    for (const [id, record] of Object.entries(records)) {
      if (!hasId(id) || !record || !normalizeSyncVersion(record.version)
        || !canPeerAccessItem(record.item || { permission: record.permission }, peer)) throw new Error('동기화 상태의 권한 또는 버전이 올바르지 않습니다.');
      const previous = this.records[id];
      if (!previous || compareSyncVersions(record.version, previous.version) > 0) this.setRecord(id,clone(record));
      this.clock = Math.max(this.clock, record.version.clock);
    }
  }
  receive(peerId, data) {
    if (!data || data.protocol !== HOST_PROTOCOL) return;
    const peer = this.member(peerId);
    if (!peer) return;
    if (data.term !== this.term) {
      if (this.isHost && data.type === 'host_proposal') this.send(peerId, this.frame('host_retry', { requestId: data.requestId, message: '호스트가 변경되었습니다. 동기화 후 다시 전송해주세요.' }));
      return;
    }
    if (data.type === 'host_fault' && peerId === this.hostId) { this.abort(data.message || '호스트 동기화가 중단되었습니다. 새로고침해주세요.'); return; }
    if (this.faulted) {
      if (this.isHost && data.type === 'host_proposal') this.send(peerId, this.frame('host_retry', { requestId: data.requestId, message: '호스트 복구를 기다리고 있습니다.' }));
      return;
    }
    if (data.type === 'host_counters') {
      if ((data.targetType === 'host_state' && this.isHost && !this.stateAssembled)
        || (data.targetType === 'host_snapshot' && peerId === this.hostId && !this.isHost)) this.mergeCounters(data.counters);
      return;
    }
    if(data.type==='host_part_ack'){
      const key=`${peerId}:${data.snapshotType}:${data.sequence ?? 0}`,acks=this.partAcks.get(key);
      if(acks && Number.isSafeInteger(data.index) && data.index>=0 && data.index<(this.outgoingStates.get(key)||0)){
        acks.add(data.index);
        if(acks.size===this.recordTransfers.get(key)?.length){
          this.partAcks.delete(key);this.recordTransfers.delete(key);this.outgoingStates.delete(key);this.outgoingStates.delete(key+':counters');
          this.transferFields.delete(key);
          if(data.snapshotType==='host_state')this.stateReplySent=true;
          else if(data.snapshotType==='host_snapshot')this.snapshotSent.add(peerId);
          else this.completedTransfers.add(key);
        }
      }
      return;
    }
    if (data.type === 'host_state_part') {
      if (!['host_snapshot', 'host_state', 'host_commit'].includes(data.snapshotType) || !Number.isSafeInteger(data.index)
        || !Number.isSafeInteger(data.count) || data.count < 2 || data.count > 50000 || data.index < 0 || data.index >= data.count
        || (data.snapshotType !== 'host_state' && peerId !== this.hostId)
        || (data.snapshotType === 'host_state' && !this.isHost)) return;
      this.incomingStates ||= new Map();
      const key = `${peerId}:${data.snapshotType}:${data.sequence ?? 0}`;
      let transfer = this.incomingStates.get(key);
      if (!transfer) { transfer = { count: data.count, parts: new Map() }; this.incomingStates.set(key, transfer); }
      if (transfer.count !== data.count) return;
      transfer.parts.set(data.index, data.records);
      if(data.part_ack){
        this.partAckPeers.add(peerId);
        const ack=this.frame('host_part_ack',{snapshotType:data.snapshotType,sequence:data.sequence,index:data.index});
        if(!this.send(peerId,ack))this.ackQueue.set(`${peerId}:${data.snapshotType}:${data.sequence}:${data.index}`,{peerId,ack});
      }
      if (transfer.parts.size === data.count) {
        this.incomingStates.delete(key);
        const records = Object.assign({}, ...[...transfer.parts.entries()].sort(([a], [b]) => a - b).map(([, part]) => part));
        this.receive(peerId, this.frame(data.snapshotType, { sequence: data.sequence, origin: data.origin, requestId: data.requestId,
          evict: data.evict, counter: data.counter, counters: data.counters, part_ack:data.part_ack, records }));
      }
      return;
    }
    if (data.type === 'host_state_request' && peerId === this.hostId && this.seeded) {
      if(data.part_ack)this.partAckPeers.add(peerId);
      if (!this.stateReplySent) this.stateReplySent = this.sendRecords(peerId, 'host_state', this.records, { counters: [...this.lastCounts],part_ack:true });
      return;
    }
    if (data.type === 'host_state' && this.isHost && !this.stateAssembled && this.seeded) {
      if(data.part_ack)this.partAckPeers.add(peerId);
      try { this.mergeState(data.records, peer); this.mergeCounters(data.counters); this.states.set(peerId, true); }
      catch (error) { this.setReady(false, error.message); }
      return;
    }
    if (data.type === 'host_snapshot' && peerId === this.hostId && !this.isHost) {
      if (!Number.isSafeInteger(data.sequence) || data.sequence < this.sequence) return;
      try {
        const old = this.records; this.records = {}; this.itemCache={};this.connectorDependencies=new Map(); this.mergeState(data.records, this.member(this.selfId));
        this.sequence = data.sequence;
        this.mergeCounters(data.counters);
        this.finishConfirmedRequests();
        this.publish(this.items, Object.keys({ ...old, ...this.records }));
        this.send(peerId, this.frame('host_snapshot_ack', { sequence: this.sequence }));
      } catch (error) { this.setReady(false, error.message); }
      return;
    }
    if (data.type === 'host_snapshot_ack' && this.isHost && data.sequence === this.sequence) {
      this.snapshotAcks.add(peerId); this.peerSequence.set(peerId, this.sequence);this.readySent.delete(peerId); return;
    }
    if (data.type === 'host_ready' && peerId === this.hostId) {
      if(data.sequence===this.sequence){this.hostSupportsTranslations=data.translateV1===true;this.setReady(true);}
      else if(this.ready && Number.isSafeInteger(data.sequence) && data.sequence>this.sequence){this.setReady(false);this.send(peerId,this.frame('host_resync'));}
      return;
    }
    if (data.type === 'host_resync' && this.isHost && this.ready) {
      this.snapshotAcks.delete(peerId); this.snapshotSent.delete(peerId);this.readySent.delete(peerId); return;
    }
    if (data.type === 'host_client_hello' && this.isHost) {
      if (!this.ready) { this.respond(peerId, 'host_retry', { message: '호스트 동기화 후 요청 카운트를 확인합니다.' }); return; }
      if (!hasId(data.clientId) || (this.peerClients.has(peerId) && this.peerClients.get(peerId) !== data.clientId)) {
        this.respond(peerId, 'host_client_state', { clientId: data.clientId, ok: false, message: '연결된 사용자 세션을 확인해주세요.' }); return;
      }
      const key = this.clientKey(peer, data.clientId);
      this.peerClients.set(peerId, data.clientId);
      if(data.translateV1===true)this.translationPeers.add(peerId);else this.translationPeers.delete(peerId);
      if (!this.lastCounts.has(key)) this.lastCounts.set(key, 0);
      this.respond(peerId, 'host_client_state', { clientId: data.clientId, ok: true, lastCount: this.lastCounts.get(key) }); return;
    }
    if (data.type === 'host_client_state' && peerId === this.hostId && data.clientId === this.clientId) {
      if (data.ok !== true) { this.abort(data.message || '요청 카운트를 확인하지 못했습니다.'); return; }
      if (Number.isSafeInteger(data.sequence) && data.sequence <= this.sequence) this.registerClient(data.lastCount);
      return;
    }
    if (data.type === 'host_proposal' && this.isHost) {
      if (!this.ready) { this.send(peerId, this.frame('host_retry', { requestId: data.requestId, message: '호스트가 최신 상태를 동기화하고 있습니다.' })); return; }
      if (!this.checkRequest(peer, data)) return;
      if (this.inbox.some(entry => entry.peer.peer_id === peerId && entry.requestId === data.requestId)) return;
      const bytes = encoder.encode(JSON.stringify(data.operations)).length;
      if (this.inbox.length >= 256 || bytes + this.inbox.reduce((total, entry) => total + (entry.bytes || 0), 0) > 32 * 1024 * 1024) {
        this.respond(peerId, 'host_retry', { requestId: data.requestId, message: '호스트가 대기 중인 변경을 처리하고 있습니다.' }); return;
      }
      this.respond(peerId, 'host_received', { clientId: data.clientId, requestCount: data.requestCount, requestId: data.requestId, status: 'received' });
      this.inbox.push({ peer, bytes, clientId: data.clientId, requestCount: data.requestCount, requestId: data.requestId, operations: data.operations }); return;
    }
    if (data.type === 'host_reject' && peerId === this.hostId) {
      const entry = this.pending.get(data.requestId);
      if (entry && data.clientId === this.clientId && data.requestCount === entry.requestCount) {
        entry.confirmation = null; entry.stage = 'rejected';
        this.reject(data.message || '호스트가 변경을 거부했습니다.');
        this.receipt({ ...data, status: 'rejected' }); this.setReady(this.ready);
      }
      return;
    }
    if (['host_received', 'host_retry'].includes(data.type) && peerId === this.hostId) {
      const entry = this.pending.get(data.requestId);
      if (entry) {
        const stage = data.type === 'host_received' ? 'received' : 'waiting';
        if (entry.stage !== 'rejected' && entry.stage !== stage) { entry.stage = stage; this.receipt({ requestId: data.requestId, status: stage, message: data.message }); }
      }
      return;
    }
    if (data.type === 'host_ack' && peerId === this.hostId) {
      const entry = this.pending.get(data.requestId);
      if (entry && data.status === 'accepted' && data.clientId === this.clientId && data.requestCount === entry.requestCount
        && data.lastCount === entry.requestCount && validCount(data.sequence)) {
        entry.confirmation = { ...data, status: 'accepted' };
        this.finishConfirmedRequests(); this.publish(this.items, []);
      }
      return;
    }
    if (data.type === 'host_commit') {
      this.receive(peerId, this.frame('host_commits', { commits: [data] })); return;
    }
    if (data.type === 'host_commits' && peerId === this.hostId && !this.isHost) {
      if (!Array.isArray(data.commits)) return;
      const touched = new Set();
      for (const commit of data.commits) {
        if (!Number.isSafeInteger(commit.sequence)) return;
        if (commit.sequence <= this.sequence) continue;
        if (commit.sequence !== this.sequence + 1) {
          this.setReady(false); this.send(peerId, this.frame('host_resync')); return;
        }
        try {
          if(commit.translations){
            const version=normalizeSyncVersion(commit.version);
            if(!version || !Array.isArray(commit.translations))throw new Error('올바른 이동 버전이 필요합니다.');
            const operations=commit.translations.map(move=>({...move,action:'translate'}));
            for(const move of operations)validateTranslation(move);
            const result=reduceHostOperations(this.items,operations,this.member(this.selfId),this.connectorDependencies);
            for(const id of result.touched){
              if(compareSyncVersions(version,this.records[id].version)<=0)throw new Error('이동 기준 상태를 다시 동기화합니다.');
            }
            for(const id of result.touched){this.setRecord(id,{item:result.items[id],permission:result.items[id].permission,version});touched.add(id);}
            this.clock=Math.max(this.clock,version.clock);
          }else{this.mergeState(commit.records, this.member(this.selfId));Object.keys(commit.records).forEach(id => touched.add(id));}
        }
        catch (error) { this.setReady(false, error.message); this.send(peerId,this.frame('host_resync'));return; }
        for (const id of commit.evict || []) if (hasId(id)) { this.setRecord(id,null); touched.add(id); }
        this.sequence = commit.sequence;
        if (commit.counter) this.mergeCounters([commit.counter]);
      }
      this.finishConfirmedRequests();
      this.publish(this.items, [...touched]);
    }
  }
  accept(entry) {
    if (!this.checkRequest(entry.peer, entry)) return;
    const fields = { requestId: entry.requestId, clientId: entry.clientId, requestCount: entry.requestCount };
    try {
      const result = reduceHostOperations(this.items, entry.operations, entry.peer, this.connectorDependencies);
      const version = { clock: Math.max(this.now(), this.clock + 1), actor: this.selfId };
      this.clock = version.clock;
      const changed = {}, previousPermissions = {};
      for (const id of result.touched) {
        const previous = this.records[id];
        const item = result.items[id] || null;
        const record = { item, permission: item?.permission || previous?.permission, version };
        previousPermissions[id] = previous?.permission;
        this.setRecord(id,record); changed[id] = record;
        this.serverDirty.set(id, { id, record, previous: previous?.item || null });
      }
      this.sequence += 1;
      const key = this.clientKey(entry.peer, entry.clientId);
      this.lastCounts.set(key, entry.requestCount);
      const translations=entry.operations.every(operation=>operation.action==='translate')
        ? entry.operations.map(({ids,dx,dy})=>({ids,dx,dy})) : null;
      const bytes = encoder.encode(JSON.stringify(translations ? {translations,version} : changed)).length;
      this.broadcastBytes += bytes;
      this.broadcasts.push({ bytes, sequence: this.sequence, origin: entry.peer.peer_id, requestId: entry.requestId,
        counter: [key, entry.requestCount], records: changed, previousPermissions, translations, version });
      this.respond(entry.peer.peer_id, 'host_ack', { ...fields, status: 'accepted', summary: summarize(entry.operations), lastCount: entry.requestCount });
      this.publish(this.items, result.touched);
    } catch (error) {
      this.respond(entry.peer.peer_id, 'host_reject', { ...fields, status: 'rejected', message: error.message });
    }
  }
  tick() {
    const now = this.now();
    if (this.faulted) return;
    if (!this.available()) {
      if (this.wasAvailable) {
        this.stateReplySent = false; this.snapshotSent.clear(); this.snapshotAcks.clear();
        this.outgoingStates.clear(); this.incomingStates?.clear();this.recordTransfers.clear();this.partAcks.clear();this.completedTransfers.clear();this.ackQueue.clear();this.transferFields.clear();this.stateRequestSent.clear();this.readySent.clear();
        if (this.isHost) this.snapshotAcks.add(this.selfId);
      }
      this.wasAvailable = false;
      if (this.ready) this.pause();
      return;
    }
    this.wasAvailable = true;
    for(const [key,{peerId,ack}] of this.ackQueue){if(!this.send(peerId,ack))break;this.ackQueue.delete(key);}
    for(const [key,{peerId,type,fields}] of this.transferFields)if(this.sendRecords(peerId,type,{},fields)){
      if(type==='host_state')this.stateReplySent=true;
      else if(type==='host_snapshot')this.snapshotSent.add(peerId);
      else this.completedTransfers.add(key);
    }
    if (!this.term || !this.hostId || !this.seeded) return;
    if (now - this.lastPeerTick >= 1000 / HOST_PEER_FPS) {
      const interval = 1000 / HOST_PEER_FPS;
      this.lastPeerTick = Number.isFinite(this.lastPeerTick) ? now - (now - this.lastPeerTick) % interval : now;
      if (this.isHost && !this.stateAssembled) {
        this.states.set(this.selfId, true);
        for (const peer of this.members) if (!this.states.has(peer.peer_id) && now-(this.stateRequestSent.get(peer.peer_id)??-Infinity)>=500
          && this.send(peer.peer_id, this.frame('host_state_request',{part_ack:true})))this.stateRequestSent.set(peer.peer_id,now);
        if (this.states.size === this.members.length) {
          this.stateAssembled = true; this.snapshotAcks.add(this.selfId);
          // A successor re-saves approved state, including unsaved predecessor changes.
          for (const [id, record] of Object.entries(this.records)) if (record.version.clock > 0) this.serverDirty.set(id, { id, record, previous: null });
          this.publish(this.items, Object.keys(this.records));
        }
      }
      if (this.isHost && this.stateAssembled) {
        for (const peer of this.members) {
          if (peer.peer_id === this.selfId) continue;
          if (!this.snapshotAcks.has(peer.peer_id) && !this.snapshotSent.has(peer.peer_id) && this.snapshot(peer.peer_id)) this.snapshotSent.add(peer.peer_id);
        }
        if (this.snapshotAcks.size === this.members.length && !this.ready) this.setReady(true);
        if (this.ready) for (const peer of this.members) {
          if (peer.peer_id !== this.selfId && now-(this.readySent.get(peer.peer_id) ?? -Infinity)>=(this.peerClients.has(peer.peer_id)?5000:1000)
            && this.send(peer.peer_id, this.frame('host_ready', { sequence: this.peerSequence.get(peer.peer_id) ?? this.sequence, translateV1:true })))this.readySent.set(peer.peer_id,now);
        }
      }
      if (this.ready) {
        if (!this.clientRegistered) {
          if (this.isHost) {
            this.peerClients.set(this.selfId, this.clientId);
            const key = this.clientKey(this.member(this.selfId), this.clientId);
            if (!this.lastCounts.has(key)) this.lastCounts.set(key, 0);
            this.registerClient(this.lastCounts.get(key));
          } else if (now - this.lastHelloTick >= 500 && this.send(this.hostId, this.frame('host_client_hello', { clientId: this.clientId, translateV1:true }))) this.lastHelloTick = now;
        }
        if (!this.clientRegistered || this.faulted) return;
        if (this.localQueue.length && !this.pending.size && (this.localQueue.some(operation=>operation.action!=='translate') || now-this.lastMoveProposal>=HOST_MOVE_INTERVAL_MS)) {
          if (this.localCounter >= Number.MAX_SAFE_INTEGER) { this.abort('요청 카운트 한도에 도달했습니다.'); return; }
          const operations = []; let bytes = 0;
          while (operations.length < this.localQueue.length && operations.length < 512) {
            const size = encoder.encode(JSON.stringify(this.localQueue[operations.length])).length;
            if (size > 12 * 1024 * 1024) { this.abort('변경 데이터가 전송 한도를 초과했습니다.'); return; }
            if (bytes && bytes + size > 4 * 1024 * 1024) break;
            operations.push(this.localQueue[operations.length]); bytes += size;
          }
          this.localQueue.splice(0, operations.length);
          if(operations.every(operation=>operation.action==='translate'))this.lastMoveProposal=now;
          const requestId = `${this.clientId}-${++this.localCounter}`;
          this.pending.set(requestId, { operations, requestCount: this.localCounter, sentAt: -Infinity, confirmation: null });
        }
        for (const [requestId, entry] of this.pending) {
          if (entry.stage === 'rejected') continue;
          const request = { clientId: this.clientId, requestCount: entry.requestCount, requestId, operations: entry.operations };
          if (this.isHost) {
            if (!this.inbox.some(queued => queued.requestId === requestId)) this.inbox.push({ peer: this.member(this.selfId), ...request });
          }
          else if (now - entry.sentAt >= 500 && this.send(this.hostId, this.frame('host_proposal', request))) entry.sentAt = now;
        }
        if (this.isHost) {
          // Bound work per frame; remaining proposals retain FIFO ordering.
          const started = performance.now(); let processed = 0;
          while (processed < this.inbox.length && processed < 32
            && this.broadcasts.length < 256 && this.broadcastBytes < 64 * 1024 * 1024) {
            this.accept(this.inbox[processed++]);
            if (performance.now() - started >= 8) break;
          }
          this.inbox.splice(0, processed);
          for (const peer of this.members) {
            if (peer.peer_id === this.selfId) continue;
            const commits = this.broadcasts.filter(commit => commit.sequence > (this.peerSequence.get(peer.peer_id) || 0)).map(commit => ({
              sequence: commit.sequence, origin: commit.origin, requestId: commit.requestId, counter: commit.counter,
              records: Object.fromEntries(Object.entries(commit.records).filter(([, record]) => canPeerAccessItem(record.item || { permission: record.permission }, peer))),
              evict: Object.entries(commit.records).filter(([id, record]) => !canPeerAccessItem(record.item || { permission: record.permission }, peer)
                && canPeerAccessItem({ permission: commit.previousPermissions[id] }, peer)).map(([id]) => id),
            }));
            for (const commit of commits) {
              const source=this.broadcasts.find(entry=>entry.sequence===commit.sequence);
              if(source.translations && this.translationPeers.has(peer.peer_id)){
                const translations=source.translations.map(move=>({...move,ids:move.ids.filter(id=>Object.hasOwn(commit.records,id))})).filter(move=>move.ids.length);
                const {records,...fields}=commit;
                const payload=translations.length?{...fields,translations,version:source.version}:{...fields,records:{}};
                if(!this.send(peer.peer_id,this.frame('host_commit',payload)))break;
                this.peerSequence.set(peer.peer_id,commit.sequence);continue;
              }
              const { records, ...fields } = commit;
              if (!this.sendRecords(peer.peer_id, 'host_commit', records, fields)) break;
              this.peerSequence.set(peer.peer_id, commit.sequence);
            }
          }
          const floor = Math.min(this.sequence, ...this.members.filter(peer => peer.peer_id !== this.selfId).map(peer => this.peerSequence.get(peer.peer_id) || 0));
          this.broadcasts = this.broadcasts.filter(commit => commit.sequence > floor);
          this.broadcastBytes = this.broadcasts.reduce((bytes, commit) => bytes + commit.bytes, 0);
        }
      }
    }
    if (this.ready && this.isHost && now - this.lastSaveTick >= 1000 / HOST_SAVE_FPS) {
      this.lastSaveTick = now;
      const changes = [...this.serverDirty.values()].slice(0, 512);
      if (changes.length) {
        const accepted = this.persist(changes, this.term);
        if (accepted) for (const change of changes) if ((accepted === true || accepted.includes(change.id)) && this.serverDirty.get(change.id) === change) this.serverDirty.delete(change.id);
      }
    }
  }
}
