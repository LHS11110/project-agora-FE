import { parseYoutube } from '../../media/youtube.js';

export const MAX_PREVIEWS_PER_MESSAGE = 4;

/** Strips trailing sentence punctuation while preserving balanced parentheses in paths. */
export function stripTrailingPunctuation(raw) {
  let value = String(raw || '');
  while (value.length > 0) {
    if (/[.,!?;:\]}'"]$/.test(value)) {
      value = value.slice(0, -1);
      continue;
    }
    if (value.endsWith(')')) {
      const opens = (value.match(/\(/g) || []).length;
      const closes = (value.match(/\)/g) || []).length;
      if (closes > opens) {
        value = value.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return value;
}

/** Validates an extracted URL string and upgrades HTTP YouTube URLs to HTTPS. */
export function normalizeUrlCandidate(raw) {
  const cleaned = stripTrailingPunctuation(raw);
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'https:') return parsed.toString();
    if (parsed.protocol === 'http:') {
      const asHttps = `https://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (parseYoutube(asHttps)) return asHttps;
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

/** Extracts unique HTTP/HTTPS URLs from a message body. */
export function messageLinks(text, limit = MAX_PREVIEWS_PER_MESSAGE) {
  const matches = String(text || '').match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  const seen = new Set();
  const result = [];
  for (const raw of matches) {
    const normalized = normalizeUrlCandidate(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

/** Permits only safe image preview URLs (HTTPS, relative /api/, data:image/, or matching HTTP). */
export function safeImageUrl(value, pageProtocol = typeof window !== 'undefined' ? window.location?.protocol : 'https:') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/api/') || raw.startsWith('data:image/')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:') return parsed.toString();
    if (parsed.protocol === 'http:' && pageProtocol === 'http:') return parsed.toString();
  } catch {
    return '';
  }
  return '';
}

/** Normalizes arbitrary link-preview response payloads into consistent summary fields. */
export function normalizePreviewPayload(value, pageProtocol) {
  if (!value || typeof value !== 'object') return null;
  const title = String(value.title || '').trim();
  const description = String(value.description || value.summary || '').trim();
  const siteName = String(value.siteName || value.site_name || value.author_name || '').trim();
  const image = safeImageUrl(value.image || value.thumbnail || value.thumbnail_url || '', pageProtocol);
  if (!title && !description && !image && !siteName) return null;
  return { title, description, siteName, image };
}

/** Builds a human-readable domain/path fallback card when server metadata is unavailable. */
export function fallbackUrlSummary(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '');
    let decodedPath = parsed.pathname;
    try {
      decodedPath = decodeURIComponent(parsed.pathname);
    } catch {
      decodedPath = parsed.pathname;
    }
    const pathText = decodedPath && decodedPath !== '/' ? decodedPath.replace(/\/+$/, '') : '';
    const detail = `${host}${pathText}${parsed.search || ''}`;
    return {
      host,
      title: pathText ? `${host}${pathText}` : host,
      description: detail.length > host.length ? detail : url,
    };
  } catch {
    return { host: '', title: String(url || ''), description: String(url || '') };
  }
}
