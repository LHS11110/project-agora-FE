
const RUNTIME_TIMEOUT_MS = 260_000;

export async function executeCanvasCode({ canvasId, token, user, objectId, notebookId, cellId, language, code, stdin, action, sendRaw, pendingRequests, management, operation, service, agent }, onOutput) {

  if (typeof sendRaw !== 'function' || !(pendingRequests instanceof Map)) {
    throw new Error('실시간 캔버스 연결에서 실행 요청을 보낼 수 없습니다.');
  }
  const requestId = crypto.randomUUID();
  const request = {
    type: 'runtime_execute',
    request_id: requestId,
    action: action === 'agent' ? 'agent' : action === 'service' ? 'service' : action === 'manage' || action === 'reset' ? 'manage' : action === 'build' ? 'build' : action === 'notebook' ? 'notebook' : 'execute',
    ...(action === 'manage' ? {management} : action === 'reset' ? {management:{action:'reset'}} : {}),
    ...(action === 'notebook' ? {operation:operation||'execute'} : {}),
    ...(action==='service'?{service}:{}),
    ...(action==='agent'?{operation:operation||'run',message:String(agent?.message||''),selected_ids:agent?.selected_ids||[],history:agent?.history||[],anchor:agent?.anchor,allow_delete:agent?.allow_delete===true,options:agent?.options||{},api_key:typeof agent?.api_key==='string'?agent.api_key:'',...(agent?.cli_tool?{cli_tool:agent.cli_tool}:{}),session_id:agent?.session_id,turn_id:agent?.turn_id,include_history:agent?.include_history!==false,offset:agent?.offset,before:agent?.before,limit:agent?.limit}:{}),
    object_id: String(objectId || ''),
    code: String(code || ''),
    ...(action === 'notebook'
      ? { notebook_id: String(notebookId || ''), cell_id: String(cellId || '') }
      : { language: String(language || 'javascript'), ...(typeof stdin === 'string' ? { stdin } : {}) }),
  };

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      const error=new Error('C++ 브로커의 실행 응답 시간이 초과되었습니다.');error.code='RUNTIME_RESPONSE_TIMEOUT';reject(error);
    }, RUNTIME_TIMEOUT_MS);
    pendingRequests.set(requestId, { resolve, reject, timer, onOutput });
    let sent;
    try{sent=sendRaw(request);}catch(error){window.clearTimeout(timer);pendingRequests.delete(requestId);reject(error);return;}
    if (!sent) {
      window.clearTimeout(timer);
      pendingRequests.delete(requestId);
      const error=new Error('캔버스 WebSocket 연결이 열려 있지 않습니다.');error.code='CANVAS_SOCKET_UNAVAILABLE';reject(error);
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
    const busyMessages = {
      AGENT_SESSION_STORAGE_ERROR: '대화 저장소에 연결하지 못했습니다. 잠시 후 다시 확인해주세요. 실행 중이던 작업은 자동으로 다시 실행하지 않습니다.',
      AGENT_REQUEST_BUSY: '이 캔버스에서 AI 에이전트가 작업 중입니다. 작업이 끝난 뒤 다시 시도해주세요.',
      WATCH_READ_ONLY: '관전을 종료하면 편집과 코드 실행을 할 수 있습니다.',
      AGENT_SESSION_DELETE_DENIED: '대화 작성자 또는 캔버스 관리자만 삭제할 수 있습니다.',
      AGENT_SESSION_DRAFT_REQUIRED: '사용자별 새 대화는 하나씩 유지됩니다.',
      AGENT_SESSION_READ_ONLY: '다른 사용자의 대화는 조회만 가능합니다. 새 대화를 시작하거나 프롬프트를 다시 사용해주세요.',
      AGENT_SESSION_ACCESS_DENIED: '이 대화에 포함된 객체를 볼 수 있는 권한이 없습니다.',
      AGENT_SESSION_RUNNING: '이 대화에서 작업이 진행 중입니다. 완료 후 다시 시도해주세요.',
      AGENT_STATUS_BUSY: '에이전트 상태 조회 요청이 많습니다. 잠시 후 다시 시도해주세요.',
      CLI_TOOL_NOT_INSTALLED: 'VM에 선택한 CLI 도구가 설치되어 있지 않습니다. 에이전트 설정에서 먼저 설치해주세요.',
      CLI_INSTALL_FAILED: 'VM에 CLI 도구를 설치하지 못했습니다.',
      CLI_AGENT_FAILED: 'VM CLI 에이전트 실행에 실패했습니다.',
      RUNTIME_EXECUTION_DENIED: '캔버스 실행 권한이 필요합니다. (RUNTIME_EXECUTION_DENIED)',
      RUNTIME_VM_UNAVAILABLE: '캔버스 VM에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      RUNTIME_MANAGER_UNAVAILABLE: 'VM 런타임 관리자에 연결할 수 없습니다.',
      RUNTIME_BUSY: '다른 실행 요청을 처리하고 있습니다. 완료 후 다시 시도해주세요.',
    };
    const error = new Error(event.message || busyMessages[event.code] || event.code || '코드 실행에 실패했습니다.');
    error.code = event.code;error.status=event.status;error.payload=event;
    request.reject(error);
  }
  return true;
}

export function rejectRuntimeSocketRequests(pendingRequests, message) {
  for (const [requestId, request] of pendingRequests) {
    window.clearTimeout(request.timer);
    const error=new Error(message || '캔버스 WebSocket 연결이 종료되었습니다.');error.code='CANVAS_SOCKET_CLOSED';request.reject(error);
    pendingRequests.delete(requestId);
  }
}
