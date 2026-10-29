import { api } from '../../api/client.js';
import { canvasPasswordGrantKey, readCanvasPasswordGrant } from '../canvasAccess.js';

export function executeCanvasCode({ canvasId, token, user, language, code }) {
  const passwordGrant = readCanvasPasswordGrant(canvasPasswordGrantKey(canvasId, user));
  return api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/execute`, {
    method: 'POST', token, body: { language, code, passwordGrant },
  });
}
