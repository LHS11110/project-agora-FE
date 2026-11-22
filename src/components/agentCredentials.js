import { agentProvider } from './agentPreferences.js';

const providerStoragePrefix = 'agora-agent-api-key:';
// Keys of removed engines: VM CLI agents (per tool) and EXAONE, which is no longer
// offered. They are dropped from the tab so they are not left behind in storage.
const legacyCliStoragePrefix = 'agora-agent-cli-api-key:';
const legacyExaoneStorageKey = 'agora-agent-personal-api-key';

function keyName(provider) {
  return `${providerStoragePrefix}${agentProvider(provider).id}`;
}

export function normalizeAgentKey(value) {
  if (typeof value !== 'string') return '';
  const key = value.trim();
  return key.length <= 4096 && /^[\x21-\x7e]*$/.test(key) ? key : '';
}

function purgeLegacyKeys() {
  try {
    sessionStorage.removeItem(legacyExaoneStorageKey);
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const name = sessionStorage.key(index);
      if (name?.startsWith(legacyCliStoragePrefix)) sessionStorage.removeItem(name);
    }
  } catch {
    /* Storage may be unavailable. */
  }
}

/** Personal keys are per provider and live only in this tab (sessionStorage). */
export function loadAgentKey(provider) {
  purgeLegacyKeys();
  try {
    return normalizeAgentKey(sessionStorage.getItem(keyName(provider)));
  } catch {
    return '';
  }
}

export function saveAgentKey(value, provider) {
  const key = normalizeAgentKey(value);
  try {
    if (key) sessionStorage.setItem(keyName(provider), key);
    else sessionStorage.removeItem(keyName(provider));
  } catch {
    /* Keep the key only in component memory if browser storage is unavailable. */
  }
  return key;
}
