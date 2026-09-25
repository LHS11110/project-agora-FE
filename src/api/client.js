const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
  const response = await fetch(`${API_BASE}${path}`, {
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
    throw new ApiError(payload?.message || payload?.error || '요청을 처리하지 못했습니다.', response.status, payload?.code, payload);
  }
  return payload;
}

export function canvasSocketUrl(canvasId, wsPort, token) {
  const encodedToken = encodeURIComponent(token);
  const base = import.meta.env.VITE_WS_BASE_URL?.replace(/\/$/, '');
  if (base) return `${base}/wss/port/${encodeURIComponent(wsPort)}/canvas/${canvasId}?token=${encodedToken}`;
  if (import.meta.env.DEV) {
    const host = import.meta.env.VITE_CPP_WS_HOST || window.location.hostname;
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${host}:${wsPort}/ws/canvas/${canvasId}?token=${encodedToken}`;
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/wss/port/${encodeURIComponent(wsPort)}/canvas/${canvasId}?token=${encodedToken}`;
}

export function rtcSocketUrl(canvasId, wsPort, token) {
  const encodedToken = encodeURIComponent(token);
  const base = import.meta.env.VITE_WS_BASE_URL?.replace(/\/$/, '');
  if (base) return `${base}/wss/port/${encodeURIComponent(wsPort)}/rtc/canvas/${canvasId}?token=${encodedToken}`;
  if (import.meta.env.DEV) {
    const host = import.meta.env.VITE_CPP_WS_HOST || window.location.hostname;
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${host}:${encodeURIComponent(wsPort)}/ws/rtc/canvas/${canvasId}?token=${encodedToken}`;
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/wss/port/${encodeURIComponent(wsPort)}/rtc/canvas/${canvasId}?token=${encodedToken}`;
}
