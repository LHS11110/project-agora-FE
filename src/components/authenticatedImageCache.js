import { apiUrl, canvasFetch } from '../api/client.js';

const MAX_ENTRIES = 64;
const MAX_BYTES = 48 * 1024 * 1024;
const MAX_PREFETCH = 3;

const entries = new Map();
const inflight = new Map();
let totalBytes = 0;
let activePrefetches = 0;

function resolveTarget(source, token) {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed) return null;
  if (/^(data|blob):/i.test(trimmed)) return { direct: trimmed };

  const baseHref = typeof window !== 'undefined' ? window.location.href : 'https://localhost/';
  const imageUrl = new URL(apiUrl(trimmed), baseHref);
  const apiOrigin = new URL(apiUrl('/'), baseHref).origin;
  const internal = imageUrl.origin === apiOrigin;
  // Canvas cover images share a stable URL across replacements; never hold stale
  // cover bytes in the shared cache after unmount.
  const retain = !(internal && /^\/api\/canvases\/[^/]+\/image$/.test(imageUrl.pathname));
  const key = internal ? `${imageUrl.href}\n${token || ''}` : imageUrl.href;
  return { href: imageUrl.href, internal, retain, key, token };
}

function touch(entry) {
  if (!entry || entries.get(entry.key) !== entry) return;
  entries.delete(entry.key);
  entries.set(entry.key, entry);
}

function revokeIfUnused(entry) {
  if (!entry || entry.refs > 0 || entry.revoked) return;
  entry.revoked = true;
  if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  totalBytes = Math.max(0, totalBytes - entry.size);
}

function evict() {
  for (const [key, entry] of entries) {
    if (entries.size <= MAX_ENTRIES && totalBytes <= MAX_BYTES) break;
    if (entry.refs > 0) continue;
    entries.delete(key);
    revokeIfUnused(entry);
  }
}

async function fetchImageEntry(target) {
  const response = await canvasFetch(target.href, {
    cache: 'no-store',
    headers: target.internal && target.token ? { Authorization: `Bearer ${target.token}` } : {},
  });
  if (!response.ok) throw new Error(`Image request failed (${response.status})`);
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
    throw new Error('Image endpoint returned a non-image response');
  }
  const blob = await response.blob();
  if (!blob?.size) return null;

  const objectUrl = URL.createObjectURL(blob);
  const entry = {
    key: target.key,
    src: objectUrl,
    objectUrl,
    size: blob.size,
    retain: target.retain,
    refs: 0,
    revoked: false,
  };
  if (target.retain) {
    const previous = entries.get(target.key);
    if (previous) {
      entries.delete(target.key);
      if (previous.refs === 0) revokeIfUnused(previous);
      else previous.retain = false;
    }
    entries.set(target.key, entry);
    totalBytes += entry.size;
    evict();
  }
  return entry;
}

export function peekAuthenticatedImage(source, token) {
  let target;
  try { target = resolveTarget(source, token); } catch { return null; }
  if (!target) return null;
  if (target.direct) return { key: `${target.direct}\n${token || ''}`, src: target.direct, direct: true };
  if (!target.retain) return null;
  const entry = entries.get(target.key);
  if (!entry || entry.revoked) return null;
  touch(entry);
  return entry;
}

export async function acquireAuthenticatedImage(source, token) {
  const target = resolveTarget(source, token);
  if (!target) return null;
  if (target.direct) return { key: `${target.direct}\n${token || ''}`, src: target.direct, direct: true, refs: 0 };

  if (target.retain) {
    const existing = entries.get(target.key);
    if (existing && !existing.revoked) {
      touch(existing);
      existing.refs += 1;
      return existing;
    }
  }

  let promise = inflight.get(target.key);
  if (!promise) {
    promise = fetchImageEntry(target).finally(() => inflight.delete(target.key));
    inflight.set(target.key, promise);
  }
  const entry = await promise;
  if (!entry) return null;
  entry.refs += 1;
  return entry;
}

export function releaseAuthenticatedImage(entry) {
  if (!entry || entry.direct) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (!entry.retain || !entries.has(entry.key) || entries.get(entry.key) !== entry) {
    revokeIfUnused(entry);
    return;
  }
  evict();
}

export function prefetchAuthenticatedImage(source, token) {
  let target;
  try { target = resolveTarget(source, token); } catch { return false; }
  if (!target || target.direct || !target.retain) return false;
  if (entries.has(target.key) || inflight.has(target.key) || activePrefetches >= MAX_PREFETCH) return false;

  activePrefetches += 1;
  const promise = fetchImageEntry(target)
    .catch(() => null)
    .finally(() => {
      activePrefetches = Math.max(0, activePrefetches - 1);
      inflight.delete(target.key);
    });
  inflight.set(target.key, promise);
  return true;
}

export function invalidateAuthenticatedImage(source, token) {
  let target;
  try { target = resolveTarget(source, token); } catch { return; }
  if (!target || target.direct) return;
  const entry = entries.get(target.key);
  if (!entry) return;
  entries.delete(target.key);
  entry.retain = false;
  revokeIfUnused(entry);
}
