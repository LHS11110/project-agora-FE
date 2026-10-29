import { useCallback, useEffect, useRef, useState } from 'react';
import { createId } from '../canvasIds.js';
import { CHAT_HISTORY_LIMIT, mergeChatEntries, toChatEntry } from '../canvasChat.js';

export function useCommentsAndMentions({ sendRaw, connection, user, canvasId }) {
  const [activeId, setActiveId] = useState(null);
  const [threads, setThreads] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(null);
  const pending = useRef(new Map());
  const latest = useRef({});
  latest.current = { user, canvasId };
  const mentionRequest = useRef(null), mentionDirty = useRef(false);
  const pendingReads = useRef(new Map());
  const [jumpSequence, setJumpSequence] = useState(null);
  const [jumpNotification, setJumpNotification] = useState(null);
  const refreshMentions = useCallback(() => {
    if (mentionRequest.current) { mentionDirty.current = true; return; }
    const requestId = createId();
    if (sendRaw({ type: 'mentions_get', request_id: requestId })) mentionRequest.current = requestId;
  }, [sendRaw]);
  const receiveMentions = useCallback(data => {
    if (data.request_id !== mentionRequest.current) return;
    mentionRequest.current = null;
    setNotifications((data.notifications || []).filter(note => note.unread === true).map(note => ({
      ...toChatEntry(note, latest.current.user), key: note.mention_id,
      objectId: note.object_id || null, sequence: Number(note.sequence),
    })));
    if (mentionDirty.current) { mentionDirty.current = false; refreshMentions(); }
  }, [refreshMentions]);
  const dismiss = useCallback(notification => {
    if ([...pendingReads.current.values()].includes(notification.key)) return;
    const requestId = createId();
    if (sendRaw({ type: 'mention_read', mention_id: notification.key, request_id: requestId })) {
      pendingReads.current.set(requestId, notification.key);
    }
  }, [sendRaw]);
  const receiveMentionRead = useCallback(data => {
    pendingReads.current.delete(data.request_id);
    refreshMentions();
  }, [refreshMentions]);
  // Only the server decides which notifications exist and whether they were read.
  const notify = refreshMentions;
  useEffect(() => {
    mentionRequest.current = null; mentionDirty.current = false; pendingReads.current.clear();
    if (connection !== 'connected') return;
    refreshMentions();
    const timer = setInterval(() => { mentionRequest.current = null; refreshMentions(); }, 15000);
    return () => clearInterval(timer);
  }, [connection, refreshMentions]);
  const requestHistory = useCallback((objectId, toSequence, aroundSequence) => {
    if (!objectId) return false;
    const requestId = createId();
    const event = { type: 'chat_history', room_id: 'general', object_id: String(objectId), request_id: requestId };
    if (aroundSequence) { event.from_sequence = Math.max(1, aroundSequence - 10); event.to_sequence = aroundSequence + 10; }
    else if (toSequence) event.to_sequence = toSequence; else event.limit = CHAT_HISTORY_LIMIT;
    if (!sendRaw(event)) return false;
    pending.current.set(requestId, { objectId: String(objectId), history: true });
    setThreads(current => ({ ...current, [objectId]: { ...current[objectId], loading: true } }));
    return true;
  }, [sendRaw]);
  useEffect(() => {
    if (connection === 'connected' && activeId) requestHistory(activeId, null, jumpSequence);
  }, [activeId, connection, requestHistory, jumpSequence]);
  useEffect(() => {
    if (connection === 'connected' || !pending.current.size) return;
    const unsent = [...pending.current.values()].find(request => !request.history);
    pending.current.clear();
    setThreads(current => Object.fromEntries(Object.entries(current).map(([id, thread]) => [id, { ...thread, loading: false }])));
    if (unsent) {
      setDraft(current => current || unsent.text);
      setError('연결이 끊겨 댓글 전송 결과를 확인하지 못했습니다. 내용을 확인한 뒤 다시 보내주세요.');
    }
  }, [connection]);
  const receiveHistory = useCallback(data => {
    const objectId = String(data.object_id);
    if (!pending.current.has(data.request_id)) return;
    pending.current.delete(data.request_id);
    const entries = (Array.isArray(data.messages) ? data.messages : []).map(message => toChatEntry({ ...message, object_id: objectId }, latest.current.user));
    const next = Number(data.next_to_sequence);
    setThreads(current => ({ ...current, [objectId]: { entries: mergeChatEntries(current[objectId]?.entries || [], entries), loading: false,
      hasMore: Boolean(data.has_more) && Number.isFinite(next) && next > 0, nextToSequence: next } }));

  }, [notify]);
  const receiveComment = useCallback(data => {
    const objectId = String(data.object_id);
    const entry = toChatEntry(data, latest.current.user);
    setThreads(current => ({ ...current, [objectId]: { ...current[objectId], entries: mergeChatEntries(current[objectId]?.entries || [], [entry]) } }));
    refreshMentions();
  }, [refreshMentions]);
  const receiveError = useCallback(data => {
    if (data.request_id === mentionRequest.current) { mentionRequest.current = null; return; }
    if (pendingReads.current.delete(data.request_id)) { setError('멘션 읽음 상태를 저장하지 못했습니다. 다시 시도해주세요.'); return; }
    const request = pending.current.get(data.request_id);
    if (!request) return;
    pending.current.delete(data.request_id);
    if (request.history) setThreads(current => ({ ...current, [request.objectId]: { ...current[request.objectId], loading: false } }));
    else setDraft(current => current || request.text);
    setError('댓글을 처리하지 못했습니다. 연결과 객체 접근 권한을 확인하세요.');
  }, []);
  const receiveAck = useCallback(data => { if (data.request_id) pending.current.delete(data.request_id); }, []);
  const sendComment = useCallback(() => {
    const text = draft.trim();
    if (!activeId || !text) return;
    if (new TextEncoder().encode(text).length > 4096) { setError('댓글은 UTF-8 기준 4096바이트 이하여야 합니다.'); return; }
    const requestId = createId();
    if (!sendRaw({ type: 'chat', room_id: 'general', object_id: String(activeId), text, request_id: requestId })) {
      setError('서버에 연결한 뒤 댓글을 보내주세요.'); return;
    }
    pending.current.set(requestId, { objectId: String(activeId), text });
    setDraft(''); setError('');
  }, [activeId, draft, sendRaw]);
  const open = useCallback((objectId, messageId = null, sequence = null, notification = null) => { setActiveId(String(objectId)); setHighlight(messageId); setJumpSequence(sequence); setJumpNotification(notification); setDraft(''); setError(''); }, []);
  const markVisible = useCallback(() => { if (jumpNotification) { dismiss(jumpNotification); setJumpNotification(null); } }, [jumpNotification, dismiss]);
  return { refreshMentions, receiveMentions, receiveMentionRead, markVisible, activeId, setActiveId, threads, notifications, dismiss, notify, receiveHistory, receiveComment, receiveError, receiveAck, requestHistory, draft, setDraft, error, sendComment, open, highlight };
}
