
const RUNTIME_TIMEOUT_MS = 260_000;

export async function executeCanvasCode({ canvasId, token, user, objectId, notebookId, cellId, language, code, stdin, action, sendRaw, pendingRequests, management, operation, service }, onOutput) {

  if (typeof sendRaw !== 'function' || !(pendingRequests instanceof Map)) {
    throw new Error('실시간 캔버스 연결에서 실행 요청을 보낼 수 없습니다.');
  }
  const requestId = crypto.randomUUID();
  const request = {
    type: 'runtime_execute',
    request_id: requestId,
    action: action === 'service' ? 'service' : action === 'manage' || action === 'reset' ? 'manage' : action === 'build' ? 'build' : action === 'notebook' ? 'notebook' : 'execute',
    ...(action === 'manage' ? {management} : action === 'reset' ? {management:{action:'reset'}} : {}),
    ...(action === 'notebook' ? {operation:operation||'execute'} : {}),
    ...(action==='service'?{service}:{}),
    object_id: String(objectId || ''),
    code: String(code || ''),
    ...(action === 'notebook'
      ? { notebook_id: String(notebookId || ''), cell_id: String(cellId || '') }
      : { language: String(language || 'javascript'), ...(typeof stdin === 'string' ? { stdin } : {}) }),
  };

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('C++ 브로커의 실행 응답 시간이 초과되었습니다.'));
    }, RUNTIME_TIMEOUT_MS);
    pendingRequests.set(requestId, { resolve, reject, timer, onOutput });
    let sent;
    try{sent=sendRaw(request);}catch(error){window.clearTimeout(timer);pendingRequests.delete(requestId);reject(error);return;}
    if (!sent) {
      window.clearTimeout(timer);
      pendingRequests.delete(requestId);
      reject(new Error('캔버스 WebSocket 연결이 열려 있지 않습니다.'));
    }
  });
}

export function settleRuntimeSocketResponse(pendingRequests, event) {
  const request = pendingRequests.get(event?.request_id);
  if (!request) return false;
  if (event.type === 'runtime_output') {
    try { request.onOutput?.(String(event.output || '')); }
    catch (error) {
      window.clearTimeout(request.timer);
      pendingRequests.delete(event.request_id);
      request.reject(error);
    }
    return true;
  }
  if (!['runtime_result', 'error'].includes(event?.type)) return false;
  window.clearTimeout(request.timer);
  pendingRequests.delete(event.request_id);
  if (event.type === 'runtime_result' && event.ok === true && event.result && typeof event.result === 'object') {
    request.resolve(event.result);
  } else {
    const error = new Error(event.message || event.code || '코드 실행에 실패했습니다.');
    error.code = event.code;error.status=event.status;error.payload=event;
    request.reject(error);
  }
  return true;
}

export function rejectRuntimeSocketRequests(pendingRequests, message) {
  for (const [requestId, request] of pendingRequests) {
    window.clearTimeout(request.timer);
    request.reject(new Error(message || '캔버스 WebSocket 연결이 종료되었습니다.'));
    pendingRequests.delete(requestId);
  }
}
