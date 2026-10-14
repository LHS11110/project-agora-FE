// Canvas collaboration uses the authenticated room broker. WebRTC signaling is
// reserved for call media and never carries document or presence data.
export default class CanvasBrokerPeers {
  constructor({ sendSignal, onData, onCursor, onLaser, onPeersChanged }) {
    Object.assign(this, { sendSignal, onData, onCursor, onLaser, onPeersChanged });
    this.selfPeerId = '';
    this.peers = new Map();
    this.closed = false;
  }

  setInitialPeers(selfPeerId, peers = []) {
    this.selfPeerId = selfPeerId || '';
    this.peers.clear();
    for (const peer of peers) {
      if (peer?.peer_id && peer.peer_id !== this.selfPeerId) this.peers.set(peer.peer_id, { ...peer });
    }
    this.emitPeersChanged();
  }

  addPeer(peer) {
    if (this.closed || !peer?.peer_id || peer.peer_id === this.selfPeerId) return;
    this.peers.set(peer.peer_id, { ...this.peers.get(peer.peer_id), ...peer });
    this.emitPeersChanged();
  }

  removePeer(peerId) {
    this.peers.delete(peerId);
    this.emitPeersChanged();
  }

  handleRelay(message) {
    const peer = this.peers.get(message.peer?.peer_id);
    const payload = message.payload;
    if (this.closed || !peer || !payload || typeof payload.type !== 'string') return;
    if (payload.type === 'cursor') this.onCursor?.(peer, payload);
    else if (payload.type === 'laser') this.onLaser?.(peer, payload);
    else this.onData?.(peer, payload, 'broker');
  }

  relay(payload, peerIds) {
    if (this.closed) return false;
    if (!peerIds.length) return true;
    return this.sendSignal({ type: 'canvas_relay', peer_ids: peerIds, payload }) === true;
  }

  sendData(payload, canSend = () => true) {
    // HostCanvasSession replicates persistent edits with ordered commits.
    if (payload.type !== 'editor_presence') return true;
    return this.relay(payload, [...this.peers.values()].filter(canSend).map(peer => peer.peer_id));
  }

  sendRealtimeData(payload, canSend = () => true) {
    if (!['cursor', 'laser'].includes(payload.type)) return true;
    return this.relay(payload, [...this.peers.values()].filter(canSend).map(peer => peer.peer_id));
  }

  sendToPeer(peerId, payload) {
    if (!['editor_presence', 'cursor', 'laser'].includes(payload.type)) return true;
    return this.peers.has(peerId) && this.relay(payload, [peerId]);
  }

  sendHostData(peerId, payload) {
    return this.peers.has(peerId) && this.relay(payload, [peerId]);
  }

  sendCursor(payload) { return this.sendRealtimeData(payload); }
  sendLaser(payload) { return this.sendRealtimeData(payload); }
  getOpenPeerCount() { return this.closed ? 0 : this.peers.size; }
  isPeerConnected(peerId) { return !this.closed && this.peers.has(peerId); }
  emitPeersChanged() {
    this.onPeersChanged?.([...this.peers.values()].map(peer => ({ ...peer, connected: !this.closed })));
  }
  close() {
    this.closed = true;
    this.peers.clear();
    this.emitPeersChanged();
  }
}
