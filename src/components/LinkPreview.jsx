import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { parseYoutube } from '../media/youtube.js';
import { youtubeEmbedSrc } from '../canvas/media/mediaModel.js';
import {
  fallbackUrlSummary,
  messageLinks,
  normalizePreviewPayload,
} from '../canvas/media/urlPreviewModel.js';
import Icon from './Icon.jsx';
import './link-preview.css';

const previewCache = new Map();
const inFlight = new Map();
const oembedCache = new Map();
const pending = [];
let running = 0;
const MAX_CONCURRENT_PREVIEWS = 4;
const MAX_CACHE_ENTRIES = 300;
const OEMBED_TIMEOUT_MS = 2600;

function schedule(task) {
  return new Promise(resolve => {
    pending.push({ task, resolve });
    drain();
  });
}

function drain() {
  while (running < MAX_CONCURRENT_PREVIEWS && pending.length) {
    const job = pending.shift();
    running++;
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, () => job.resolve({ failed: true }))
      .finally(() => {
        running--;
        drain();
      });
  }
}

function cacheSet(map, key, value) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    map.delete(map.keys().next().value);
  }
  map.set(key, value);
}

function fetchBackendPreview(url, token) {
  const key = `${token || ''}\n${url}`;
  if (previewCache.has(key)) return Promise.resolve(previewCache.get(key));
  if (inFlight.has(key)) return inFlight.get(key);
  const request = schedule(async () => {
    try {
      const value = await api('/api/link-preview', {
        method: 'POST',
        body: { url },
        token,
      });
      const normalized = normalizePreviewPayload(value);
      if (normalized) {
        cacheSet(previewCache, key, normalized);
        return normalized;
      }
      return { empty: true };
    } catch {
      return { failed: true };
    } finally {
      inFlight.delete(key);
    }
  });
  inFlight.set(key, request);
  return request;
}

async function fetchYoutubeOembed(videoId) {
  if (!videoId) return null;
  if (oembedCache.has(videoId)) return oembedCache.get(videoId);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS) : null;
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const response = await fetch(endpoint, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const title = String(data?.title || '').trim();
    const author = String(data?.author_name || '').trim();
    if (!title && !author) return null;
    const result = {
      title,
      description: author || 'YouTube',
      siteName: 'YouTube',
      image: '',
    };
    cacheSet(oembedCache, videoId, result);
    return result;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function useTransportReady(transportReady) {
  const [ready, setReady] = useState(Boolean(transportReady));
  useEffect(() => {
    if (transportReady) setReady(true);
  }, [transportReady]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onReady = () => setReady(true);
    window.addEventListener('agora:canvas-transport-ready', onReady);
    return () => window.removeEventListener('agora:canvas-transport-ready', onReady);
  }, []);
  return ready;
}

export function LinkSummary({
  url,
  token,
  transportReady = false,
  showFallback = false,
  onTitleChange,
}) {
  useUiLocale();
  const youtube = parseYoutube(url);
  const ready = useTransportReady(transportReady);
  const cacheKey = `${token || ''}\n${url}`;
  const lastCacheKey = useRef(cacheKey);
  const [preview, setPreview] = useState(() => previewCache.get(cacheKey) || null);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
    const cached = previewCache.get(cacheKey);
    if (lastCacheKey.current !== cacheKey) {
      lastCacheKey.current = cacheKey;
      setPreview(cached || null);
    }
    if (cached) {
      setPreview(cached);
      onTitleChange?.(cached.title || '');
      return undefined;
    }
    let active = true;
    (async () => {
      let resolved = null;
      if (token) {
        const backend = await fetchBackendPreview(url, token);
        if (!active) return;
        if (backend && !backend.empty && !backend.failed) {
          resolved = backend;
        }
      }
      if (!resolved && youtube?.id) {
        resolved = await fetchYoutubeOembed(youtube.id);
        if (!active) return;
        if (resolved && token) cacheSet(previewCache, cacheKey, resolved);
      }
      if (!active) return;
      if (resolved) {
        setPreview(resolved);
        onTitleChange?.(resolved.title || '');
      }
    })();
    return () => {
      active = false;
    };
  }, [url, token, cacheKey, ready, youtube?.id]);

  if (!preview && !showFallback && !youtube) return null;

  const fallback = fallbackUrlSummary(url);
  const isRich = Boolean(preview && (preview.title || preview.description));
  const hostText = preview?.siteName || (youtube ? 'YouTube' : fallback.host);
  const titleText = preview?.title || (youtube ? ui('유튜브 동영상') : fallback.title);
  const descText = preview?.description || (youtube ? url : ui('클릭하여 원본 페이지 열기'));
  const embedSrc = youtube ? youtubeEmbedSrc(`https://www.youtube-nocookie.com/embed/${youtube.id}`, url) : '';

  return (
    <div className={youtube ? 'message-youtube-preview' : 'message-link-preview'}>
      {youtube && (
        <div className="message-youtube-frame">
          <iframe
            src={embedSrc}
            title={preview?.title || ui('유튜브 동영상 미리보기')}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
      <a
        className={`link-preview-summary${isRich ? '' : ' is-fallback'}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {!youtube && preview?.image && !imageBroken && (
          <img
            className="link-preview-thumb"
            src={preview.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageBroken(true)}
          />
        )}
        <div className="link-preview-copy">
          {hostText && (
            <small className="link-preview-host">
              <Icon name="link" size={10} />
              {hostText}
            </small>
          )}
          {titleText && <strong>{titleText}</strong>}
          {descText && <span>{descText}</span>}
        </div>
      </a>
    </div>
  );
}

export function MessageLinkPreviews({ text, token, transportReady = false, showFallback = true, excludeUrls = null }) {
  const excluded = excludeUrls instanceof Set ? excludeUrls : excludeUrls ? new Set(excludeUrls) : null;
  const urls = messageLinks(text).filter(url => !excluded?.has(url));
  if (!urls.length) return null;
  return (
    <div className="message-link-previews">
      {urls.map(url => (
        <LinkSummary
          key={url}
          url={url}
          token={token}
          transportReady={transportReady}
          showFallback={showFallback}
        />
      ))}
    </div>
  );
}

export { messageLinks };
