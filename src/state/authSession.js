// Expiry inspection is only a client-side UX guard; the server verifies signatures.
export function tokenExpired(token, now = Date.now()) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !Number.isFinite(payload.exp) || payload.exp * 1000 <= now;
  } catch { return true; }
}
export function isCurrentAccountFailure(currentToken, rejectedToken) {
  return Boolean(currentToken && rejectedToken && currentToken === rejectedToken);
}
