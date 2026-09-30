export function canvasPasswordGrantKey(canvasId, user) {
  const identity = user?.email || `${user?.nickname || 'unknown'}#${user?.tag_number ?? ''}`;
  return `agora_canvas_password_grant:${canvasId}:${encodeURIComponent(identity)}`;
}

export function isUnexpiredJwt(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return Number.isFinite(Number(claims.exp)) && Number(claims.exp) * 1000 > Date.now() + 5000;
  } catch {
    return false;
  }
}

export function readCanvasPasswordGrant(key) {
  try {
    const grant = sessionStorage.getItem(key);
    if (grant && isUnexpiredJwt(grant)) return grant;
    sessionStorage.removeItem(key);
  } catch {
    // Storage can be disabled by the browser; the server-side password flow still works.
  }
  return null;
}

export function saveCanvasPasswordGrant(key, grant) {
  try {
    if (grant && isUnexpiredJwt(grant)) sessionStorage.setItem(key, grant);
    else sessionStorage.removeItem(key);
  } catch {
    // Storage can be disabled by the browser; the server-side password flow still works.
  }
}

