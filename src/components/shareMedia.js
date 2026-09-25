const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
const VIDEO_EXTENSION = /\.(?:mp4|m4v|webm|ogv|ogg|mov)$/i;

function youtubeVideoId(url) {
  const host = url.hostname.toLowerCase();
  const isYoutubeHost = host === 'youtu.be'
    || host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'youtube-nocookie.com'
    || host.endsWith('.youtube-nocookie.com');
  if (!isYoutubeHost) return '';

  const parts = url.pathname.split('/').filter(Boolean);
  let id = '';
  if (host === 'youtu.be') id = parts[0] || '';
  else if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
  else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1] || '';
  return YOUTUBE_ID.test(id) ? id : '';
}

export function inspectShareUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;

  const videoId = youtubeVideoId(url);
  if (videoId) {
    return {
      url: url.href,
      mediaType: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      defaultTitle: 'YouTube 동영상',
    };
  }
  if (VIDEO_EXTENSION.test(url.pathname)) {
    const fileName = url.pathname.split('/').filter(Boolean).at(-1) || '';
    let defaultTitle = fileName.replace(VIDEO_EXTENSION, '');
    try { defaultTitle = decodeURIComponent(defaultTitle); } catch { /* Keep the URL-encoded filename. */ }
    return { url: url.href, mediaType: 'video', embedUrl: '', defaultTitle: defaultTitle || '동영상' };
  }
  return {
    url: url.href,
    mediaType: 'link',
    embedUrl: '',
    defaultTitle: url.hostname.replace(/^www\./i, ''),
  };
}
