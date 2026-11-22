import { useLatestMessages } from '../../canvas/comments/useLatestMessages.js';
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import CanvasVoicePanel from '../../canvas/voice/CanvasVoicePanel.jsx';
import {
  CHAT_MEDIA_ACCEPT,
  MAX_CHAT_MEDIA,
  chatMediaFileType,
  composeChatMessageWithMedia,
  parseChatMessageMedia,
  validateChatMediaFile,
} from '../../canvas/chat/chatMedia.js';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import Icon from '../Icon.jsx';
import MarkdownText from '../MarkdownText.jsx';
import { MessageLinkPreviews } from '../LinkPreview.jsx';
import MentionComposer from '../../canvas/comments/MentionComposer.jsx';
import ChannelList from './ChannelList.jsx';
import ChatMediaAttachments from './ChatMediaAttachments.jsx';
import './canvas-chat.css';

async function writeClipboardText(text) {
  const value = String(text ?? '');
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* Fall back to textarea selection copy when Async Clipboard API is unavailable. */ }
  try {
    const area = document.createElement('textarea');
    area.name = 'chat-clipboard-copy';
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

function revokeAttachmentPreviews(list) {
  for (const item of list || []) {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
}

const CanvasChatPanel = memo(function CanvasChatPanel({
  token,
  voice,
  tab = 'chat',
  onTabChange,
  canWrite = true,
  chatHistoryLoading,
  connection,
  hasOlderMessages,
  loadOlderMessages,
  message,
  messages,
  setMessage,
  submitMessage,
  participants,
  highlight,
  onHighlightVisible,
  onHighlightExpired,
  chatMessageTotal = messages.length,
  channels = null,
  onUploadChatMedia = null,
}) {
  const locale = useUiLocale();
  const list = useRef(null);
  const tabId = useId();
  const fileInputRef = useRef(null);
  const loadingOlder = useRef(false);
  const touchY = useRef(null);
  const copyTimer = useRef(null);
  const dragDepth = useRef(0);
  const pendingRef = useRef([]);
  const mountedRef = useRef(true);

  const [copiedId, setCopiedId] = useState(null);
  const [pendingMedia, setPendingMedia] = useState([]);
  const [mediaNotice, setMediaNotice] = useState('');
  const [dragActive, setDragActive] = useState(false);

  pendingRef.current = pendingMedia;

  useLatestMessages(list, messages, 'chat', highlight, onHighlightVisible, {
    followNearBottom: true,
    totalCount: chatMessageTotal,
    onHighlightExpired,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyTimer.current) clearTimeout(copyTimer.current);
      revokeAttachmentPreviews(pendingRef.current);
    };
  }, []);

  useEffect(() => {
    setMediaNotice('');
  }, [channels?.activeText]);

  if (!chatHistoryLoading) loadingOlder.current = false;
  const loadAtTop = () => {
    if (list.current?.clientHeight && list.current.scrollTop <= 1 && hasOlderMessages && !chatHistoryLoading && !loadingOlder.current) {
      loadingOlder.current = true;
      loadOlderMessages();
    }
  };

  const copyMessage = async entry => {
    if (!await writeClipboardText(entry.text)) return;
    setCopiedId(entry.id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(current => (current === entry.id ? null : current)), 1600);
  };

  const composerDisabled = !canWrite || connection !== 'connected';
  const canAttachMedia = Boolean(onUploadChatMedia && !composerDisabled);

  const enqueueMediaFiles = useCallback(async rawFiles => {
    if (!onUploadChatMedia || composerDisabled) return;
    const files = Array.from(rawFiles || []).filter(Boolean);
    if (!files.length) return;
    setMediaNotice('');

    const availableSlots = Math.max(0, MAX_CHAT_MEDIA - pendingRef.current.length);
    if (availableSlots <= 0) {
      setMediaNotice(ui('메시지당 미디어는 최대 6개까지 첨부할 수 있습니다.'));
      return;
    }

    const accepted = files.slice(0, availableSlots);
    if (files.length > accepted.length) {
      setMediaNotice(ui('메시지당 미디어는 최대 6개까지 첨부할 수 있습니다.'));
    }

    for (const file of accepted) {
      const check = validateChatMediaFile(file);
      if (!check.ok) {
        setMediaNotice(ui(check.error));
        continue;
      }
      const id = `chat-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = check.mediaType === 'image' && typeof URL?.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : '';
      const entry = {
        id,
        name: file.name || (check.mediaType === 'video' ? 'video' : 'image'),
        mediaType: check.mediaType,
        previewUrl,
        uploadedUrl: '',
        uploading: true,
        error: '',
      };
      setPendingMedia(current => [...current, entry]);
      try {
        const result = await onUploadChatMedia(file);
        if (!mountedRef.current) {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          return;
        }
        const uploadedUrl = typeof result === 'string' ? result : (result?.url || result?.src || '');
        if (!uploadedUrl) throw new Error('미디어를 업로드하지 못했습니다.');
        setPendingMedia(current => current.map(item => (
          item.id === id ? { ...item, uploadedUrl, uploading: false, error: '' } : item
        )));
      } catch (error) {
        if (!mountedRef.current) return;
        const messageText = error?.message || ui('미디어를 업로드하지 못했습니다.');
        setMediaNotice(messageText);
        setPendingMedia(current => current.filter(item => {
          if (item.id !== id) return true;
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return false;
        }));
      }
    }
  }, [onUploadChatMedia, composerDisabled]);

  const removePendingMedia = useCallback(id => {
    setPendingMedia(current => current.filter(item => {
      if (item.id !== id) return true;
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return false;
    }));
  }, []);

  const handleFileInputChange = event => {
    const files = event.target.files;
    if (files?.length) void enqueueMediaFiles(files);
    event.target.value = '';
  };

  const handleComposerPaste = event => {
    if (!canAttachMedia) return;
    const clipboardFiles = [];
    if (event.clipboardData?.files?.length) {
      clipboardFiles.push(...event.clipboardData.files);
    } else if (event.clipboardData?.items?.length) {
      for (const item of event.clipboardData.items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) clipboardFiles.push(file);
        }
      }
    }
    const candidateFiles = clipboardFiles.filter(file => {
      const mime = String(file?.type || '').toLowerCase();
      return Boolean(chatMediaFileType(file)) || mime.startsWith('image/') || mime.startsWith('video/');
    });
    if (!candidateFiles.length) return;
    event.preventDefault();
    event.stopPropagation();
    void enqueueMediaFiles(candidateFiles);
  };

  const hasDraggedFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');

  const handleChatDragEnter = event => {
    if (!canAttachMedia || !hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleChatDragOver = event => {
    if (!canAttachMedia || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleChatDragLeave = event => {
    if (!dragActive) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0 || !event.currentTarget.contains(event.relatedTarget)) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  };

  const handleChatDrop = event => {
    dragDepth.current = 0;
    setDragActive(false);
    if (!canAttachMedia || !event.dataTransfer?.files?.length) return;
    event.preventDefault();
    event.stopPropagation();
    void enqueueMediaFiles(event.dataTransfer.files);
  };

  const uploadingMedia = pendingMedia.some(item => item.uploading);
  const readyMedia = pendingMedia.filter(item => item.uploadedUrl && !item.uploading);
  const canSubmitChat = !uploadingMedia && (Boolean(message.trim()) || readyMedia.length > 0);

  const handleSubmitChat = event => {
    if (uploadingMedia) return;
    const composed = readyMedia.length ? composeChatMessageWithMedia(message, readyMedia) : message.trim();
    if (!composed) return;
    const sent = readyMedia.length ? submitMessage(event, composed) : submitMessage(event);
    if (sent !== false && readyMedia.length) {
      revokeAttachmentPreviews(pendingRef.current);
      setPendingMedia([]);
      setMediaNotice('');
    }
  };

  const activeTextName = channels?.text.find(channel => channel.id === channels.activeText)?.name ?? '';

  return (
    <section className="canvas-chat-panel communication-panel" id="canvas-communication-panel" aria-label={ui('채팅 · 통화')}>
      <div className="communication-header">
        <div
          className="communication-tabs"
          role="tablist"
          aria-label={ui('대화 방식')}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const next = event.key === 'Home' ? 'chat' : event.key === 'End' ? 'voice' : tab === 'chat' ? 'voice' : 'chat';
            onTabChange(next);
            event.currentTarget.querySelector(`[data-tab="${next}"]`)?.focus();
          }}
        >
          <button
            id={`${tabId}-chat-tab`}
            role="tab"
            data-tab="chat"
            aria-selected={tab === 'chat'}
            aria-controls={`${tabId}-chat`}
            tabIndex={tab === 'chat' ? 0 : -1}
            onClick={() => onTabChange('chat')}
          >
            <Icon name="chat" size={14} />{ui('채팅')}
          </button>
          <button
            id={`${tabId}-voice-tab`}
            role="tab"
            data-tab="voice"
            aria-selected={tab === 'voice'}
            aria-controls={`${tabId}-voice`}
            tabIndex={tab === 'voice' ? 0 : -1}
            onClick={() => onTabChange('voice')}
          >
            <Icon name="microphone" size={14} />{ui('통화')}
            {voice?.state.active && <i className="communication-live-dot" aria-hidden="true" />}
          </button>
        </div>
        <div className="chat-dock-heading" hidden={tab !== 'chat'}>
          <span className="chat-message-count">{messages.length}{ui('개 표시')}</span>
          {hasOlderMessages && (
            <button
              type="button"
              className="chat-load-more"
              onClick={loadOlderMessages}
              disabled={chatHistoryLoading}
              aria-busy={chatHistoryLoading}
              title={ui('이전 메시지 10개 불러오기')}
            >
              <Icon
                name={chatHistoryLoading ? 'reset' : 'chevron'}
                size={13}
                className={chatHistoryLoading ? 'chat-history-spinner' : 'chat-history-arrow'}
              />
              <span>{chatHistoryLoading ? ui('불러오는 중') : ui('이전 메시지')}</span>
            </button>
          )}
        </div>
      </div>

      <div
        className={`communication-chat${dragActive ? ' is-drag-over' : ''}`}
        role="tabpanel"
        id={`${tabId}-chat`}
        aria-labelledby={`${tabId}-chat-tab`}
        hidden={tab !== 'chat'}
        onDragEnter={handleChatDragEnter}
        onDragOver={handleChatDragOver}
        onDragLeave={handleChatDragLeave}
        onDrop={handleChatDrop}
      >
        {channels && (
          <ChannelList
            kind="text"
            channels={channels.text}
            categories={channels.categories}
            activeId={channels.activeText}
            unread={channels.unread}
            canManage={channels.canManage}
            groupAccess={channels.groupAccess}
            onSelect={channels.selectText}
            onCreate={(type, name, categoryId, accessGroups) => {
              const created = channels.create(type, name, categoryId, accessGroups);
              if (created && type === 'voice') onTabChange?.('voice');
              return created;
            }}
            onRename={channels.rename}
            onUpdateGroups={channels.updateGroups}
            onDelete={channels.remove}
            onCreateCategory={channels.createCategory}
            onRenameCategory={channels.renameCategory}
            onDeleteCategory={channels.removeCategory}
            onMoveChannel={channels.moveChannel}
            onReorderCategory={channels.reorderCategory}
          />
        )}

        <div
          className="message-list"
          ref={list}
          onScroll={loadAtTop}
          onWheel={event => { if (event.deltaY < 0) loadAtTop(); }}
          onTouchStart={event => { touchY.current = event.touches[0]?.clientY ?? null; }}
          onTouchMove={event => { if (touchY.current !== null && event.touches[0]?.clientY > touchY.current) loadAtTop(); }}
        >
          {messages.length ? messages.map(entry => {
            const parsed = parseChatMessageMedia(entry.text);
            return (
              <div
                className={`chat-entry${entry.own ? ' own' : ''}${highlight === entry.id ? ' mention-target' : ''}`}
                data-message-id={entry.id}
                key={entry.id}
              >
                <div className="chat-entry-avatar">{entry.sender.slice(0, 1)}</div>
                <div className="chat-entry-content">
                  <div className="chat-entry-meta">
                    <strong>{entry.sender}</strong>
                    <time>
                      {entry.time.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    <button
                      type="button"
                      className={`chat-copy-button${copiedId === entry.id ? ' is-copied' : ''}`}
                      aria-label={copiedId === entry.id ? ui('복사됨') : ui('채팅 복사')}
                      title={copiedId === entry.id ? ui('복사됨') : ui('메시지 복사')}
                      onClick={() => void copyMessage(entry)}
                    >
                      <Icon name={copiedId === entry.id ? 'check' : 'copy'} size={11} />
                    </button>
                  </div>
                  <div className="chat-message-bubble">
                    {parsed.displayText && <MarkdownText source={parsed.displayText} />}
                    <ChatMediaAttachments attachments={parsed.attachments} token={token} />
                    <MessageLinkPreviews
                      text={entry.text}
                      token={token}
                      transportReady={connection === 'connected'}
                      excludeUrls={parsed.mediaUrls}
                    />
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="chat-empty">
              <span>✳</span>
              <strong>{ui('첫 대화를 시작해보세요.')}</strong>
              <small>{ui('캔버스에 대한 생각을 멤버들과 나눠요.')}</small>
            </div>
          )}
        </div>

        {dragActive && (
          <div className="chat-drop-overlay" aria-hidden="true">
            <Icon name="image" size={20} />
            <span>{ui('이미지 또는 동영상을 놓아 첨부하세요')}</span>
          </div>
        )}

        <div className="chat-compose">
          {onUploadChatMedia && (
            <input
              id={`${tabId}-chat-media`}
              name="chat-media-upload"
              ref={fileInputRef}
              type="file"
              accept={CHAT_MEDIA_ACCEPT}
              multiple
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleFileInputChange}
            />
          )}
          <MentionComposer
            label={ui('채팅 메시지 입력')}
            placeholder={channels
              ? `#${activeTextName} · ${ui('Markdown 메시지를 남겨보세요...')}`
              : ui('Markdown 메시지를 남겨보세요...')}
            value={message}
            onChange={setMessage}
            onSubmit={handleSubmitChat}
            participants={participants}
            disabled={composerDisabled}
            canSubmit={canSubmitChat}
            onPaste={handleComposerPaste}
            leadingAction={onUploadChatMedia ? (
              <button
                type="button"
                className="chat-attach-button"
                disabled={!canAttachMedia || pendingMedia.length >= MAX_CHAT_MEDIA}
                onClick={() => fileInputRef.current?.click()}
                aria-label={ui('이미지 또는 동영상 첨부')}
                title={ui('이미지 또는 동영상 첨부')}
              >
                <Icon name="paperclip" size={15} />
              </button>
            ) : null}
            topSlot={(pendingMedia.length > 0 || mediaNotice) ? (
              <div className="chat-pending-media-wrap">
                {pendingMedia.length > 0 && (
                  <ul className="chat-pending-media" aria-label={ui('첨부할 미디어')}>
                    {pendingMedia.map(item => (
                      <li key={item.id} className={`chat-pending-media-item${item.uploading ? ' is-uploading' : ''}`}>
                        {item.previewUrl ? (
                          <img src={item.previewUrl} alt={item.name} />
                        ) : (
                          <span className="chat-pending-media-icon">
                            <Icon name={item.mediaType === 'video' ? 'video' : 'image'} size={16} />
                          </span>
                        )}
                        <span className="chat-pending-media-name" title={item.name}>{item.name}</span>
                        {item.uploading && <span className="chat-pending-media-status">{ui('업로드 중…')}</span>}
                        <button
                          type="button"
                          className="chat-pending-media-remove"
                          onClick={() => removePendingMedia(item.id)}
                          aria-label={`${ui('첨부 제거')}: ${item.name}`}
                          title={ui('첨부 제거')}
                        >
                          <Icon name="close" size={11} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {mediaNotice && <p className="chat-media-notice" role="alert">{mediaNotice}</p>}
              </div>
            ) : null}
          />
        </div>
      </div>

      <div
        className="communication-call"
        role="tabpanel"
        id={`${tabId}-voice`}
        aria-labelledby={`${tabId}-voice-tab`}
        hidden={tab !== 'voice'}
      >
        {voice && channels && (
          <ChannelList
            kind="voice"
            channels={channels.voice}
            categories={channels.categories}
            activeId={voice.state.channel}
            joinedId={voice.state.active ? voice.state.channel : null}
            members={voice.state.channelMembers}
            canManage={channels.canManage}
            groupAccess={channels.groupAccess}
            onSelect={id => (voice.state.active ? voice.call.join(id) : voice.call.setChannel(id))}
            onCreate={(type, name, categoryId, accessGroups) => {
              const created = channels.create(type, name, categoryId, accessGroups);
              if (created && type === 'text') onTabChange?.('chat');
              return created;
            }}
            onRename={channels.rename}
            onUpdateGroups={channels.updateGroups}
            onDelete={channels.remove}
            onCreateCategory={channels.createCategory}
            onRenameCategory={channels.renameCategory}
            onDeleteCategory={channels.removeCategory}
            onMoveChannel={channels.moveChannel}
            onReorderCategory={channels.reorderCategory}
          />
        )}
        {voice && (
          <CanvasVoicePanel
            voice={voice}
            channelName={channels?.voice.find(channel => channel.id === voice.state.channel)?.name}
          />
        )}
      </div>
    </section>
  );
});

export default CanvasChatPanel;
