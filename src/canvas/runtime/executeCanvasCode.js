import { api } from '../../api/client.js';
import { canvasPasswordGrantKey, readCanvasPasswordGrant } from '../canvasAccess.js';

export function executeCanvasCode({ canvasId, token, user, language, code, stdin, action }) {
  const passwordGrant = readCanvasPasswordGrant(canvasPasswordGrantKey(canvasId, user));
  return api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/${action === 'reset' ? 'reset' : 'execute'}`, {
    method: 'POST', token, body: action === 'reset' ? { passwordGrant } : { language, code, ...(typeof stdin === 'string' ? {stdin} : {}), passwordGrant },
  });
}
