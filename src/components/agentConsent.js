import { ui } from '../i18n/locale.js';

import { api } from '../api/client.js';

export const AGENT_CONSENT_VERSION = 'agent-local-v2';
const endpoint = '/api/users/agent-terms';

export function loadAgentTerms(token) {
  return api(endpoint, { token });
}

export function saveAgentDecision(token, accepted) {
  return api(endpoint, {
    method: 'PUT', token,
    body: { version: AGENT_CONSENT_VERSION, accepted },
  });
}

export async function requireAgentConsent(token, operation) {
  if (operation !== 'run') return;
  const terms = await loadAgentTerms(token);
  if (terms.version === AGENT_CONSENT_VERSION && terms.accepted === true) return;
  const error = new Error(ui('Agora AI 에이전트 이용약관에 동의한 뒤 사용해주세요.'));
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
    title.textContent = ui('로컬 모델에 보낼 내용 확인');
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
