import { ui } from '../i18n/locale.js';
import { agentProvider } from './agentPreferences.js';

// Prior consent covered a different set of recipients and canvas data.
export const AGENT_CONSENT_VERSION = 'claude-prompt-v1';
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

// Graph prompts may include data from connected canvas objects. Review exactly
// what will be sent before each model request, including subsequent graph steps.
let pendingReview = Promise.resolve();
export function reviewAgentPrompt(message, signal) {
  const review = pendingReview.then(() => new Promise(resolve => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const dialog = document.createElement('dialog');
    const title = document.createElement('h2');
    title.id = 'canvas-agent-review-title';
    title.textContent = ui('Claude에 보낼 내용 확인');
    dialog.setAttribute('aria-labelledby', title.id);
    const notice = document.createElement('p');
    notice.textContent = ui('전송할 권한이 있는 내용만 보내세요. 개인정보나 기밀정보가 포함된 경우 취소하세요.');
    const preview = document.createElement('textarea');
    preview.readOnly = true;
    preview.value = message;
    preview.rows = 12;
    preview.style.width = '100%';
    preview.setAttribute('aria-label', title.textContent);
    const actions = document.createElement('form');
    actions.method = 'dialog';
    const cancel = document.createElement('button');
    cancel.textContent = ui('취소');
    cancel.value = 'cancel';
    cancel.autofocus = true;
    const send = document.createElement('button');
    send.textContent = ui('전송');
    send.value = 'send';
    actions.append(cancel, send);
    dialog.append(title, notice, preview, actions);
    dialog.style.width = 'min(42rem, 90vw)';
    document.body.append(dialog);
    const abort = () => dialog.close();
    signal?.addEventListener('abort', abort, { once: true });
    dialog.addEventListener('close', () => {
      signal?.removeEventListener('abort', abort);
      const approved = dialog.returnValue === 'send';
      dialog.remove();
      resolve(approved);
    }, { once: true });
    dialog.showModal();
  }));
  pendingReview = review.catch(() => false);
  return review;
}
