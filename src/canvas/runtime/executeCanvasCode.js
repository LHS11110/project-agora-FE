import { api } from '../../api/client.js';
import { canvasPasswordGrantKey, readCanvasPasswordGrant } from '../canvasAccess.js';

export function executeCanvasCode({ canvasId, token, user, language, code, action }) {
  const passwordGrant = readCanvasPasswordGrant(canvasPasswordGrantKey(canvasId, user));
  return api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/${action === 'reset' ? 'reset' : 'execute'}`, {
    method: 'POST', token, body: action === 'reset' ? { passwordGrant } : { language, code, passwordGrant },
  });
}
