const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const TRANSFER_CHUNK_SIZE = 8 * 1024;
const MAX_TRANSFER_SIZE = 16 * 1024 * 1024;
const MAX_QUEUED_SIZE = 64 * 1024 * 1024;
const QUEUE_HIGH_WATER = 512 * 1024;
const QUEUE_LOW_WATER = 128 * 1024;
const TRANSFER_CHUNK_TYPE = '__agora_transfer_chunk';

function configuredIceServers() {
  const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

export default class CanvasPeerMesh {
  constructor({ sendSignal, onData, onCursor, onLaser, onPeersChanged }) {
    this.sendSignal = sendSignal;
    this.onData = onData;
    this.onCursor = onCursor;
    this.onLaser = onLaser;
    this.onPeersChanged = onPeersChanged;
    this.selfPeerId = '';
    this.peers = new Map();
    this.closed = false;
    this.iceServers = configuredIceServers();
  }

  setInitialPeers(selfPeerId, peers) {
    this.selfPeerId = selfPeerId || '';
    for (const peer of peers || []) this.addPeer(peer);
    this.#emitPeersChanged();
  }

  addPeer(metadata) {
    if (!metadata?.peer_id || metadata.peer_id === this.selfPeerId || this.closed) return;
    const existing = this.peers.get(metadata.peer_id);
    if (existing) {
      existing.metadata = { ...existing.metadata, ...metadata };
      this.#emitPeersChanged();
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer = {
      metadata, pc, sync: null, bulk: null, cursor: null, pendingCandidates: [],
      syncQueue: [], bulkQueue: [], syncQueuedSize: 0, bulkQueuedSize: 0,
      incomingTransfers: new Map(),
    };
    this.peers.set(metadata.peer_id, peer);
    pc.onicecandidate = (event) => {
      if (event.candidate) this.#signal(metadata.peer_id, 'candidate', { candidate: event.candidate.toJSON() });
    };
    pc.ondatachannel = (event) => this.#attachChannel(peer, event.channel);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.#removePeer(metadata.peer_id);
      else this.#emitPeersChanged();
    };

    const shouldOffer = this.selfPeerId && this.selfPeerId.localeCompare(metadata.peer_id) < 0;
    if (shouldOffer) {
      this.#attachChannel(peer, pc.createDataChannel('agora-sync', { ordered: true }));
      this.#attachChannel(peer, pc.createDataChannel('agora-bulk', { ordered: true }));
      this.#attachChannel(peer, pc.createDataChannel('agora-cursor', { ordered: false, maxRetransmits: 0 }));
      void this.#createOffer(peer);
    }
    this.#emitPeersChanged();
  }

  async handleSignal(message) {
    const metadata = {
      peer_id: message.from_peer_id,
      nickname: message.from_nickname,
      tag_number: message.from_tag_number,
      groups: message.from_groups || [],
      is_admin: Boolean(message.from_is_admin),
    };
    this.addPeer(metadata);
    const peer = this.peers.get(metadata.peer_id);
    if (!peer) return;
    try {
      if (message.action === 'offer') {
        await peer.pc.setRemoteDescription(message.description);
        await this.#flushCandidates(peer);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.#signal(metadata.peer_id, 'answer', { description: peer.pc.localDescription.toJSON() });
      } else if (message.action === 'answer') {
        await peer.pc.setRemoteDescription(message.description);
        await this.#flushCandidates(peer);
      } else if (message.action === 'candidate') {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(message.candidate);
        else peer.pendingCandidates.push(message.candidate);
      }
    } catch (error) {
      console.warn('WebRTC peer negotiation failed', error);
    }
  }

  #signal(peerId, action, payload) {
    this.sendSignal({ type: 'rtc_signal', peer_id: peerId, action, ...payload });
  }

  async #createOffer(peer) {
    try {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      this.#signal(peer.metadata.peer_id, 'offer', { description: peer.pc.localDescription.toJSON() });
    } catch (error) {
      console.warn('WebRTC offer failed', error);
    }
  }

  async #flushCandidates(peer) {
    const pending = peer.pendingCandidates.splice(0);
    for (const candidate of pending) await peer.pc.addIceCandidate(candidate);
  }

  #attachChannel(peer, channel) {
    if (channel.label === 'agora-sync') peer.sync = channel;
    else if (channel.label === 'agora-bulk') peer.bulk = channel;
    else if (channel.label === 'agora-cursor') peer.cursor = channel;
    if (channel.label === 'agora-sync' || channel.label === 'agora-bulk') {
      channel.bufferedAmountLowThreshold = QUEUE_LOW_WATER;
      channel.onbufferedamountlow = () => this.#flushQueue(peer, channel.label);
    }
    channel.onopen = () => {
      this.#flushQueue(peer, channel.label);
      this.#emitPeersChanged();
    };
    channel.onclose = () => this.#emitPeersChanged();
    channel.onerror = () => this.#emitPeersChanged();
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === TRANSFER_CHUNK_TYPE) {
          const completed = this.#receiveTransferChunk(peer, message);
          if (completed) this.onData?.(peer.metadata, completed, channel.label);
          return;
        }
        if (message?.type === 'cursor') this.onCursor?.(peer.metadata, message);
        else if (message?.type === 'laser') this.onLaser?.(peer.metadata, message);
        else this.onData?.(peer.metadata, message, channel.label);
      } catch { /* Ignore malformed or stale peer frames. */ }
    };
  }

  sendData(payload, canSend = () => true) {
    const encoded = JSON.stringify(payload);
    let queued = true;
    for (const peer of this.peers.values()) {
      if (peer.sync?.readyState === 'open' && canSend(peer.metadata)) {
        const channel = encoded.length > TRANSFER_CHUNK_SIZE && peer.bulk?.readyState === 'open' ? 'agora-bulk' : 'agora-sync';
        queued = this.#enqueue(peer, channel, encoded) && queued;
      }
    }
    return queued;
  }

  sendToPeer(peerId, payload, channelName = 'agora-sync') {
    const peer = this.peers.get(peerId);
    if (channelName === 'agora-cursor') {
      const channel = peer?.cursor;
      if (!channel || channel.readyState !== 'open') return false;
      try { channel.send(JSON.stringify(payload)); return true; } catch { return false; }
    }
    const encoded = JSON.stringify(payload);
    const target = channelName === 'agora-bulk' || (encoded.length > TRANSFER_CHUNK_SIZE && peer?.bulk?.readyState === 'open')
      ? 'agora-bulk' : 'agora-sync';
    return Boolean(peer && this.#enqueue(peer, target, encoded));
  }

  #enqueue(peer, channelName, encoded) {
    if (encoded.length > MAX_TRANSFER_SIZE) return false;
    const isBulk = channelName === 'agora-bulk';
    const channel = isBulk ? peer.bulk : peer.sync;
    if (!channel || channel.readyState !== 'open') return false;
    const queueName = isBulk ? 'bulkQueue' : 'syncQueue';
    const sizeName = isBulk ? 'bulkQueuedSize' : 'syncQueuedSize';
    const frames = [];
    if (encoded.length <= TRANSFER_CHUNK_SIZE) frames.push(encoded);
    else {
      const transferId = globalThis.crypto?.randomUUID?.() || `transfer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const count = Math.ceil(encoded.length / TRANSFER_CHUNK_SIZE);
      for (let index = 0; index < count; index += 1) {
        frames.push(JSON.stringify({
          type: TRANSFER_CHUNK_TYPE,
          transfer_id: transferId,
          chunk_index: index,
          chunk_count: count,
          chunk: encoded.slice(index * TRANSFER_CHUNK_SIZE, (index + 1) * TRANSFER_CHUNK_SIZE),
        }));
      }
    }
    const queuedSize = frames.reduce((total, frame) => total + frame.length, 0);
    if (peer[sizeName] + queuedSize > MAX_QUEUED_SIZE) return false;
    peer[queueName].push(...frames);
    peer[sizeName] += queuedSize;
    this.#flushQueue(peer, channelName);
    return true;
  }

  #flushQueue(peer, channelName) {
    const isBulk = channelName === 'agora-bulk';
    const channel = isBulk ? peer.bulk : peer.sync;
    const queue = isBulk ? peer.bulkQueue : peer.syncQueue;
    const sizeName = isBulk ? 'bulkQueuedSize' : 'syncQueuedSize';
    if (!channel || channel.readyState !== 'open') return;
    while (queue.length && channel.bufferedAmount < QUEUE_HIGH_WATER) {
      const frame = queue[0];
      try { channel.send(frame); } catch { return; }
      queue.shift();
      peer[sizeName] = Math.max(0, peer[sizeName] - frame.length);
    }
  }

  #receiveTransferChunk(peer, message) {
    const transferId = message.transfer_id;
    const index = message.chunk_index;
    const count = message.chunk_count;
    const chunk = message.chunk;
    if (typeof transferId !== 'string' || transferId.length > 128
      || !Number.isSafeInteger(index) || !Number.isSafeInteger(count)
      || count < 2 || count > Math.ceil(MAX_TRANSFER_SIZE / TRANSFER_CHUNK_SIZE)
      || index < 0 || index >= count || typeof chunk !== 'string' || chunk.length > TRANSFER_CHUNK_SIZE) return null;
    const now = Date.now();
    for (const [id, transfer] of peer.incomingTransfers) {
      if (now - transfer.startedAt > 30000) peer.incomingTransfers.delete(id);
    }
    let transfer = peer.incomingTransfers.get(transferId);
    if (!transfer) {
      if (peer.incomingTransfers.size >= 4) peer.incomingTransfers.delete(peer.incomingTransfers.keys().next().value);
      transfer = { count, parts: new Array(count), received: 0, size: 0, startedAt: now };
      peer.incomingTransfers.set(transferId, transfer);
    }
    if (transfer.count !== count || transfer.parts[index] !== undefined) return null;
    transfer.parts[index] = chunk;
    transfer.received += 1;
    transfer.size += chunk.length;
    if (transfer.size > MAX_TRANSFER_SIZE) {
      peer.incomingTransfers.delete(transferId);
      return null;
    }
    if (transfer.received !== transfer.count) return null;
    peer.incomingTransfers.delete(transferId);
    try { return JSON.parse(transfer.parts.join('')); } catch { return null; }
  }

  sendCursor(payload) {
    const encoded = JSON.stringify(payload);
    for (const peer of this.peers.values()) {
      if (peer.cursor?.readyState === 'open') peer.cursor.send(encoded);
    }
  }

  sendLaser(payload) {
    const encoded = JSON.stringify(payload);
    for (const peer of this.peers.values()) {
      if (peer.cursor?.readyState === 'open') peer.cursor.send(encoded);
    }
  }

  getOpenPeerCount() {
    let count = 0;
    for (const peer of this.peers.values()) {
      if (peer.sync?.readyState === 'open' && peer.bulk?.readyState === 'open') count += 1;
    }
    return count;
  }

  #removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    this.peers.delete(peerId);
    peer.pc.onicecandidate = null;
    peer.pc.ondatachannel = null;
    peer.syncQueue.length = 0;
    peer.bulkQueue.length = 0;
    peer.incomingTransfers.clear();
    try { peer.sync?.close(); peer.bulk?.close(); peer.cursor?.close(); peer.pc.close(); } catch { /* already closed */ }
    this.#emitPeersChanged();
  }

  removePeer(peerId) {
    this.#removePeer(peerId);
  }

  #emitPeersChanged() {
    this.onPeersChanged?.([...this.peers.values()].map(({ metadata, sync, bulk }) => ({
      ...metadata,
      connected: sync?.readyState === 'open' && bulk?.readyState === 'open',
    })));
  }

  close() {
    this.closed = true;
    for (const peerId of this.peers.keys()) this.#removePeer(peerId);
  }
}
