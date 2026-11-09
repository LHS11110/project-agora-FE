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
    return Number.isFinite(Number(claims.exp)) && Number(claims.exp) * 1000 > Date.now();
  } catch {
    return false;
  }
}

// Only the signed, user/canvas-scoped grant is remembered, never the password.
// Its original server expiration is preserved across tabs and reconnects.
export function readCanvasPasswordGrant(key) {
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const storage = globalThis[name], grant = storage?.getItem(key);
      if (grant && isUnexpiredJwt(grant)) {
        if (name === 'sessionStorage') { try { localStorage.setItem(key, grant); } catch {} }
        return grant;
      }
      storage?.removeItem(key);
    } catch { /* The other storage can still work in restricted browsers. */ }
  }
  return null;
}

export function saveCanvasPasswordGrant(key, grant) {
  const valid = grant && isUnexpiredJwt(grant);
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const storage = globalThis[name];
      if (valid) storage?.setItem(key, grant);
      else storage?.removeItem(key);
    } catch { /* The normal server password flow remains available. */ }
  }
}
