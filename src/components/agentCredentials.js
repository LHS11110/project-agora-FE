const storageKey = 'agora-agent-personal-api-key';
const cliStoragePrefix = 'agora-agent-cli-api-key:';

export function normalizeAgentKey(value) {
  if (typeof value !== 'string') return '';
  const key = value.trim();
  return key.length <= 4096 && /^[\x21-\x7e]*$/.test(key) ? key : '';
}

export function loadAgentKey() {
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

export function loadCliAgentKey(tool) {
  if (typeof tool !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(tool)) return '';
  try {
    return normalizeAgentKey(sessionStorage.getItem(cliStoragePrefix + tool));
  } catch {
    return '';
  }
}

export function saveCliAgentKey(tool, value) {
  const key = normalizeAgentKey(value);
  if (typeof tool !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(tool)) return key;
  try {
    if (key) sessionStorage.setItem(cliStoragePrefix + tool, key);
    else sessionStorage.removeItem(cliStoragePrefix + tool);
  } catch {
    /* Keep the key only in component memory if browser storage is unavailable. */
  }
  return key;
}
