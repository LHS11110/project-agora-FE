import { stripTrailingPunctuation } from '../media/urlPreviewModel.js';

export const CHAT_IMAGE_LIMIT = 20 * 1024 * 1024;
export const CHAT_VIDEO_LIMIT = 100 * 1024 * 1024;
export const MAX_CHAT_MEDIA = 6;

const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|gif|avif|bmp)$/i;
const VIDEO_EXT_RE = /\.(?:mp4|m4v|mov|webm|ogv)$/i;
const INTERNAL_MEDIA_PATH_RE = /^\/api\/canvases\/[1-9][0-9]*\/media\/[A-Za-z0-9._-]+$/;
const MARKDOWN_MEDIA_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const BARE_URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

export const CHAT_MEDIA_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,video/mp4,video/webm,video/ogg,video/quicktime,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp,.mp4,.m4v,.mov,.webm,.ogv';

/** Returns 'image' | 'video' | null for a File/Blob candidate. */
export function chatMediaFileType(file) {
  if (!file) return null;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '');
  if (type.startsWith('video/') || VIDEO_EXT_RE.test(name)) return 'video';
  if ((type.startsWith('image/') && type !== 'image/svg+xml') || IMAGE_EXT_RE.test(name)) return 'image';
  return null;
}

/** Validates file type and size before uploading to canvas media storage. */
export function validateChatMediaFile(file) {
  const mediaType = chatMediaFileType(file);
  if (!mediaType) {
    return { ok: false, error: '이미지(PNG·JPG·WebP·GIF) 또는 동영상(MP4·WebM·OGV·MOV) 파일만 첨부할 수 있습니다.' };
  }
  const limit = mediaType === 'video' ? CHAT_VIDEO_LIMIT : CHAT_IMAGE_LIMIT;
  if (typeof file.size === 'number' && file.size > limit) {
    return {
      ok: false,
      error: mediaType === 'video'
        ? '동영상은 100MiB 이하로 올려주세요.'
        : '이미지는 20MiB 이하로 올려주세요.',
    };
  }
  return { ok: true, mediaType };
}

function extensionMediaType(pathname) {
  if (VIDEO_EXT_RE.test(pathname)) return 'video';
  if (IMAGE_EXT_RE.test(pathname)) return 'image';
  return null;
}

/**
 * Classifies and sanitizes a chat media URL.
 * Allows internal canvas media paths and safe HTTPS (or same-protocol HTTP) image/video URLs.
 */
export function classifyChatMediaUrl(
  rawUrl,
  pageProtocol = typeof window !== 'undefined' ? window.location?.protocol : 'https:',
) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/')) {
    if (trimmed.includes('..') || !INTERNAL_MEDIA_PATH_RE.test(trimmed)) return null;
    const mediaType = extensionMediaType(trimmed);
    if (!mediaType) return null;
    return { url: trimmed, mediaType, internal: true };
  }

  try {
    const parsed = new URL(trimmed);
    const allowedProtocol = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && pageProtocol === 'http:');
    if (!allowedProtocol || parsed.username || parsed.password) return null;
    const mediaType = extensionMediaType(parsed.pathname);
    if (!mediaType) return null;
    return { url: parsed.toString(), mediaType, internal: false };
  } catch {
    return null;
  }
}

/** Formats an uploaded or external media URL as compact Markdown image syntax. */
export function formatChatMediaMarkdown(url, filename = '') {
  const safeName = String(filename || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[[\]()]/g, '')
    .trim()
    .slice(0, 80);
  const safeUrl = String(url || '').trim().replace(/\s+/g, '%20');
  if (!safeUrl) return '';
  return `![${safeName || 'media'}](${safeUrl})`;
}

/** Combines message caption text and media attachment entries into a single chat payload string. */
export function composeChatMessageWithMedia(text, attachments = []) {
  const parts = [];
  const trimmed = String(text || '').trim();
  if (trimmed) parts.push(trimmed);
  for (const item of attachments || []) {
    const url = item?.uploadedUrl || item?.url;
    if (!url) continue;
    const token = formatChatMediaMarkdown(url, item.name || item.alt || '');
    if (token) parts.push(token);
  }
  return parts.join('\n');
}

/**
 * Extracts renderable image/video attachments from a chat message.
 * Strips matched Markdown media syntax and standalone bare media URL lines from displayText,
 * and returns mediaUrls so LinkPreview can skip duplicating already-rendered media.
 */
export function parseChatMessageMedia(
  text,
  pageProtocol = typeof window !== 'undefined' ? window.location?.protocol : 'https:',
) {
  const source = String(text || '');
  const attachments = [];
  const seen = new Set();
  const mediaUrls = new Set();

  const strippedMarkdown = source.replace(MARKDOWN_MEDIA_RE, (full, alt, rawUrl) => {
    const info = classifyChatMediaUrl(rawUrl, pageProtocol);
    if (!info) return full;
    mediaUrls.add(info.url);
    if (!seen.has(info.url) && attachments.length < MAX_CHAT_MEDIA) {
      seen.add(info.url);
      attachments.push({
        url: info.url,
        alt: String(alt || '').trim(),
        mediaType: info.mediaType,
        internal: info.internal,
      });
    }
    return '';
  });

  const lines = strippedMarkdown.split(/\r\n|\r|\n/);
  const keptLines = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    const standaloneCandidate = trimmedLine && !/\s/.test(trimmedLine)
      ? classifyChatMediaUrl(stripTrailingPunctuation(trimmedLine), pageProtocol)
      : null;
    if (standaloneCandidate) {
      mediaUrls.add(standaloneCandidate.url);
      if (!seen.has(standaloneCandidate.url) && attachments.length < MAX_CHAT_MEDIA) {
        seen.add(standaloneCandidate.url);
        attachments.push({
          url: standaloneCandidate.url,
          alt: '',
          mediaType: standaloneCandidate.mediaType,
          internal: standaloneCandidate.internal,
        });
      }
      continue;
    }

    const matches = line.match(BARE_URL_RE) || [];
    for (const raw of matches) {
      const candidate = classifyChatMediaUrl(stripTrailingPunctuation(raw), pageProtocol);
      if (!candidate) continue;
      mediaUrls.add(candidate.url);
      if (!seen.has(candidate.url) && attachments.length < MAX_CHAT_MEDIA) {
        seen.add(candidate.url);
        attachments.push({
          url: candidate.url,
          alt: '',
          mediaType: candidate.mediaType,
          internal: candidate.internal,
        });
      }
    }
    keptLines.push(line);
  }

  const displayText = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { displayText, attachments, mediaUrls };
}
