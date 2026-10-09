const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  const address = /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') ? path : `${API_BASE}${path}`;
  const url = new URL(address, window.location.href || `https://${window.location.host}/`);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('API 연결에는 HTTPS 주소만 사용할 수 있습니다.');
  return url.href;
}

export class ApiError extends Error {
  constructor(message, status, code, payload) {
    super(message || '요청을 처리하지 못했습니다.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      ...(body instanceof FormData ? {} : body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');
  if (!response.ok) {
    if (response.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('agora:unauthorized'));
    }
    throw new ApiError(payload?.message || payload?.error || '요청을 처리하지 못했습니다.', response.status, payload?.code, payload);
  }
  return payload;
}

function socketUrl(canvasId, wsPort, token, channel) {
  if (window.location.protocol !== 'https:') throw new Error('HTTPS 주소로 접속해주세요.');
  const base = import.meta.env.VITE_WS_BASE_URL?.replace(/\/$/, '') || `wss://${window.location.host}`;
  const origin = new URL(base);
  if (origin.protocol !== 'wss:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('실시간 연결에는 WSS origin만 사용할 수 있습니다.');
  }
  return `${origin.origin}/wss/port/${encodeURIComponent(wsPort)}/${channel}canvas/${canvasId}?token=${encodeURIComponent(token)}`;
}

export function canvasSocketUrl(canvasId, wsPort, token) { return socketUrl(canvasId, wsPort, token, ''); }

export function rtcSocketUrl(canvasId, wsPort, token) {
  return socketUrl(canvasId, wsPort, token, 'rtc/');
}
