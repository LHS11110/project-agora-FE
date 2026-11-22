const storageKey = 'agora-agent-personal-api-key';
const legacyCliStoragePrefix = 'agora-agent-cli-api-key:';

export function normalizeAgentKey(value) {
  if (typeof value !== 'string') return '';
  const key = value.trim();
  return key.length <= 4096 && /^[\x21-\x7e]*$/.test(key) ? key : '';
}

// VM CLI agents were removed. Drop any per-tool keys an earlier version kept in
// this tab so they are not left behind in browser storage.
function purgeLegacyCliKeys() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const name = sessionStorage.key(index);
      if (name?.startsWith(legacyCliStoragePrefix)) sessionStorage.removeItem(name);
    }
  } catch {
    /* Storage may be unavailable. */
  }
}

export function loadAgentKey() {
  purgeLegacyCliKeys();
  try {
    return normalizeAgentKey(sessionStorage.getItem(storageKey));
  } catch {
    return '';
  }
}

export function saveAgentKey(value) {
  const key = normalizeAgentKey(value);
  try {
    if (key) sessionStorage.setItem(storageKey, key);
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* Keep the key only in component memory if browser storage is unavailable. */
  }
  return key;
}
