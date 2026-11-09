import { readRuntimeStream } from './readRuntimeStream.js';
import { api, apiUrl, ApiError } from '../../api/client.js';
import { canvasPasswordGrantKey } from '../canvasAccess.js';
import {ensureCanvasPasswordGrant} from '../canvasPasswordSession.js';

export async function executeCanvasCode({ canvasId, token, user, language, code, stdin, action, onOutput }) {
  const passwordGrant = await ensureCanvasPasswordGrant(canvasPasswordGrantKey(canvasId, user));
  if (!action && typeof onOutput === 'function') {
    const response = await fetch(apiUrl(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/execute/stream`), {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
      body:JSON.stringify({language,code,...(typeof stdin==='string'?{stdin}:{}),passwordGrant}),
    });
    if (!response.ok) {
      const payload = await response.json().catch(()=>null);
      if(response.status===401)window.dispatchEvent(new CustomEvent('agora:unauthorized',{detail:{token,message:payload?.message,reason:payload?.reason}}));
      throw new ApiError(payload?.message||'코드 실행에 실패했습니다.',response.status,payload?.code,payload);
    }
    return readRuntimeStream(response,onOutput);
  }
  return api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/${action === 'reset' ? 'reset' : action === 'build' ? 'build' : 'execute'}`, {
    method: 'POST', token, body: action === 'reset' ? { passwordGrant } : { language, code, ...(typeof stdin === 'string' ? {stdin} : {}), passwordGrant },
  });
}
