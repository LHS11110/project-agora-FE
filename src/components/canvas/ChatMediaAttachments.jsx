import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiUrl, canvasFetch } from '../../api/client.js';
import { CHAT_VIDEO_LIMIT } from '../../canvas/chat/chatMedia.js';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { bearer } from '../../state/authSession.js';
import {
  acquireAuthenticatedImage,
  peekAuthenticatedImage,
  releaseAuthenticatedImage,
} from '../authenticatedImageCache.js';
import Icon from '../Icon.jsx';

function ChatImageAttachment({ attachment, token, onOpenLightbox }) {
  useUiLocale();
  const cached = attachment.internal ? peekAuthenticatedImage(attachment.url, token) : null;
  const [src, setSrc] = useState(() => (attachment.internal ? (cached?.src || '') : attachment.url));
  const [error, setError] = useState(false);
  const [transportVersion, setTransportVersion] = useState(0);

  useEffect(() => {
    setError(false);
    if (!attachment.internal) {
      setSrc(attachment.url);
      return undefined;
    }
    let active = true;
    let acquired = null;
    const immediate = peekAuthenticatedImage(attachment.url, token);
    if (immediate?.src) setSrc(immediate.src);
    else setSrc('');

    const retryOnReconnect = () => {
      if (!acquired) setTransportVersion(version => version + 1);
    };
    window.addEventListener('agora:canvas-transport-ready', retryOnReconnect);

    acquireAuthenticatedImage(attachment.url, token)
      .then(entry => {
        if (!active) {
          if (entry) releaseAuthenticatedImage(entry);
          return;
        }
        if (!entry?.src) {
          setError(true);
          return;
        }
        acquired = entry;
        setSrc(entry.src);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      window.removeEventListener('agora:canvas-transport-ready', retryOnReconnect);
      if (acquired) releaseAuthenticatedImage(acquired);
    };
  }, [attachment.url, attachment.internal, token, transportVersion]);

  if (error) {
    return (
      <div className="chat-media-fallback" role="status">
        <Icon name="image" size={14} />
        <span>{ui('이미지를 불러오지 못했습니다.')}</span>
      </div>
    );
  }
  if (!src) {
    return (
      <div className="chat-media-loading" role="status">
        <Icon name="image" size={14} />
        <span>{ui('이미지 불러오는 중…')}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="chat-media-image-button"
      onClick={() => onOpenLightbox({ src, alt: attachment.alt || ui('채팅 이미지'), url: attachment.url })}
      aria-label={attachment.alt ? `${ui('이미지 확대')}: ${attachment.alt}` : ui('이미지 확대')}
      title={ui('클릭하여 원본 크기로 보기')}
    >
      <img
        className="chat-media-image"
        src={src}
        alt={attachment.alt || ui('채팅 이미지')}
        loading="lazy"
        referrerPolicy={attachment.internal ? undefined : 'no-referrer'}
        onError={() => setError(true)}
      />
    </button>
  );
}

function ChatVideoAttachment({ attachment, token }) {
  useUiLocale();
  const [src, setSrc] = useState(() => (attachment.internal ? '' : attachment.url));
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    if (!attachment.internal) {
      setSrc(attachment.url);
      return undefined;
    }
    const abort = new AbortController();
    let objectUrl = '';
    setSrc('');

    (async () => {
      try {
        const address = apiUrl(attachment.url);
        const response = await canvasFetch(address, {
          headers: token ? { Authorization: bearer(token) } : {},
          signal: abort.signal,
        });
        if (!response.ok) throw new Error('Video request failed');
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > CHAT_VIDEO_LIMIT) throw new Error('Video too large');
        const blob = await response.blob();
        if (abort.signal.aborted) return;
        if (!blob.size || blob.size > CHAT_VIDEO_LIMIT) throw new Error('Invalid video blob');
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!abort.signal.aborted) setError(true);
      }
    })();

    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.url, attachment.internal, token]);

  if (error) {
    return (
      <div className="chat-media-fallback" role="status">
        <Icon name="video" size={14} />
        <span>{ui('동영상을 불러오지 못했습니다.')}</span>
      </div>
    );
  }
  if (!src) {
    return (
      <div className="chat-media-loading" role="status">
        <Icon name="video" size={14} />
        <span>{ui('동영상 불러오는 중…')}</span>
      </div>
    );
  }

  return (
    <div className="chat-media-video-wrap">
      <video
        className="chat-media-video"
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={attachment.alt || ui('채팅 동영상')}
        onError={() => setError(true)}
      />
      {attachment.alt && attachment.alt !== 'media' && (
        <span className="chat-media-caption">{attachment.alt}</span>
      )}
    </div>
  );
}

function ChatMediaLightbox({ item, onClose }) {
  useUiLocale();
  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const modal = (
    <div
      className="chat-media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.alt || ui('이미지 확대')}
      onClick={onClose}
    >
      <div className="chat-media-lightbox-body" onClick={event => event.stopPropagation()}>
        <div className="chat-media-lightbox-bar">
          <span className="chat-media-lightbox-title">{item.alt}</span>
          <a
            className="chat-media-lightbox-download"
            href={item.src}
            download={item.alt || 'image'}
            target="_blank"
            rel="noopener noreferrer"
          >
            {ui('다운로드')}
          </a>
          <button
            type="button"
            className="chat-media-lightbox-close"
            onClick={onClose}
            aria-label={ui('닫기')}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <img src={item.src} alt={item.alt || ui('채팅 이미지')} />
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

const ChatMediaAttachments = memo(function ChatMediaAttachments({ attachments, token }) {
  useUiLocale();
  const [lightbox, setLightbox] = useState(null);
  if (!attachments?.length) return null;

  return (
    <>
      <div className="chat-media-attachments">
        {attachments.map(attachment => (
          <div key={attachment.url} className={`chat-media-item is-${attachment.mediaType}`}>
            {attachment.mediaType === 'video' ? (
              <ChatVideoAttachment attachment={attachment} token={token} />
            ) : (
              <ChatImageAttachment
                attachment={attachment}
                token={token}
                onOpenLightbox={setLightbox}
              />
            )}
          </div>
        ))}
      </div>
      {lightbox && <ChatMediaLightbox item={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
});

export default ChatMediaAttachments;
