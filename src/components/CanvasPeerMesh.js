const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

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
  constructor({ sendSignal, onData, onCursor, onPeersChanged }) {
    this.sendSignal = sendSignal;
    this.onData = onData;
    this.onCursor = onCursor;
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
    const peer = { metadata, pc, sync: null, cursor: null, pendingCandidates: [] };
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
    else if (channel.label === 'agora-cursor') peer.cursor = channel;
    channel.onopen = () => this.#emitPeersChanged();
    channel.onclose = () => this.#emitPeersChanged();
    channel.onerror = () => this.#emitPeersChanged();
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'cursor') this.onCursor?.(peer.metadata, message);
        else this.onData?.(peer.metadata, message, channel.label);
      } catch { /* Ignore malformed or stale peer frames. */ }
    };
  }

  sendData(payload, canSend = () => true) {
    const encoded = JSON.stringify(payload);
    for (const peer of this.peers.values()) {
      if (peer.sync?.readyState === 'open' && canSend(peer.metadata)) peer.sync.send(encoded);
    }
  }

  sendToPeer(peerId, payload, channelName = 'agora-sync') {
    const peer = this.peers.get(peerId);
    const channel = channelName === 'agora-cursor' ? peer?.cursor : peer?.sync;
    if (!channel || channel.readyState !== 'open') return false;
    channel.send(JSON.stringify(payload));
    return true;
  }

  sendCursor(payload) {
    const encoded = JSON.stringify(payload);
    for (const peer of this.peers.values()) {
      if (peer.cursor?.readyState === 'open') peer.cursor.send(encoded);
    }
  }

  getOpenPeerCount() {
    let count = 0;
    for (const peer of this.peers.values()) if (peer.sync?.readyState === 'open') count += 1;
    return count;
  }

  #removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    this.peers.delete(peerId);
    peer.pc.onicecandidate = null;
    peer.pc.ondatachannel = null;
    try { peer.sync?.close(); peer.cursor?.close(); peer.pc.close(); } catch { /* already closed */ }
    this.#emitPeersChanged();
  }

  removePeer(peerId) {
    this.#removePeer(peerId);
  }

  #emitPeersChanged() {
    this.onPeersChanged?.([...this.peers.values()].map(({ metadata, sync }) => ({
      ...metadata,
      connected: sync?.readyState === 'open',
    })));
  }

  close() {
    this.closed = true;
    for (const peerId of this.peers.keys()) this.#removePeer(peerId);
  }
}
