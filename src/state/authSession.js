// Access tokens live only in memory. The long-lived credential is an HttpOnly,
// SameSite=Strict refresh cookie scoped to /api/auth/session, so script
// injection cannot read anything that outlives a 15-minute access token.
//
// React state keeps the first access token of a session as a stable identity,
// so effects keyed on `token` do not rerun on every refresh. Requests resolve
// that identity to the latest access token of the same session (`sid`).

const SESSION_HEADER = 'X-Agora-Session';
const REFRESH_PATH = '/api/auth/session/refresh';
const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
let latest = null;
let pending = null;

export function tokenClaims(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

// Expiry inspection is only a client-side UX guard; the server verifies signatures.
export function tokenExpired(token, now = Date.now()) {
  const exp = tokenClaims(token)?.exp;
  return !Number.isFinite(exp) || exp * 1000 <= now;
}

export const sessionId = token => tokenClaims(token)?.sid || null;

export function sameSession(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const sid = sessionId(a);
  return Boolean(sid) && sid === sessionId(b);
}

/** Latest access token for the session that `token` belongs to. */
export function currentAccessToken(token) {
  return token && latest && sameSession(token, latest) ? latest : token;
}

export const bearer = token => `Bearer ${currentAccessToken(token)}`;

export function setAccessToken(token, user = null) {
  latest = token || null;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('agora:access-token', { detail: { token: latest, user } }));
  }
}

export const clearAccessToken = () => setAccessToken(null);

export function isCurrentAccountFailure(currentToken, rejectedToken) {
  return sameSession(currentToken, rejectedToken);
}

const sessionUrl = path => new URL(`${API_BASE}${path}`, window.location.href).href;

async function requestRefresh() {
  const response = await fetch(sessionUrl(REFRESH_PATH), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { [SESSION_HEADER]: '1' },
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

// Tabs share the refresh cookie and every refresh rotates it, so refreshes are
// serialized across tabs; a tab that waited then presents the rotated cookie.
function withRefreshLock(task) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
  return locks?.request ? locks.request('agora-session-refresh', task) : task();
}

/**
 * Exchanges the refresh cookie for a new access token.
 * Resolves to the login payload ({accessToken, user}), or null when the session is over.
 * Network failures reject, so callers can keep the session and retry later.
 */
export function refreshAccessToken({ ifExpiringBefore } = {}) {
  if (pending) return pending;
  pending = withRefreshLock(async () => {
    // Another refresh in this tab may have completed while we waited for the lock.
    if (ifExpiringBefore && latest && !tokenExpired(latest, ifExpiringBefore)) return { accessToken: latest, user: null };
    let result = await requestRefresh();
    if (!result.ok && result.payload?.reason === 'REFRESH_RACE') {
      await new Promise(resolve => setTimeout(resolve, 400));
      result = await requestRefresh();
    }
    if (!result.ok || !result.payload?.accessToken) {
      if (result.status >= 500) throw new Error('로그인 세션을 갱신하지 못했습니다.');
      return null;
    }
    setAccessToken(result.payload.accessToken, result.payload.user || null);
    return result.payload;
  }).finally(() => { pending = null; });
  return pending;
}

/** Ends this session on the server and clears the refresh cookie. */
export async function endServerSession({ everywhere = false, token } = {}) {
  const access = currentAccessToken(token || latest);
  try {
    await fetch(sessionUrl(everywhere ? '/api/auth/session/logout-all' : '/api/auth/session/logout'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: !everywhere,
      headers: { [SESSION_HEADER]: '1', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    });
    return true;
  } catch { return false; }
}
