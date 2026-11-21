import {canvasApiRequest} from './canvasTransport.js';
import {bearer,currentAccessToken,refreshAccessToken,sameSession,tokenExpired} from '../state/authSession.js';
export {canvasFetch} from './canvasTransport.js';
const API_BASE = ((import.meta.env && import.meta.env.VITE_API_BASE_URL) || '').replace(/\/$/, '');

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

const SESSION_ENDPOINT = /^\/api\/auth\/session\//;
const REFRESH_AHEAD_MS = 30_000;

function unauthorized(token, payload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('agora:unauthorized', { detail: { token, message: payload?.message, reason: payload?.reason } }));
}

async function freshToken(token) {
  if (!token || !tokenExpired(currentAccessToken(token), Date.now() + REFRESH_AHEAD_MS)) return;
  try { await refreshAccessToken({ ifExpiringBefore: Date.now() + REFRESH_AHEAD_MS }); } catch { /* The request itself reports the failure. */ }
}

export async function api(path, options = {}) {
  const { token } = options;
  await freshToken(token);
  try {
    return await sendApi(path, options);
  } catch (error) {
    // An access token can expire or be rejected mid-flight; one refresh and retry
    // keeps the session, and only a failed refresh ends it.
    if (!(error instanceof ApiError) || error.status !== 401 || !token || SESSION_ENDPOINT.test(path)) throw error;
    let refreshed = null;
    try { refreshed = await refreshAccessToken(); } catch { throw error; }
    if (!refreshed || !sameSession(token, refreshed.accessToken)) { unauthorized(token, error.payload); throw error; }
    try { return await sendApi(path, options); }
    catch (retryError) { if (retryError instanceof ApiError && retryError.status === 401) unauthorized(token, retryError.payload); throw retryError; }
  }
}

async function sendApi(path, { method = 'GET', body, token, headers = {}, signal } = {}) {
  if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError');
  const routed=canvasApiRequest(apiUrl(path),{method,body,token,headers});
  if(routed){try{return await routed;}catch(error){
    throw new ApiError(error.message,error.status,error.code,error.payload);
  }}
  const response = await fetch(apiUrl(path), {
    method,
    ...(signal ? { signal } : {}),
    ...(path.startsWith('/api/auth/') ? { credentials: 'include' } : {}),
    headers: {
      ...(body instanceof FormData ? {} : body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: bearer(token) } : {}),
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

function socketUrl(canvasId, wsPort, token, channel) {
  if (window.location.protocol !== 'https:') throw new Error('HTTPS 주소로 접속해주세요.');
  const base = (import.meta.env && import.meta.env.VITE_WS_BASE_URL)?.replace(/\/$/, '') || `wss://${window.location.host}`;
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
