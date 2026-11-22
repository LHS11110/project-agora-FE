import { ui } from '../i18n/locale.js';
import { agentProvider } from './agentPreferences.js';

// Confirmation a user gives before an AI provider receives canvas content:
// age and the provider's terms (Gemini/OpenRouter 18+, OpenAI minors need a
// guardian) and consent to sending canvas content abroad. Stored per account and
// provider in this browser; a new version asks again.
export const AGENT_CONSENT_VERSION = '2026-11-23';
const storageKey = 'agora-agent-consent-v1';

function readAll() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeAll(value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* Without storage the consent lasts only for this page. */
  }
}

const entry = (userId, provider) => `${userId ?? 'anonymous'}:${agentProvider(provider).id}`;
const memory = new Map();

export function hasAgentConsent(userId, provider) {
  const name = entry(userId, provider);
  return readAll()[name] === AGENT_CONSENT_VERSION || memory.get(name) === AGENT_CONSENT_VERSION;
}

export function saveAgentConsent(userId, provider) {
  const name = entry(userId, provider);
  memory.set(name, AGENT_CONSENT_VERSION);
  writeAll({ ...readAll(), [name]: AGENT_CONSENT_VERSION });
}

export function revokeAgentConsent(userId, provider) {
  const name = entry(userId, provider);
  memory.delete(name);
  const all = readAll();
  delete all[name];
  writeAll(all);
}

/** Blocks model runs (panel and multi-agent graph) until the user has consented. */
export function requireAgentConsent(userId, operation, options) {
  if (operation !== 'run') return;
  const provider = agentProvider(options?.provider);
  if (hasAgentConsent(userId, provider.id)) return;
  const error = new Error(ui('에이전트 설정에서 {provider} 이용 조건과 데이터 전송에 동의한 뒤 사용해주세요.', { provider: provider.label }));
  error.code = 'AGENT_CONSENT_REQUIRED';
  throw error;
}
