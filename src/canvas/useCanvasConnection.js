import {canvasCodecUrl,installSocketCodec} from './sync/socketCodec.js';
import { registerGroupLayout } from './permissions/groupBits.js';
import { RtcMembershipRecovery } from './RtcMembershipRecovery.js';
import { useEffect, useRef } from 'react';
import { retryableConnectionError } from './connectionRetry.js';
import CanvasBrokerPeers from '../components/CanvasBrokerPeers.js';
import { api, canvasSocketUrl, rtcSocketUrl } from '../api/client.js';
import { canvasPasswordGrantKey, readCanvasPasswordGrant, saveCanvasPasswordGrant } from './canvasAccess.js';
import { mergeChatEntries, toChatEntry } from './canvasChat.js';
import {
  compareSyncVersions,
  nextPeerSyncVersion,
} from './collaborativeSync.js';
import { createId } from './canvasIds.js';

export function useCanvasConnection(options) {
  const verifiedEntryRef = useRef(null);
  const rtcMembershipRetryRef = useRef(0);
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
      chatEventsRef,
      voiceCallRef,
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
      setGroups, setCapabilities,
      setHasOlderMessages,
      setItems,
      setLaserStrokes,
      setMessages,
      setChatMessageTotal,
      setPeerList,
      setReconnectEpoch,
      setRemoteDrawingStrokes,
      setRemoteEditors,
      setSettings,
      setSettingsPending,
      settingsRequestsRef,
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
      requestPassword,
      sendItemChange,
      sendStrokeFrameChanges,
      sendRaw,
      sendRtcRaw
    },
  } = options;

  useEffect(() => {
    let cancelled = false;
    const passwordAbort = new AbortController();
    const rtcMembershipRecovery = new RtcMembershipRecovery(sendRtcRaw);
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
        canvas_protocol: 2,
        canvas_transport: 'broker-v1',
        request_id: createId(),
        canvas_connection_id: canvasConnectionId,
        canvas_connection_hash: canvasConnectionHash,
      }));
      joinedCanvasConnectionId = canvasConnectionId;
    };
    const resetPeerMesh = (recoverable=false) => {
      if(recoverable)voiceCallRef?.current?.reconnect();else voiceCallRef?.current?.suspend();
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
        setChatMessageTotal(0);
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
        let passwordGrant = canvasSettings.password_protected && verifiedEntryRef.current === passwordGrantKey
          ? readCanvasPasswordGrant(passwordGrantKey)
          : null;
        if (!canvasSettings.password_protected || verifiedEntryRef.current !== passwordGrantKey) {
          saveCanvasPasswordGrant(passwordGrantKey, null);
          verifiedEntryRef.current = null;
        }

        let password;
        if (canvasSettings.password_protected) {
          if (!passwordGrant) {
            password = await requestPassword({canvasName:summary.canvas_name,signal:passwordAbort.signal});
            if(cancelled)return;
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
              verifiedEntryRef.current = passwordGrantKey;
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
            const passwordError = err.code === 'CANVAS_005'
              && !usingPasswordGrant
              ? '비밀번호가 올바르지 않습니다. 다시 입력해주세요.'
              : '';
            password = await requestPassword({canvasName:summary.canvas_name,error:passwordError,signal:passwordAbort.signal});
            if(cancelled)return;
            if (password === null) { navigate('/search'); return; }
          }
        }
        if (cancelled) return;
        socket = installSocketCodec(new WebSocket(canvasCodecUrl(`${canvasSocketUrl(canvasId, access.ws_port, access.canvas_access_token)}&client_id=${encodeURIComponent(hostSessionRef.current.clientId)}`)));
        wsRef.current = socket;
        rtcSocket = installSocketCodec(new WebSocket(canvasCodecUrl(rtcSocketUrl(canvasId, access.ws_port, access.canvas_access_token))));
        rtcWsRef.current = rtcSocket;
        const handleRtcMessage = (event) => {
          if(cancelled||rtcWsRef.current!==rtcSocket)return;
          let data;
          try { data = typeof event.data==='string'?JSON.parse(event.data):event.data; } catch { return; }
          voiceCallRef?.current?.handle(data);
          if (receiveServerEvent(data)) return;
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
            rtcMembershipRetryRef.current=0;
            let mesh = peerMeshRef.current;
            if (!mesh) {
              mesh = new CanvasBrokerPeers({
                sendSignal: sendRtcRaw,
                onData: receivePeerData,
                onLaser: receiveLaser,
                onCursor: (peer, cursor) => remoteCursorUpdaterRef.current?.(peer, cursor),
                onPeersChanged: (peers) => {
                  setPeerList(peers);
                  const activeIds = new Set(peers.map((peer) => peer.peer_id));
                  setRemoteEditors((current) => Object.fromEntries(Object.entries(current).filter(([peerId]) => activeIds.has(peerId))));
                  setLaserStrokes((current) => current.filter((stroke) => !stroke.peerId || activeIds.has(stroke.peerId)));
                },
              });
              peerMeshRef.current = mesh;
            }
            mesh.setInitialPeers(data.self_peer_id, data.peers);

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
          if (data.type === 'canvas_relay') {
            peerMeshRef.current?.handleRelay(data);
            return;
          }
          if (data.type === 'rtc_disconnected') {
            if (!autoReconnectRef.current || !canvasSnapshotLoadedRef.current) resetPeerMesh();
            return;
          }
          if(data.type==='error'&&canvasSnapshotLoadedRef.current&&['RTC_CANVAS_CONNECTION_INVALID','RTC_ALREADY_JOINED','SESSION_NOT_FOUND'].includes(data.code)){
            const attempt=Math.min(rtcMembershipRetryRef.current++,5);
            voiceCallRef?.current?.reconnect();requestServerReconnect({retry_after_ms:Math.min(500*2**attempt,15000)});return;
          }
          if (rtcMembershipRecovery.handle(data, hostSessionRef.current.term)) return;
          if (data.type === 'error' && (data.code?.startsWith('RTC_') || data.code?.startsWith('CANVAS_RELAY_') || ['HOST_FENCED', 'ITEM_ACCESS_DENIED', 'RATE_LIMITED'].includes(data.code))) {
            if (!autoReconnectRef.current) setToast(`브로커 연결 오류: ${data.code}`);
            if (data.code === 'RATE_LIMITED' || data.code?.startsWith('CANVAS_RELAY_')) requestServerReconnect({ retry_after_ms: 500 });
          }
        };
        rtcSocket.onmessage = handleRtcMessage;
        rtcSocket.onerror = () => {
          if (!cancelled && canvasSnapshotLoadedRef.current) requestServerReconnect({ retry_after_ms: 500 });
          if (!cancelled && !autoReconnectRef.current && wsRef.current?.readyState === WebSocket.OPEN) setToast('캔버스 브로커에 연결할 수 없습니다.');
        };
        rtcSocket.onclose = (event) => {
          if(cancelled||rtcWsRef.current!==rtcSocket)return;
          const recoverable=event.code!==1008&&canvasSnapshotLoadedRef.current;
          if(recoverable){voiceCallRef?.current?.reconnect();requestServerReconnect({retry_after_ms:500});}
          else{
            voiceCallRef?.current?.suspend();
            if(event.code===1008){autoReconnectRef.current=false;serverReconnectRequestedRef.current=false;if(reconnectTimer!==null){clearTimeout(reconnectTimer);reconnectTimer=null;}}
          }
          rtcWsRef.current = null;
          if (!autoReconnectRef.current || !canvasSnapshotLoadedRef.current) resetPeerMesh(recoverable);
          if (!autoReconnectRef.current && wsRef.current?.readyState === WebSocket.OPEN) setToast('캔버스 브로커 연결이 종료되었습니다.');
        };
        socket.onopen = () => {
          if (cancelled) return;
          setConnection('connecting');
          setError('');
        };
        socket.onmessage = (event) => {
          if(cancelled||wsRef.current!==socket)return;
          let data;
          try { data = typeof event.data==='string'?JSON.parse(event.data):event.data; } catch { return; }
          if (receiveServerEvent(data)) return;
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
            // Durable server receipt prevents replaying already saved drafts.
            setItems(initialItems, data);
            canvasSnapshotLoadedRef.current = true;
            serverReconnectRequestedRef.current = false;
            autoReconnectRef.current = false;
            reconnectAttemptsRef.current = 0;
            setConnection('connected');
            const currentGroups = Array.isArray(data.groups) ? data.groups : [];
            registerGroupLayout(currentGroups,data.group_bits);
            groupsRef.current = currentGroups;
            setGroups(currentGroups);
            setCapabilities?.({group_bits:data.group_bits,group_masks:data.group_masks,groups:currentGroups,member_groups:Array.isArray(data.member_groups)?data.member_groups:currentGroups,write_groups:Array.isArray(data.write_groups)?data.write_groups:currentGroups,execute_groups:Array.isArray(data.execute_groups)?data.execute_groups:currentGroups,is_admin:data.is_admin===true});
            setCanvas((current) => ({ ...current, canvas_name: data.canvas_name || current?.canvas_name }));
            canvasConnectionId = data.rtc_canvas_connection_id == null ? '' : String(data.rtc_canvas_connection_id);
            canvasConnectionHash = typeof data.rtc_canvas_connection_hash === 'string' ? data.rtc_canvas_connection_hash : '';
            if (!canvasConnectionId || !canvasConnectionHash) setToast('RTC 연결 증명값을 받지 못했습니다. 페이지를 새로고침해주세요.');
            joinRtcSocket();
            sendRaw({ type: 'canvas_settings_get' });
            requestChatHistory();
            return;
          }
          if (data.type === 'canvas_access_revoked') {
            cancelled = true;
            passwordAbort.abort();
            autoReconnectRef.current = false;
            if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            groupsRef.current = [];
            setGroups([]);
            setCapabilities?.({groups:[],member_groups:[],write_groups:[],execute_groups:[],is_admin:false});
            replacePersistedItems({});
            pendingItemChangesRef.current = [];
            setItems({});
            resetPeerMesh();
            setConnection('error');
            setError('캔버스 접근 권한이 회수되었습니다. 관리자에게 초대를 요청하세요.');
            rtcSocket?.close();
            socket.close();
            return;
          }
          if (data.type === 'canvas_access_changed') {
            const currentGroups = Array.isArray(data.groups) ? data.groups : [];
            registerGroupLayout(currentGroups, data.group_bits);
            groupsRef.current = currentGroups;
            setGroups(currentGroups);
            setCapabilities?.({group_bits:data.group_bits,group_masks:data.group_masks,groups:currentGroups,member_groups:data.member_groups||[],write_groups:data.write_groups||[],execute_groups:data.execute_groups||[],is_admin:data.is_admin===true});
            setSettings(data.settings);
            setCanvas(current => ({...current,canvas_name:data.settings?.canvas_name||current?.canvas_name,description:data.settings?.description??current?.description}));
            return;
          }
          if (data.type === 'canvas_settings_snapshot' || data.type === 'canvas_settings_changed') {
            setSettings(data.settings);
            setCanvas((current) => ({ ...current, canvas_name: data.settings?.canvas_name || current?.canvas_name, description: data.settings?.description ?? current?.description }));
            return;
          }
          if (data.type === 'canvas_settings_result') {
            const request=settingsRequestsRef?.current.get(data.request_id);
            if(request){clearTimeout(request.timer);settingsRequestsRef.current.delete(data.request_id);if(data.ok)request.resolve(data.settings);else{const error=new Error(data.code||'SETTINGS_INVALID_INPUT');error.code=data.code;request.reject(error);}}
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
            if (data.object_id) { chatEventsRef.current?.receiveHistory(data); return; }
            if (chatHistoryRequestRef.current && data.request_id !== chatHistoryRequestRef.current) return;
            chatHistoryRequestRef.current = null;
            setChatHistoryLoading(false);
            const entries = Array.isArray(data.messages) ? data.messages.map((entry) => toChatEntry(entry, user)) : [];
            setMessages((current) => mergeChatEntries(current, entries));
            const previousPage = chatHistoryPageRef.current;
            const total = Math.max(previousPage.total || 0, Number(data.total) || 0, entries.length);
            const lastSequence = Math.max(previousPage.lastSequence || 0, ...entries.map(entry => entry.sequence || 0));
            setChatMessageTotal(total);
            const nextToSequence = Number(data.next_to_sequence);
            const hasMore = Boolean(data.has_more) && Number.isFinite(nextToSequence) && nextToSequence > 0;
            chatHistoryPageRef.current = { hasMore, nextToSequence: hasMore ? nextToSequence : null, total, lastSequence };
            setHasOlderMessages(hasMore);
            return;
          }
          if (data.type === 'chat') {
            if (data.object_id) { chatEventsRef.current?.receiveComment(data); return; }
            const entry = toChatEntry(data, user);
            const page = chatHistoryPageRef.current;
            if (entry.sequence && entry.sequence > (page.lastSequence || 0)) {
              page.lastSequence = entry.sequence;
              page.total = (page.total || 0) + 1;
              setChatMessageTotal(page.total);
            }
            setMessages((current) => mergeChatEntries(current, [entry]));
            chatEventsRef.current?.notify(entry);
            return;
          }
          if (data.type === 'event_ack') { chatEventsRef.current?.receiveAck(data); return; }
          if (data.type === 'mentions_snapshot') { chatEventsRef.current?.receiveMentions(data); return; }
          if (data.type === 'mentions_changed') { chatEventsRef.current?.refreshMentions(); return; }
          if (data.type === 'mention_read') { chatEventsRef.current?.receiveMentionRead(data); return; }
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
            chatEventsRef.current?.receiveError(data);
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
            requestServerReconnect({retry_after_ms:nextReconnectDelay()});
          }
        };
        socket.onclose = (event) => {
          if(cancelled||wsRef.current!==socket)return;
          if(event.code===1008){autoReconnectRef.current=false;serverReconnectRequestedRef.current=false;if(reconnectTimer!==null){clearTimeout(reconnectTimer);reconnectTimer=null;}}
          if (wsRef.current === socket) wsRef.current = null;
          if (!cancelled && event.code === 1012) requestServerReconnect({ retry_after_ms: 0 });
          if(!cancelled && !canvasSnapshotLoadedRef.current && event.code!==1008 && !autoReconnectRef.current)requestServerReconnect({retry_after_ms:nextReconnectDelay()});
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
              voiceCallRef?.current?.reconnect();
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
        if(!cancelled && [401,403,404].includes(err.status)){
          voiceCallRef?.current?.suspend();
          autoReconnectRef.current=false;serverReconnectRequestedRef.current=false;
          setConnection('disconnected');setError(err.message);
        } else if(!cancelled && retryableConnectionError(err)){
          requestServerReconnect({retry_after_ms:nextReconnectDelay()});
        } else if (!cancelled && autoReconnectRef.current) {
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
      passwordAbort.abort();
      rtcMembershipRecovery.dispose();
      const preservePeerMesh = autoReconnectRef.current && canvasSnapshotLoadedRef.current && reconnectTimer === null;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      rtcReady = false;
      canvasConnectionId = '';
      canvasConnectionHash = '';
      joinedCanvasConnectionId = '';
      voiceCallRef?.current?.reconnect();
      if (!preservePeerMesh) resetPeerMesh(true);
      if (rtcSocket && rtcSocket.readyState !== WebSocket.CLOSED) {
        if (preservePeerMesh) {
          rtcSocket.onopen = null;
          rtcSocket.onmessage = null;
          rtcSocket.onerror = null;
          rtcSocket.onclose = null;
          voiceCallRef?.current?.reconnect();
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
  }, [acknowledgeServerChange, broadcastEditorPresence, broadcastPeerItemState, canvasId, getCollaborativeDoc, getPendingServerChanges, markItemDirty, navigate, receiveLaser, receivePeerData, reconnectEpoch, refreshSpatialIndex, rejectServerChange, replacePersistedItems, requestChatHistory, requestPassword, sendItemChange, sendStrokeFrameChanges, sendRaw, sendRtcRaw, token, user]);
}
