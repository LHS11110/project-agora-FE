const VALID_HOSTS = new Set(['youtube.com', 'youtube-nocookie.com', 'music.youtube.com']);
const VIDEO_ID_RE = /^[\w-]{11}$/;
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{4,128}$/;

function normalizeYoutubeHost(urlString) {
  const u = new URL(urlString.trim());
  if (!['https:', 'http:'].includes(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (host !== 'youtu.be' && !VALID_HOSTS.has(host)) return null;
  return { url: u, host };
}

function parseStartSeconds(u) {
  const raw = u.searchParams.get('t') || u.searchParams.get('start') || '0';
  const start = /^\d+$/.test(raw)
    ? Number(raw)
    : [...raw.matchAll(/(\d+)(h|m|s)/g)].reduce((n, m) => n + Number(m[1]) * ({ h: 3600, m: 60, s: 1 }[m[2]]), 0);
  return Math.min(Number.isFinite(start) ? start : 0, 86400 * 365);
}

export function isValidYoutubeVideoId(id) {
  return VIDEO_ID_RE.test(id || '');
}

export function parseYoutube(value) {
  try {
    const parsed = normalizeYoutubeHost(value);
    if (!parsed) return null;
    const { url: u, host } = parsed;
    let id;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : null;
    if (!isValidYoutubeVideoId(id)) return null;
    return { id, start: parseStartSeconds(u) };
  } catch {
    return null;
  }
}

export function parseYoutubeTarget(value) {
  try {
    const parsed = normalizeYoutubeHost(value);
    if (!parsed) return null;
    const { url: u, host } = parsed;
    const rawList = u.searchParams.get('list') || '';
    const listId = PLAYLIST_ID_RE.test(rawList) ? rawList : null;

    if (u.pathname === '/watch_videos') {
      const ids = (u.searchParams.get('video_ids') || '')
        .split(',')
        .map((part) => part.trim())
        .filter(isValidYoutubeVideoId);
      if (ids.length > 0) {
        return { kind: 'videos', items: ids.map((id) => ({ id, start: 0 })) };
      }
      return null;
    }

    const video = parseYoutube(value);
    if (listId) {
      if (video) {
        return { kind: 'playlist', listId, id: video.id, start: video.start };
      }
      if (
        host !== 'youtu.be' &&
        (u.pathname === '/playlist' || u.pathname === '/embed/videoseries' || u.pathname === '/embed')
      ) {
        return { kind: 'playlist', listId, id: null, start: 0 };
      }
      return null;
    }

    if (video) {
      return { kind: 'video', id: video.id, start: video.start, listId: null };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseYoutubeInput(raw) {
  const tokens = String(raw || '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!tokens.length) return null;

  const videos = [];
  const playlists = [];
  for (const token of tokens) {
    const target = parseYoutubeTarget(token);
    if (!target) return null;
    if (target.kind === 'video') {
      videos.push({ id: target.id, start: target.start });
    } else if (target.kind === 'videos') {
      videos.push(...target.items);
    } else if (target.kind === 'playlist') {
      playlists.push({ listId: target.listId, id: target.id, start: target.start });
    }
  }
  if (!videos.length && !playlists.length) return null;
  return { videos, playlists };
}

export function moveTrack(tracks, fromIndex, toIndex) {
  if (!Array.isArray(tracks) || tracks.length < 2) return tracks;
  if (fromIndex < 0 || fromIndex >= tracks.length || toIndex < 0 || toIndex >= tracks.length) return tracks;
  if (fromIndex === toIndex) return tracks;
  const next = tracks.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function removeTrackAt(tracks, activeIndex, removeIndex) {
  if (!Array.isArray(tracks) || removeIndex < 0 || removeIndex >= tracks.length) {
    return { tracks, activeIndex };
  }
  const next = tracks.slice();
  next.splice(removeIndex, 1);
  if (!next.length) {
    return { tracks: [], activeIndex: -1 };
  }
  let nextActive = activeIndex;
  if (removeIndex < activeIndex) {
    nextActive = activeIndex - 1;
  } else if (removeIndex === activeIndex) {
    nextActive = Math.min(removeIndex, next.length - 1);
  }
  return { tracks: next, activeIndex: nextActive };
}

export function shuffleQueue(tracks, activeIndex, rng = Math.random) {
  if (!Array.isArray(tracks) || tracks.length < 2) {
    return { tracks: tracks ? tracks.slice() : [], activeIndex };
  }
  const activeUid = activeIndex >= 0 && activeIndex < tracks.length ? tracks[activeIndex]?.uid : null;
  const shuffleOnce = () => {
    const arr = tracks.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  let next = shuffleOnce();
  // Avoid returning an unchanged order when shuffling >= 2 distinct entries.
  for (let attempt = 0; attempt < 3; attempt++) {
    const changed = next.some((item, idx) => item !== tracks[idx]);
    if (changed) break;
    next = shuffleOnce();
  }

  const nextActive = activeUid ? next.findIndex((item) => item.uid === activeUid) : activeIndex;
  return { tracks: next, activeIndex: nextActive >= 0 ? nextActive : 0 };
}

export function restoreQueueOrder(tracks, originalUids, activeIndex) {
  if (!Array.isArray(tracks) || !Array.isArray(originalUids) || !originalUids.length) {
    return { tracks, activeIndex };
  }
  const activeUid = activeIndex >= 0 && activeIndex < tracks.length ? tracks[activeIndex]?.uid : null;
  const rank = new Map(originalUids.map((uid, idx) => [uid, idx]));
  const next = tracks.slice().sort((a, b) => {
    const ra = rank.has(a.uid) ? rank.get(a.uid) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.uid) ? rank.get(b.uid) : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
  const nextActive = activeUid ? next.findIndex((item) => item.uid === activeUid) : activeIndex;
  return { tracks: next, activeIndex: nextActive >= 0 ? nextActive : 0 };
}

const oembedCache = new Map();

export async function fetchYoutubeOembed(url, signal) {
  if (oembedCache.has(url)) return oembedCache.get(url);
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(endpoint, { mode: 'cors', credentials: 'omit', signal });
    if (!response.ok) return null;
    const data = await response.json();
    const meta = {
      title: typeof data?.title === 'string' ? data.title.trim() : '',
      author: typeof data?.author_name === 'string' ? data.author_name.trim() : '',
    };
    if (meta.title || meta.author) oembedCache.set(url, meta);
    return meta;
  } catch {
    return null;
  }
}

const seconds = (value) => value.replace(',', '.').split(':').reduce((n, x) => n * 60 + Number(x), 0);

export function parseSubtitles(text) {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split('\n');
      const i = lines.findIndex((line) => line.includes('-->'));
      if (i < 0) return [];
      const [a, b] = lines[i].split('-->').map((s) => s.trim().split(/\s/)[0]);
      const start = seconds(a);
      const end = seconds(b);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
      return [{ start, end, text: lines.slice(i + 1).join('\n').replace(/<[^>]*>/g, '') }];
    })
    .sort((a, b) => a.start - b.start);
}
