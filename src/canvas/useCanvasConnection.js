import { useEffect } from 'react';
import CanvasPeerMesh from '../components/CanvasPeerMesh.js';
import { api, canvasSocketUrl, rtcSocketUrl } from '../api/client.js';
import { canvasPasswordGrantKey, readCanvasPasswordGrant, saveCanvasPasswordGrant } from './canvasAccess.js';
import { mergeChatEntries, toChatEntry } from './canvasChat.js';
import {
  compareSyncVersions,
  nextPeerSyncVersion,
} from './collaborativeSync.js';
import { createId } from './canvasIds.js';

export function useCanvasConnection(options) {
  const {
    identity: {
      canvasId,
      navigate,
      permission,
      reconnectEpoch,
      token,
      user
    },
    refs: {
      autoReconnectRef,
      canvasSnapshotLoadedRef,
      chatHistoryPageRef,
      chatHistoryRequestRef,
      collaborativeBaseDocsRef,
      collaborativeDocsRef,
      deletedItemSyncVersionsRef,
      dirtyItemsRef,
      draftRef,
      dragRef,
      drawingSessionRef,
      editingIdRef,
      groupsRef,
      itemEditRevisionRef,
      itemSyncVersionsRef,
      itemsRef,
      newCollaborativeItemsRef,
      peerMeshRef,
      hostSessionRef,
      pendingItemChangesRef,
      pendingPeerItemEventsRef,
      pendingPeerItemEventsSizeRef,
      reconnectAttemptsRef,
      reconnectRequestRef,
      rejectedEventPongsRef,
      remoteCursorUpdaterRef,
      remoteDrawingStrokesRef,
      rtcWsRef,
      serverReconnectRequestedRef,
      stageOfflineGeometryRef,
      syncActorRef,
      syncClockRef,
      syncedPeersRef,
      strokeSaveFlushRef,
      wsRef
    },
    setters: {
      setCanvas,
      setChatHistoryLoading,
      setConnection,
      setDirtyItems,
      setError,
      setGroups,
      setHasOlderMessages,
      setItems,
      setLaserStrokes,
      setMessages,
      setPeerList,
      setReconnectEpoch,
      setRemoteDrawingStrokes,
      setRemoteEditors,
      setSettings,
      setSettingsPending,
      setToast
    },
    actions: {
      acknowledgeServerChange,
      broadcastEditorPresence,
      broadcastPeerItemState,
      getCollaborativeDoc,
      getPendingServerChanges,
      markItemDirty,
      receiveLaser,
      receivePeerData,
      receiveServerEvent,
      refreshSpatialIndex,
      rejectServerChange,
      replacePersistedItems,
      requestChatHistory,
      sendItemChange,
      sendStrokeFrameChanges,
      sendRaw,
      sendRtcRaw
    },
  } = options;

  useEffect(() => {
    let cancelled = false;
    let socket;
    let rtcSocket;
    let reconnectTimer = null;
    let rtcReady = false;
    let canvasConnectionId = '';
    let canvasConnectionHash = '';
    let joinedCanvasConnectionId = '';
    const nextReconnectDelay = () => {
      const attempt = Math.min(reconnectAttemptsRef.current, 5);
      reconnectAttemptsRef.current += 1;
      return Math.min(1000 * (2 ** attempt), 15000);
    };
    const scheduleReconnect = (delayMs = 0) => {
      if (cancelled || reconnectTimer !== null || !autoReconnectRef.current) return false;
      const delay = Number.isFinite(Number(delayMs)) ? Math.max(0, Math.min(30000, Number(delayMs))) : 0;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (!cancelled) setReconnectEpoch((current) => current + 1);
      }, delay);
      return true;
    };
    const requestServerReconnect = (signal = {}) => {
      if (cancelled) return;
      setConnection('connecting');
      if (serverReconnectRequestedRef.current && autoReconnectRef.current) {
        if (reconnectTimer === null) scheduleReconnect(nextReconnectDelay());
        return;
      }
      if (!autoReconnectRef.current) reconnectAttemptsRef.current = 0;
      autoReconnectRef.current = true;
      serverReconnectRequestedRef.current = true;
      const activeDrag = dragRef.current;
      if (activeDrag?.mode === 'multi-move') {
        for (const id of activeDrag.ids || []) stageOfflineGeometryRef.current?.(id, itemsRef.current[String(id)]);
      } else if (activeDrag?.id != null) {
        stageOfflineGeometryRef.current?.(activeDrag.id, itemsRef.current[String(activeDrag.id)]);
      }
      setError('');
      scheduleReconnect(signal.retry_after_ms ?? 0);
    };
    reconnectRequestRef.current = requestServerReconnect;
    const joinRtcSocket = () => {
      if (!rtcReady || !canvasConnectionId || !canvasConnectionHash || !rtcSocket || rtcSocket.readyState !== WebSocket.OPEN
        || joinedCanvasConnectionId === canvasConnectionId) return;
      rtcSocket.send(JSON.stringify({
        type: 'rtc_join',
        host_protocol: 1,
        request_id: createId(),
        canvas_connection_id: canvasConnectionId,
        canvas_connection_hash: canvasConnectionHash,
      }));
      joinedCanvasConnectionId = canvasConnectionId;
    };
    const resetPeerMesh = () => {
      hostSessionRef.current.pause();
      if (peerMeshRef.current) peerMeshRef.current.close();
      peerMeshRef.current = null;
      syncedPeersRef.current.clear();
      remoteDrawingStrokesRef.current.clear();
      setPeerList([]);
      setRemoteEditors({});
      setRemoteDrawingStrokes([]);
    };
    async function connect() {
      if (!canvasSnapshotLoadedRef.current) {
        setConnection('connecting');
        setMessages([]);
        setHasOlderMessages(false);
        setChatHistoryLoading(false);
        chatHistoryRequestRef.current = null;
        chatHistoryPageRef.current = { hasMore: false, nextToSequence: null };
      }
      setError('');
      try {
        const summary = await api(`/api/canvases/${canvasId}`, { token });
        if (cancelled) return;
        setCanvas(summary);
        const canvasSettings = await api(`/api/canvases/${canvasId}/settings`, { token });
        if (cancelled) return;
        setSettings(canvasSettings);

        const passwordGrantKey = canvasPasswordGrantKey(canvasId, user);
        let passwordGrant = canvasSettings.password_protected
          ? readCanvasPasswordGrant(passwordGrantKey)
          : null;
        if (!canvasSettings.password_protected) saveCanvasPasswordGrant(passwordGrantKey, null);

        let password;
        if (canvasSettings.password_protected) {
          if (!passwordGrant) {
            password = window.prompt('이 캔버스의 비밀번호를 입력해주세요.');
            if (password === null) { navigate('/search'); return; }
          }
        }

        let access;
        let serverAccessRetry = 0;
        while (!access) {
          const usingPasswordGrant = Boolean(passwordGrant);
          const body = usingPasswordGrant
            ? { canvas_password_token: passwordGrant }
            : password === undefined ? undefined : { password };
          try {
            access = await api(`/api/canvases/${canvasId}/access`, {
              method: 'POST', token, ...(body ? { body } : {}),
            });
            serverAccessRetry = 0;
            if (canvasSettings.password_protected) {
              saveCanvasPasswordGrant(passwordGrantKey, access.canvas_password_token);
            }
          } catch (err) {
            if (['LB_001', 'LB_003'].includes(err.code) && serverAccessRetry < 5) {
              const retryDelay = Math.min(300 * (2 ** serverAccessRetry), 2000);
              serverAccessRetry += 1;
              if (!canvasSnapshotLoadedRef.current) setToast('실시간 서버가 준비 중이에요. 잠시 후 자동으로 다시 연결합니다.');
              await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
              if (cancelled) return;
              continue;
            }
            if (!['CANVAS_004', 'CANVAS_005'].includes(err.code)) throw err;
            if (usingPasswordGrant) {
              passwordGrant = null;
              saveCanvasPasswordGrant(passwordGrantKey, null);
            }
            const prompt = err.code === 'CANVAS_005'
              && !usingPasswordGrant
              ? '비밀번호가 올바르지 않습니다. 다시 입력해주세요.'
              : '이 캔버스의 비밀번호를 입력해주세요.';
            password = window.prompt(prompt);
            if (password === null) { navigate('/search'); return; }
          }
        }
        if (cancelled) return;
        socket = new WebSocket(canvasSocketUrl(canvasId, access.ws_port, access.canvas_access_token));
        wsRef.current = socket;
        rtcSocket = new WebSocket(rtcSocketUrl(canvasId, access.ws_port, access.canvas_access_token));
        rtcWsRef.current = rtcSocket;
        const handleRtcMessage = (event) => {
          let data;
          try { data = JSON.parse(event.data); } catch { return; }
          receiveServerEvent(data);
          if (data.type === 'server_reconnect') {
            requestServerReconnect(data);
            return;
          }
          if (data.type === 'rtc_ready') {
            rtcReady = true;
            joinRtcSocket();
            return;
          }
          if (data.type === 'rtc_peers') {
            let mesh = peerMeshRef.current;
            if (!mesh) {
              mesh = new CanvasPeerMesh({
                sendSignal: sendRtcRaw,
                onData: receivePeerData,
                onLaser: receiveLaser,
                onCursor: (peer, cursor) => remoteCursorUpdaterRef.current?.(peer, cursor),
                onPeersChanged: (peers) => {
                  setPeerList(peers);
                  const activeIds = new Set(peers.map((peer) => peer.peer_id));
                  const session = hostSessionRef.current;
                  const connectedIds = new Set(peers.filter(peer => peer.connected).map(peer => peer.peer_id));
                  const needed = session.isHost ? session.members.filter(peer => peer.peer_id !== session.selfId).map(peer => peer.peer_id) : [session.hostId].filter(Boolean);
                  if (needed.some(id => !connectedIds.has(id))) session.pause();
                  // A failed DataChannel is not proof of membership departure.
                  // Ask the signaling registry and rebuild its still-active peers.
                  if (!cancelled && !mesh?.closed && needed.some(id => !activeIds.has(id))) sendRtcRaw({ type: 'rtc_list' });
                  setRemoteEditors((current) => Object.fromEntries(Object.entries(current).filter(([peerId]) => activeIds.has(peerId))));
                  setLaserStrokes((current) => current.filter((stroke) => !stroke.peerId || activeIds.has(stroke.peerId)));
                },
              });
              peerMeshRef.current = mesh;
            }
            mesh.setInitialPeers(data.self_peer_id, data.peers);
            hostSessionRef.current.configure(data.self_peer_id, data.host);
            return;
          }
          if (data.type === 'rtc_host_changed') {
            const mesh = peerMeshRef.current;
            if (mesh) hostSessionRef.current.configure(mesh.selfPeerId, data.host);
            return;
          }
          if (data.type === 'rtc_peer_joined') {
            peerMeshRef.current?.addPeer(data.peer);
            return;
          }
          if (data.type === 'rtc_peer_left') {
            peerMeshRef.current?.removePeer(data.peer_id);
            syncedPeersRef.current.delete(data.peer_id);
            setRemoteEditors((current) => { const next = { ...current }; delete next[data.peer_id]; return next; });
            return;
          }
          if (data.type === 'rtc_signal') {
            void peerMeshRef.current?.handleSignal(data);
            return;
          }
          if (data.type === 'rtc_disconnected') {
            if (!autoReconnectRef.current || !canvasSnapshotLoadedRef.current) resetPeerMesh();
            return;
          }
          if (data.type === 'error' && data.code?.startsWith('RTC_')) {
            if (!autoReconnectRef.current) setToast(`P2P 연결 오류: ${data.code}`);
          }
        };
        rtcSocket.onmessage = handleRtcMessage;
        rtcSocket.onerror = () => {
          if (!cancelled && !autoReconnectRef.current && wsRef.current?.readyState === WebSocket.OPEN) setToast('P2P 신호 서버에 연결할 수 없습니다.');
        };
        rtcSocket.onclose = () => {
          if (rtcWsRef.current === rtcSocket) rtcWsRef.current = null;
          if (!autoReconnectRef.current || !canvasSnapshotLoadedRef.current) resetPeerMesh();
          if (!cancelled && !autoReconnectRef.current && wsRef.current?.readyState === WebSocket.OPEN) setToast('P2P 신호 연결이 종료되었습니다.');
        };
        socket.onopen = () => {
          if (cancelled) return;
          setConnection('connecting');
          setError('');
        };
        socket.onmessage = (event) => {
          let data;
          try { data = JSON.parse(event.data); } catch { return; }
          receiveServerEvent(data);
          if (data.type === 'server_reconnect') {
            requestServerReconnect(data);
            return;
          }
          if (data.type === 'init_items') {
            strokeSaveFlushRef.current?.({ force: true });
            const initialItems = data.items && typeof data.items === 'object' ? data.items : {};
            replacePersistedItems(initialItems);
            pendingItemChangesRef.current = [];
            itemSyncVersionsRef.current = new Map();
            deletedItemSyncVersionsRef.current.clear();
            collaborativeDocsRef.current.clear();
            collaborativeBaseDocsRef.current.clear();
            dirtyItemsRef.current = new Set();
            setDirtyItems(new Set());
            // Only stored baseline enters the coordinator; reconnect drafts never
            // masquerade as approved state. Its prior approved records are retained.
            setItems(initialItems);
            canvasSnapshotLoadedRef.current = true;
            serverReconnectRequestedRef.current = false;
            autoReconnectRef.current = false;
            reconnectAttemptsRef.current = 0;
            setConnection('connected');
            const currentGroups = Array.isArray(data.groups) ? data.groups : [];
            groupsRef.current = currentGroups;
            setGroups(currentGroups);
            setCanvas((current) => ({ ...current, canvas_name: data.canvas_name || current?.canvas_name }));
            canvasConnectionId = data.rtc_canvas_connection_id == null ? '' : String(data.rtc_canvas_connection_id);
            canvasConnectionHash = typeof data.rtc_canvas_connection_hash === 'string' ? data.rtc_canvas_connection_hash : '';
            if (!canvasConnectionId || !canvasConnectionHash) setToast('RTC 연결 증명값을 받지 못했습니다. 페이지를 새로고침해주세요.');
            joinRtcSocket();
            sendRaw({ type: 'canvas_settings_get' });
            requestChatHistory();
            return;
          }
          if (data.type === 'canvas_settings_snapshot' || data.type === 'canvas_settings_changed') {
            setSettings(data.settings);
            setCanvas((current) => ({ ...current, canvas_name: data.settings?.canvas_name || current?.canvas_name, description: data.settings?.description ?? current?.description }));
            return;
          }
          if (data.type === 'canvas_settings_result') {
            setSettingsPending(false);
            if (data.settings) setSettings(data.settings);
            setToast(data.ok ? '설정이 업데이트되었습니다.' : data.code === 'SETTINGS_CONFLICT' ? '다른 변경사항이 먼저 저장되어 최신 정보를 불러왔어요.' : `설정 변경 실패: ${data.code || '오류'}`);
            window.setTimeout(() => setToast(''), 3400);
            return;
          }
          if (data.type === 'item_crdt_change') return;
          if (data.type === 'host_batch_result') return;
          if (['item_update', 'item_add', 'update_item', 'item_save', 'item_delete', 'delete_item'].includes(data.type)) return;
          if (data.type === 'chat_history') {
            if (chatHistoryRequestRef.current && data.request_id !== chatHistoryRequestRef.current) return;
            chatHistoryRequestRef.current = null;
            setChatHistoryLoading(false);
            const entries = Array.isArray(data.messages) ? data.messages.map((entry) => toChatEntry(entry, user)) : [];
            setMessages((current) => mergeChatEntries(current, entries));
            const nextToSequence = Number(data.next_to_sequence);
            const hasMore = Boolean(data.has_more) && Number.isFinite(nextToSequence) && nextToSequence > 0;
            chatHistoryPageRef.current = { hasMore, nextToSequence: hasMore ? nextToSequence : null };
            setHasOlderMessages(hasMore);
            return;
          }
          if (data.type === 'chat') {
            setMessages((current) => mergeChatEntries(current, [toChatEntry(data, user)]));
            return;
          }
          if (data.type === 'pong') {
            if (rejectedEventPongsRef.current > 0) rejectedEventPongsRef.current -= 1;
            else {
              const accepted = pendingItemChangesRef.current.shift();
              acknowledgeServerChange(accepted);
              if (accepted?.type === 'item_save'
                && (itemEditRevisionRef.current.get(accepted.id) || 0) === accepted.editRevision) {
                dirtyItemsRef.current = new Set(dirtyItemsRef.current);
                dirtyItemsRef.current.delete(accepted.id);
                setDirtyItems((current) => { const next = new Set(current); next.delete(accepted.id); return next; });
              }
            }
            return;
          }
          if (data.type === 'error') {
            if (['ITEM_BATCH_INVALID', 'RATE_LIMITED'].includes(data.code) && pendingItemChangesRef.current.length) {
              requestServerReconnect({ retry_after_ms: 250 });
              return;
            }
            if (chatHistoryRequestRef.current && data.request_id === chatHistoryRequestRef.current) {
              chatHistoryRequestRef.current = null;
              setChatHistoryLoading(false);
              if (data.code === 'CHAT_ROOM_NOT_FOUND') {
                chatHistoryPageRef.current = { hasMore: false, nextToSequence: null };
                setHasOlderMessages(false);
                return;
              }
              setToast(data.code === 'ITEM_ACCESS_DENIED' ? '이 채팅방의 내역을 볼 권한이 없습니다.' : `채팅 내역을 불러오지 못했습니다: ${data.code || '오류'}`);
              return;
            }
            if (data.code?.startsWith('CHAT_')) {
              setToast(`채팅을 처리하지 못했습니다: ${data.code}`);
              return;
            }
            if (['ITEM_ACCESS_DENIED', 'ITEM_SAVE_INVALID', 'ITEM_SAVE_REQUIRED'].includes(data.code)) {
              const rejected = pendingItemChangesRef.current.shift();
              if (rejected) {
                rejectServerChange(rejected);
                rejectedEventPongsRef.current += 1;
                if (rejected.type === 'item_save') {
                  markItemDirty(rejected.id);
                  if (rejected.wasNewCollaborative) newCollaborativeItemsRef.current.add(rejected.id);
                } else {
                  const currentVersion = itemSyncVersionsRef.current.get(rejected.id);
                  const isLatestRejectedChange = rejected.syncVersion
                    && compareSyncVersions(currentVersion, rejected.syncVersion) === 0;
                  if (!rejected.syncVersion || isLatestRejectedChange) {
                    const next = { ...itemsRef.current };
                    if (rejected.previous == null) delete next[rejected.id];
                    else next[rejected.id] = rejected.previous;
                    itemsRef.current = next;
                    setItems(next);
                    refreshSpatialIndex();
                    if (isLatestRejectedChange) {
                      const correctionVersion = nextPeerSyncVersion(syncClockRef, syncActorRef);
                      itemSyncVersionsRef.current.set(rejected.id, correctionVersion);
                      if (rejected.previous == null) {
                        const permission = rejected.item?.permission;
                        deletedItemSyncVersionsRef.current.set(rejected.id, { version: correctionVersion, permission });
                        broadcastPeerItemState({ id: rejected.id, syncAction: 'delete', syncVersion: correctionVersion, permission });
                      } else {
                        deletedItemSyncVersionsRef.current.delete(rejected.id);
                        broadcastPeerItemState({ id: rejected.id, syncAction: 'upsert', syncVersion: correctionVersion, item: rejected.previous, previous: rejected.item });
                      }
                    }
                  }
                }
              }
            }
            setToast(data.code === 'ITEM_ACCESS_DENIED' ? '이 아이템을 수정할 권한이 없습니다.' : data.code === 'ITEM_SAVE_REQUIRED' ? 'Ctrl + S로 저장한 뒤 서버에 반영할 수 있습니다.' : data.message || data.code || '서버 오류가 발생했습니다.');
          }
        };
        socket.onerror = () => {
          if (cancelled) return;
          if (canvasSnapshotLoadedRef.current) {
            requestServerReconnect();
          } else if (autoReconnectRef.current) {
            if (reconnectTimer === null) scheduleReconnect(nextReconnectDelay());
          } else {
            setError('실시간 서버에 연결할 수 없습니다. 서버 주소와 WebSocket 설정을 확인해주세요.');
          }
        };
        socket.onclose = (event) => {
          if (wsRef.current === socket) wsRef.current = null;
          if (!cancelled && event.code === 1012) requestServerReconnect({ retry_after_ms: 0 });
          if (!cancelled && canvasSnapshotLoadedRef.current && event.code !== 1008 && !autoReconnectRef.current) {
            requestServerReconnect({ retry_after_ms: 0 });
          }
          const preservePeerMesh = !cancelled && autoReconnectRef.current && canvasSnapshotLoadedRef.current;
          chatHistoryRequestRef.current = null;
          setChatHistoryLoading(false);
          for (const pending of pendingItemChangesRef.current.splice(0)) {
            if (pending.type === 'item_save') {
              markItemDirty(pending.id);
              if (pending.wasNewCollaborative) newCollaborativeItemsRef.current.add(pending.id);
            }
          }
          rejectedEventPongsRef.current = 0;
          if (rtcSocket && rtcSocket.readyState !== WebSocket.CLOSED) {
            if (preservePeerMesh) {
              rtcSocket.onopen = null;
              rtcSocket.onmessage = null;
              rtcSocket.onerror = null;
              rtcSocket.onclose = null;
            }
            rtcSocket.close();
          }
          if (rtcWsRef.current === rtcSocket) rtcWsRef.current = null;
          rtcReady = false;
          canvasConnectionId = '';
          canvasConnectionHash = '';
          joinedCanvasConnectionId = '';
          if (!preservePeerMesh) resetPeerMesh();
          if (!cancelled && autoReconnectRef.current) {
            setConnection('connecting');
            if (reconnectTimer === null) scheduleReconnect(nextReconnectDelay());
          } else if (!cancelled) {
            setConnection('disconnected');
            if (event.code === 1008) setError('캔버스 권한이나 설정이 변경되었습니다. 다시 접속해주세요.');
          }
        };
      } catch (err) {
        if (!cancelled && autoReconnectRef.current) {
          setConnection('connecting');
          if (reconnectTimer === null) scheduleReconnect(nextReconnectDelay());
        } else if (!cancelled) {
          setConnection('disconnected');
          setError(err.message || '캔버스에 접속할 수 없습니다.');
        }
      }
    }
    connect();
    return () => {
      strokeSaveFlushRef.current?.({ force: true });
      cancelled = true;
      const preservePeerMesh = autoReconnectRef.current && canvasSnapshotLoadedRef.current && reconnectTimer === null;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      rtcReady = false;
      canvasConnectionId = '';
      canvasConnectionHash = '';
      joinedCanvasConnectionId = '';
      if (!preservePeerMesh) resetPeerMesh();
      if (rtcSocket && rtcSocket.readyState !== WebSocket.CLOSED) {
        if (preservePeerMesh) {
          rtcSocket.onopen = null;
          rtcSocket.onmessage = null;
          rtcSocket.onerror = null;
          rtcSocket.onclose = null;
        }
        rtcSocket.close();
      }
      if (rtcWsRef.current === rtcSocket) rtcWsRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
      if (wsRef.current === socket) wsRef.current = null;
    };
  }, [acknowledgeServerChange, broadcastEditorPresence, broadcastPeerItemState, canvasId, getCollaborativeDoc, getPendingServerChanges, markItemDirty, navigate, receiveLaser, receivePeerData, reconnectEpoch, refreshSpatialIndex, rejectServerChange, replacePersistedItems, requestChatHistory, sendItemChange, sendStrokeFrameChanges, sendRaw, sendRtcRaw, token, user]);
}
