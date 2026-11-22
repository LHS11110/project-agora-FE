import {
  AGENT_DEFAULTS,
  modelOptions,
  normalizeAgentPreferences,
} from '../../components/agentPreferences.js';

export const AGENT_NODE_PREFIX = 'agent1:';
export const AGENT_ORCHESTRATOR_PREFIX = 'orchestrator1:';
export const AGENT_INPUT_PREFIX = 'agentInput1:';
export const AGENT_ROUTER_PREFIX = 'agentRouter1:';
export const AGENT_OUTPUT_PREFIX = 'agentOutput1:';
export const AGENT_EDGE_PREFIX = 'agentEdge1:';

export const INPUT_DATA_FORMATS = [
  { id: 'text', label: '텍스트', description: '일반 텍스트, 마크다운, 프롬프트 메모' },
  { id: 'image', label: '이미지', description: 'PNG, JPG, WebP, GIF 등 시각 자료' },
  { id: 'audio', label: '오디오', description: '음성, 녹음, MP3/WAV/OGG 오디오' },
  { id: 'video', label: '동영상', description: 'MP4, WebM, YouTube 동영상' },
  { id: 'pdf', label: 'PDF', description: 'PDF 문서 및 보고서' },
  { id: 'json', label: 'JSON', description: 'JSON 데이터 객체·배열·API 페이로드' },
  { id: 'code', label: '코드', description: '소스 코드 및 스크립트 파일' },
  { id: 'table', label: '표·데이터', description: '테이블, 차트, CSV/XLSX 시트' },
  { id: 'link', label: '링크', description: '웹 URL 및 외부 리소스' },
];

export const INPUT_TYPE_OPTIONS = [
  { id: 'auto', label: '자동 감지', description: '입력 내용과 첨부·연결된 객체의 형식을 자동으로 판별합니다.' },
  ...INPUT_DATA_FORMATS,
];

export const ROUTING_MODES = [
  { id: 'format', label: '데이터 포맷 기반', description: '입력 포맷(텍스트·이미지·오디오·동영상·PDF·JSON 등)과 키워드 규칙으로 분기합니다.' },
  { id: 'json', label: 'JSON 규칙 기반', description: '입력 JSON의 필드·값 조건 또는 JSON 라우팅 규칙 정의에 따라 에이전트로 분기합니다.' },
  { id: 'intelligent', label: '에이전트 지능형', description: '라우팅 AI 에이전트가 입력 의도와 형식을 분석해 적합한 에이전트를 선택합니다.' },
  { id: 'hybrid', label: '하이브리드 (규칙 + 지능형)', description: 'JSON·포맷 규칙을 먼저 확인하고, 미일치 시 지능형 에이전트로 라우팅합니다.' },
];

export const JSON_RULE_OPERATORS = [
  { id: 'equals', label: '같음 (==)' },
  { id: 'not_equals', label: '다름 (!=)' },
  { id: 'contains', label: '포함 (contains)' },
  { id: 'in', label: '목록 포함 (in)' },
  { id: 'exists', label: '필드 존재 (exists)' },
  { id: 'not_exists', label: '필드 없음 (not_exists)' },
  { id: 'gt', label: '큼 (>)' },
  { id: 'gte', label: '크거나 같음 (>=)' },
  { id: 'lt', label: '작음 (<)' },
  { id: 'lte', label: '작거나 같음 (<=)' },
  { id: 'regex', label: '정규식 일치 (regex)' },
  { id: 'type', label: '자료형 (type)' },
];

export const ROUTER_FALLBACK_POLICIES = [
  { id: 'default_target', label: '기본 경로(폴백)로 전달' },
  { id: 'first', label: '첫 번째 연결 대상으로 전달' },
  { id: 'all', label: '모든 연결 대상으로 전달' },
  { id: 'skip', label: '일치 경로 없으면 건너뜀' },
];

export const OUTPUT_DISPLAY_MODES = [
  { id: 'markdown', label: '마크다운' },
  { id: 'plain', label: '일반 텍스트' },
  { id: 'json', label: 'JSON 보기' },
];

export const ORCHESTRATION_MODES = [
  { id: 'graph', label: '그래프 파이프라인', description: '연결 방향(DAG)에 따라 순차·병렬로 실행합니다.' },
  { id: 'collaborative', label: '협업 라운드', description: '핸드오프·피드백·수정 요청을 반복하며 합의에 도달합니다.' },
  { id: 'supervisor', label: '감독자 위임', description: '감독 에이전트가 작업을 분배하고 결과를 검토·종합합니다.' },
];

export const EDGE_CHANNELS = [
  { id: 'auto', label: '자동 추론' },
  { id: 'input', label: '사용자 입력' },
  { id: 'route', label: '라우팅 경로' },
  { id: 'supervisor', label: '감독자 지정' },
  { id: 'prompt', label: '기본 프롬프트' },
  { id: 'data', label: '입력 데이터' },
  { id: 'context', label: '배경 컨텍스트' },
  { id: 'handoff', label: '작업 핸드오프' },
  { id: 'feedback', label: '검토 피드백' },
  { id: 'output', label: '결과 전달' },
];

export const EDGE_DELIVERY_MODES = [
  { id: 'both', label: '본문 + 객체 참조' },
  { id: 'inline', label: '프롬프트에 본문 포함' },
  { id: 'reference', label: '객체 ID만 첨부' },
];

export const AGENT_ACCENT_COLORS = ['#6d5ce7', '#2f855a', '#2b6cb0', '#c05621', '#b83280', '#0f766e'];

export const AGENT_ROLE_PRESETS = [
  {
    id: 'general',
    label: '범용 에이전트',
    defaultTitle: 'AI 에이전트',
    role: '범용 협업자',
    color: '#6d5ce7',
    systemPrompt: '연결된 입력 데이터와 동료 에이전트의 산출물을 바탕으로 정확하고 구조화된 결과를 작성하세요.',
  },
  {
    id: 'planner',
    label: '기획 · 아키텍트',
    defaultTitle: '기획자 에이전트',
    role: '기획자 · 아키텍트',
    color: '#2b6cb0',
    systemPrompt: '목표와 입력 자료를 분석해 작업 단계, 인터페이스 계약, 검증 기준을 명확히 설계하세요.',
  },
  {
    id: 'researcher',
    label: '조사 · 분석가',
    defaultTitle: '리서처 에이전트',
    role: '조사 · 분석가',
    color: '#0f766e',
    systemPrompt: '연결된 데이터·표·문서의 핵심 사실과 제약사항, 리스크를 근거와 함께 정리하세요.',
  },
  {
    id: 'developer',
    label: '구현 · 코드 작성가',
    defaultTitle: '구현 에이전트',
    role: '구현자 · 엔지니어',
    color: '#2f855a',
    systemPrompt: '기획과 피드백을 바탕으로 실행 가능한 코드 또는 구체적 구현안을 작성하고 필요한 캔버스 객체를 갱신하세요.',
  },
  {
    id: 'reviewer',
    label: '검토 · QA 리뷰어',
    defaultTitle: '리뷰어 에이전트',
    role: '품질 검토 · QA',
    color: '#c05621',
    systemPrompt: '앞선 에이전트의 결과를 비판적으로 검증하세요. 수정이 필요하면 [REVISE: 대상이름]으로 구체적 피드백을 보내고, 기준을 충족하면 [APPROVED]로 승인하세요.',
  },
  {
    id: 'writer',
    label: '종합 · 문서 작성가',
    defaultTitle: '작성가 에이전트',
    role: '편집 · 종합 작성가',
    color: '#b83280',
    systemPrompt: '팀 에이전트들의 산출물과 입력 데이터를 일관된 최종 문서나 실행 결과로 종합하세요.',
  },
];

export const MULTI_AGENT_TEMPLATES = [
  {
    id: 'mock-routing',
    label: '모형 에이전트 분기 테스트',
    description: '텍스트·이미지 분기, 선택되지 않은 경로, 출력 전달을 캔버스에서 확인합니다.',
  },
  {
    id: 'pipeline-review',
    label: '기획 → 구현 → 리뷰 협업 루프',
    description: '입력 객체에서 출발해 기획자·구현자·리뷰어가 최대 2라운드 피드백 루프로 협업하고 출력 객체에 결과를 저장합니다.',
  },
  {
    id: 'parallel-synthesis',
    label: '병렬 분석 → 종합 파이프라인',
    description: '입력 객체를 받아 두 분석 에이전트가 병렬로 검토한 뒤 종합 에이전트가 출력 객체에 통합합니다.',
  },
  {
    id: 'supervisor-team',
    label: '감독자 팀 위임 오케스트라',
    description: '입력 객체를 받아 감독 에이전트가 리서처·구현자에게 작업을 위임하고 결과를 출력 객체에 보고합니다.',
  },
  {
    id: 'smart-router-team',
    label: '멀티모달 라우터 팀',
    description: '텍스트·이미지·오디오·동영상·PDF 입력을 라우터가 포맷과 지능형 판단으로 전문 에이전트에 분기하고 출력 객체로 모읍니다.',
  },
];

const INPUT_FORMAT_IDS = new Set(INPUT_DATA_FORMATS.map(f => f.id));
const INPUT_TYPE_IDS = new Set(INPUT_TYPE_OPTIONS.map(f => f.id));
const ROUTING_MODE_IDS = new Set(ROUTING_MODES.map(m => m.id));
const ROUTER_FALLBACK_IDS = new Set(ROUTER_FALLBACK_POLICIES.map(p => p.id));
const OUTPUT_DISPLAY_IDS = new Set(OUTPUT_DISPLAY_MODES.map(m => m.id));
const ORCHESTRATION_MODE_IDS = new Set(ORCHESTRATION_MODES.map(mode => mode.id));
const EDGE_CHANNEL_IDS = new Set(EDGE_CHANNELS.map(channel => channel.id));
const EDGE_DELIVERY_IDS = new Set(EDGE_DELIVERY_MODES.map(mode => mode.id));

const MAX_FORMAT_LENGTH = 28000;
const MAX_PROMPT_CHARS = 6000;
export const MAX_MOCK_RESPONSE_CHARS = 1600;
const MAX_JSON_RULES_CHARS = 6000;
const MAX_GOAL_CHARS = 4000;
const MAX_TEXT_CHARS = 24000;
const MAX_RUN_LOG_ENTRIES = 24;
const MAX_INPUT_ATTACHMENTS = 12;
const MAX_ROUTER_ROUTES = 32;

const DEFAULT_ROUTER_PROMPT = [
  '연결된 입력의 데이터 포맷과 사용자 요청 의도를 분석해 가장 적합한 다음 에이전트(또는 경로)를 선택하세요.',
  '반드시 JSON 형식 {"targets":["대상ID 또는 이름"],"reason":"선택 근거"} 로 응답하세요.',
].join('\n');

function safeJsonParse(raw, prefix) {
  if (typeof raw !== 'string' || !raw.startsWith(prefix)) return null;
  try {
    const parsed = JSON.parse(raw.slice(prefix.length));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isAgentNodeItem(item) {
  return Boolean(
    item
    && item.kind === 'shape'
    && item.runtimeRole === 'executor'
    && typeof item.format === 'string'
    && item.format.startsWith(AGENT_NODE_PREFIX),
  );
}

export function isAgentOrchestratorItem(item) {
  return Boolean(
    item
    && item.kind === 'shape'
    && item.runtimeRole === 'executor'
    && typeof item.format === 'string'
    && item.format.startsWith(AGENT_ORCHESTRATOR_PREFIX),
  );
}

export function isAgentInputItem(item) {
  return Boolean(
    item
    && item.kind === 'shape'
    && item.runtimeRole === 'executor'
    && typeof item.format === 'string'
    && item.format.startsWith(AGENT_INPUT_PREFIX),
  );
}

export function isAgentRouterItem(item) {
  return Boolean(
    item
    && item.kind === 'shape'
    && item.runtimeRole === 'executor'
    && typeof item.format === 'string'
    && item.format.startsWith(AGENT_ROUTER_PREFIX),
  );
}

export function isAgentOutputItem(item) {
  return Boolean(
    item
    && item.kind === 'shape'
    && item.runtimeRole === 'output'
    && typeof item.format === 'string'
    && item.format.startsWith(AGENT_OUTPUT_PREFIX),
  );
}

export function isAgentRunnableItem(item) {
  return isAgentNodeItem(item)
    || isAgentOrchestratorItem(item)
    || isAgentInputItem(item)
    || isAgentRouterItem(item);
}

export function isAgentCanvasObject(item) {
  return isAgentRunnableItem(item) || isAgentOutputItem(item);
}

export function isAgentEdgeItem(item) {
  return Boolean(
    item
    && item.kind === 'connector'
    && typeof item.format === 'string'
    && item.format.startsWith(AGENT_EDGE_PREFIX),
  );
}

function sanitizeLastMeta(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const status = ['running', 'success', 'error', 'skipped'].includes(raw.status) ? raw.status : 'success';
  const entry = {
    updatedAt: Number.isSafeInteger(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : Date.now(),
    status,
  };
  if (typeof raw.runId === 'string') entry.runId = raw.runId.slice(0, 128);
  if (typeof raw.mode === 'string') entry.mode = raw.mode.slice(0, 32);
  if (Number.isInteger(raw.round) && raw.round >= 1 && raw.round <= 20) entry.round = raw.round;
  if (typeof raw.engine === 'string') entry.engine = raw.engine.slice(0, 16);
  if (typeof raw.model === 'string') entry.model = raw.model.slice(0, 128);
  if (Number.isInteger(raw.directivesCount) && raw.directivesCount >= 0) entry.directivesCount = raw.directivesCount;
  if (typeof raw.error === 'string' && raw.error) entry.error = raw.error.slice(0, 500);
  return entry;
}

function normalizeFormatList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const list = [];
  for (const entry of raw) {
    const id = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
    if (INPUT_FORMAT_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      list.push(id);
    }
  }
  return list;
}

export function normalizeAgentNodeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const prefs = normalizeAgentPreferences(source);
  const roleRaw = typeof source.role === 'string' ? source.role.trim() : '';
  const systemPromptRaw = typeof source.systemPrompt === 'string' ? source.systemPrompt : '';
  const presetId = typeof source.presetId === 'string' && AGENT_ROLE_PRESETS.some(p => p.id === source.presetId)
    ? source.presetId
    : 'general';
  return {
    v: 1,
    presetId,
    role: (roleRaw || '범용 협업자').slice(0, 120),
    systemPrompt: systemPromptRaw.slice(0, MAX_PROMPT_CHARS),
    engine: source.engine === 'mock' ? 'mock' : prefs.engine,
    mockResponse: typeof source.mockResponse === 'string' ? source.mockResponse.slice(0, MAX_MOCK_RESPONSE_CHARS) : '모형 응답입니다.',
    mockFollowup: typeof source.mockFollowup === 'string' ? source.mockFollowup.slice(0, MAX_MOCK_RESPONSE_CHARS) : '',
    provider: prefs.provider,
    model: prefs.model,
    reasoning_effort: prefs.reasoning_effort,
    max_tokens: prefs.max_tokens,
    max_steps: prefs.max_steps,
    temperature: prefs.temperature,
    top_p: prefs.top_p,
    allow_delete: source.allow_delete === true,
    attachInputsAsSelection: source.attachInputsAsSelection !== false,
    writeToOutputs: source.writeToOutputs !== false,
    canDelegate: source.canDelegate !== false,
    lastMeta: sanitizeLastMeta(source.lastMeta),
  };
}

export function readAgentNodeConfig(item) {
  return normalizeAgentNodeConfig(safeJsonParse(item?.format, AGENT_NODE_PREFIX) || {});
}

export function agentModelOptions(config) {
  return modelOptions(normalizeAgentNodeConfig(config));
}

function encodeBoundedFormat(prefix, payload, trimStep) {
  let current = payload;
  let encoded = `${prefix}${JSON.stringify(current)}`;
  if (encoded.length <= MAX_FORMAT_LENGTH) return encoded;
  current = trimStep(current);
  encoded = `${prefix}${JSON.stringify(current)}`;
  return encoded.slice(0, MAX_FORMAT_LENGTH);
}

export function writeAgentNodePatch(item, patchOrUpdater) {
  const prevConfig = readAgentNodeConfig(item);
  const rawPatch = typeof patchOrUpdater === 'function' ? patchOrUpdater(prevConfig, item) : patchOrUpdater;
  if (!rawPatch || typeof rawPatch !== 'object') return null;

  const { title, color, text, api_key: _drop1, cli_api_key: _drop2, cli_tool: _drop3, cli_model: _drop4, cli_command: _drop5, ...configPatch } = rawPatch;
  const nextConfig = normalizeAgentNodeConfig({ ...prevConfig, ...configPatch });
  const format = encodeBoundedFormat(AGENT_NODE_PREFIX, nextConfig, (cfg) => ({
    ...cfg,
    systemPrompt: cfg.systemPrompt.slice(0, 3000),
    lastMeta: cfg.lastMeta ? { updatedAt: cfg.lastMeta.updatedAt, status: cfg.lastMeta.status } : null,
  }));

  const out = { format };
  if (title !== undefined) out.title = String(title || '').slice(0, 120);
  if (color !== undefined && /^#[0-9a-f]{6}$/i.test(String(color))) out.color = String(color).toLowerCase();
  if (text !== undefined) out.text = String(text || '').slice(0, MAX_TEXT_CHARS);
  return out;
}

function sanitizeInputAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_INPUT_ATTACHMENTS).map((entry, idx) => {
    const src = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
    const formatType = INPUT_FORMAT_IDS.has(src.formatType) ? src.formatType : 'text';
    const item = {
      id: typeof src.id === 'string' && src.id.trim() ? src.id.trim().slice(0, 80) : `att-${idx + 1}`,
      formatType,
      name: String(src.name || '첨부 자료').slice(0, 160),
      mimeType: typeof src.mimeType === 'string' ? src.mimeType.slice(0, 120) : '',
    };
    if (typeof src.url === 'string' && src.url.trim()) item.url = src.url.trim().slice(0, 1000);
    if (typeof src.textSnippet === 'string' && src.textSnippet) item.textSnippet = src.textSnippet.slice(0, 1500);
    if (Number.isFinite(src.sizeBytes) && src.sizeBytes >= 0) item.sizeBytes = Math.round(src.sizeBytes);
    return item;
  });
}

export function normalizeAgentInputConfig(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    v: 1,
    inputType: INPUT_TYPE_IDS.has(source.inputType) ? source.inputType : 'auto',
    placeholder: typeof source.placeholder === 'string'
      ? source.placeholder.slice(0, 240)
      : '에이전트 팀에게 전달할 질문, 요구사항, 또는 파일·미디어를 입력하세요…',
    attachments: sanitizeInputAttachments(source.attachments),
    lastSubmittedAt: Number.isSafeInteger(source.lastSubmittedAt) && source.lastSubmittedAt >= 0
      ? source.lastSubmittedAt
      : null,
  };
}

export function readAgentInputConfig(item) {
  return normalizeAgentInputConfig(safeJsonParse(item?.format, AGENT_INPUT_PREFIX) || {});
}

export function writeAgentInputPatch(item, patchOrUpdater) {
  const prevConfig = readAgentInputConfig(item);
  const rawPatch = typeof patchOrUpdater === 'function' ? patchOrUpdater(prevConfig, item) : patchOrUpdater;
  if (!rawPatch || typeof rawPatch !== 'object') return null;

  const { title, color, text, ...configPatch } = rawPatch;
  const nextConfig = normalizeAgentInputConfig({ ...prevConfig, ...configPatch });
  const format = encodeBoundedFormat(AGENT_INPUT_PREFIX, nextConfig, (cfg) => ({
    ...cfg,
    attachments: cfg.attachments.map(att => ({
      ...att,
      ...(att.textSnippet ? { textSnippet: att.textSnippet.slice(0, 300) } : {}),
    })),
  }));

  const out = { format };
  if (title !== undefined) out.title = String(title || '').slice(0, 120);
  if (color !== undefined && /^#[0-9a-f]{6}$/i.test(String(color))) out.color = String(color).toLowerCase();
  if (text !== undefined) out.text = String(text || '').slice(0, MAX_TEXT_CHARS);
  return out;
}

function sanitizeRouteRule(raw = {}) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const priorityRaw = Number(src.priority);
  return {
    formats: normalizeFormatList(src.formats),
    keywords: typeof src.keywords === 'string' ? src.keywords.slice(0, 240) : '',
    jsonCondition: typeof src.jsonCondition === 'string' ? src.jsonCondition.trim().slice(0, 600) : '',
    description: typeof src.description === 'string' ? src.description.slice(0, 400) : '',
    isDefault: src.isDefault === true,
    priority: Number.isInteger(priorityRaw) && priorityRaw >= 0 && priorityRaw <= 100 ? priorityRaw : 0,
  };
}

function sanitizeRouterRoutesMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [targetId, rule] of Object.entries(raw).slice(0, MAX_ROUTER_ROUTES)) {
    const key = String(targetId || '').trim().slice(0, 128);
    if (!key || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    const normalized = sanitizeRouteRule(rule);
    if (
      normalized.formats.length
      || normalized.keywords
      || normalized.jsonCondition
      || normalized.description
      || normalized.isDefault
      || normalized.priority > 0
    ) {
      out[key] = normalized;
    }
  }
  return out;
}

function sanitizeRouterDecision(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = {
    updatedAt: Number.isSafeInteger(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : Date.now(),
    runId: typeof raw.runId === 'string' ? raw.runId.slice(0, 128) : '',
    modeUsed: ROUTING_MODE_IDS.has(raw.modeUsed) ? raw.modeUsed : 'format',
    detectedFormats: normalizeFormatList(raw.detectedFormats),
    selectedTargetIds: Array.isArray(raw.selectedTargetIds)
      ? raw.selectedTargetIds.slice(0, 16).map(id => String(id).slice(0, 128)).filter(Boolean)
      : [],
    selectedTargetNames: Array.isArray(raw.selectedTargetNames)
      ? raw.selectedTargetNames.slice(0, 16).map(n => String(n).slice(0, 120)).filter(Boolean)
      : [],
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 500) : '',
    fallbackUsed: Boolean(raw.fallbackUsed),
  };
  if (typeof raw.error === 'string' && raw.error) entry.error = raw.error.slice(0, 500);
  return entry;
}

export function normalizeAgentRouterConfig(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const prefs = normalizeAgentPreferences({
    max_tokens: 1024,
    max_steps: 4,
    temperature: 0.1,
    ...source,
  });
  return {
    v: 1,
    routingMode: ROUTING_MODE_IDS.has(source.routingMode) ? source.routingMode : 'hybrid',
    multiMatch: source.multiMatch !== false,
    allowMultiRoute: source.allowMultiRoute === true,
    fallbackPolicy: ROUTER_FALLBACK_IDS.has(source.fallbackPolicy) ? source.fallbackPolicy : 'default_target',
    defaultTargetId: typeof source.defaultTargetId === 'string' ? source.defaultTargetId.slice(0, 128) : '',
    jsonRules: typeof source.jsonRules === 'string' ? source.jsonRules.slice(0, MAX_JSON_RULES_CHARS) : '',
    routingPrompt: (typeof source.routingPrompt === 'string' && source.routingPrompt.trim()
      ? source.routingPrompt
      : DEFAULT_ROUTER_PROMPT).slice(0, MAX_GOAL_CHARS),
    routes: sanitizeRouterRoutesMap(source.routes),
    engine: prefs.engine,
    provider: prefs.provider,
    model: prefs.model,
    reasoning_effort: prefs.reasoning_effort,
    max_tokens: prefs.max_tokens,
    max_steps: prefs.max_steps,
    temperature: prefs.temperature,
    top_p: prefs.top_p,
    lastDecision: sanitizeRouterDecision(source.lastDecision),
  };
}

export function readAgentRouterConfig(item) {
  return normalizeAgentRouterConfig(safeJsonParse(item?.format, AGENT_ROUTER_PREFIX) || {});
}

export function writeAgentRouterPatch(item, patchOrUpdater) {
  const prevConfig = readAgentRouterConfig(item);
  const rawPatch = typeof patchOrUpdater === 'function' ? patchOrUpdater(prevConfig, item) : patchOrUpdater;
  if (!rawPatch || typeof rawPatch !== 'object') return null;

  const { title, color, text, api_key: _drop1, cli_api_key: _drop2, cli_tool: _drop3, cli_model: _drop4, cli_command: _drop5, ...configPatch } = rawPatch;
  const nextConfig = normalizeAgentRouterConfig({ ...prevConfig, ...configPatch });
  const format = encodeBoundedFormat(AGENT_ROUTER_PREFIX, nextConfig, (cfg) => ({
    ...cfg,
    jsonRules: cfg.jsonRules.slice(0, 2000),
    routingPrompt: cfg.routingPrompt.slice(0, 1500),
    lastDecision: cfg.lastDecision
      ? { ...cfg.lastDecision, reason: cfg.lastDecision.reason.slice(0, 160) }
      : null,
  }));

  const out = { format };
  if (title !== undefined) out.title = String(title || '').slice(0, 120);
  if (color !== undefined && /^#[0-9a-f]{6}$/i.test(String(color))) out.color = String(color).toLowerCase();
  if (text !== undefined) out.text = String(text || '').slice(0, MAX_TEXT_CHARS);
  return out;
}

function sanitizeOutputMeta(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = {
    updatedAt: Number.isSafeInteger(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : Date.now(),
    status: ['success', 'error', 'skipped'].includes(raw.status) ? raw.status : 'success',
    sourceId: typeof raw.sourceId === 'string' ? raw.sourceId.slice(0, 128) : '',
    sourceName: typeof raw.sourceName === 'string' ? raw.sourceName.slice(0, 120) : '',
    runId: typeof raw.runId === 'string' ? raw.runId.slice(0, 128) : '',
  };
  if (typeof raw.routedBy === 'string' && raw.routedBy) entry.routedBy = raw.routedBy.slice(0, 120);
  if (typeof raw.routeReason === 'string' && raw.routeReason) entry.routeReason = raw.routeReason.slice(0, 300);
  const inputFormats = normalizeFormatList(raw.inputFormats);
  if (inputFormats.length) entry.inputFormats = inputFormats;
  if (typeof raw.error === 'string' && raw.error) entry.error = raw.error.slice(0, 500);
  return entry;
}

export function normalizeAgentOutputConfig(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    v: 1,
    displayMode: OUTPUT_DISPLAY_IDS.has(source.displayMode) ? source.displayMode : 'markdown',
    appendHistory: source.appendHistory !== false,
    showMetadata: source.showMetadata !== false,
    lastMeta: sanitizeOutputMeta(source.lastMeta),
  };
}

export function readAgentOutputConfig(item) {
  return normalizeAgentOutputConfig(safeJsonParse(item?.format, AGENT_OUTPUT_PREFIX) || {});
}

function sanitizeRuntimeResultsList(records) {
  if (!Array.isArray(records)) return [];
  const allowedKeys = new Set(['runId', 'codeId', 'createdAt', 'output', 'error', 'exitCode', 'timedOut', 'truncated']);
  return records
    .slice(-32)
    .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map(entry => {
      const clean = {
        runId: String(entry.runId || 'run').slice(0, 256),
        codeId: String(entry.codeId || 'agent').slice(0, 128),
        createdAt: Number.isSafeInteger(entry.createdAt) && entry.createdAt >= 0 ? entry.createdAt : Date.now(),
      };
      for (const k of allowedKeys) {
        if (k in clean || entry[k] == null) continue;
        if (k === 'output' || k === 'error') clean[k] = String(entry[k]);
        else if (k === 'exitCode' && Number.isSafeInteger(entry[k])) clean[k] = entry[k];
        else if ((k === 'timedOut' || k === 'truncated') && typeof entry[k] === 'boolean') clean[k] = entry[k];
      }
      return clean;
    });
}

export function writeAgentOutputPatch(item, patchOrUpdater) {
  const prevConfig = readAgentOutputConfig(item);
  const rawPatch = typeof patchOrUpdater === 'function' ? patchOrUpdater(prevConfig, item) : patchOrUpdater;
  if (!rawPatch || typeof rawPatch !== 'object') return null;

  const { title, color, text, runtimeResults, ...configPatch } = rawPatch;
  const nextConfig = normalizeAgentOutputConfig({ ...prevConfig, ...configPatch });
  const format = encodeBoundedFormat(AGENT_OUTPUT_PREFIX, nextConfig, (cfg) => ({
    ...cfg,
    lastMeta: cfg.lastMeta ? { ...cfg.lastMeta, routeReason: undefined } : null,
  }));

  const out = { format };
  if (title !== undefined) out.title = String(title || '').slice(0, 120);
  if (color !== undefined && /^#[0-9a-f]{6}$/i.test(String(color))) out.color = String(color).toLowerCase();
  if (text !== undefined) out.text = String(text || '').slice(0, MAX_TEXT_CHARS);
  if (runtimeResults !== undefined) out.runtimeResults = sanitizeRuntimeResultsList(runtimeResults);
  return out;
}

function sanitizeRunLog(log) {
  if (!Array.isArray(log)) return [];
  return log.slice(-MAX_RUN_LOG_ENTRIES).map(entry => ({
    round: Number.isInteger(entry?.round) && entry.round >= 1 ? entry.round : 1,
    agentId: String(entry?.agentId || '').slice(0, 128),
    agentName: String(entry?.agentName || '').slice(0, 120),
    role: String(entry?.role || '').slice(0, 80),
    status: ['running', 'success', 'error', 'skipped'].includes(entry?.status) ? entry.status : 'success',
    summary: String(entry?.summary || '').slice(0, 320),
    directives: Array.isArray(entry?.directives)
      ? entry.directives.slice(0, 6).map(d => ({
        type: String(d?.type || '').slice(0, 24),
        toName: String(d?.toName || '').slice(0, 80),
      }))
      : [],
    approved: entry?.approved === true,
    done: entry?.done === true,
  }));
}

function sanitizeOrchestratorRun(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    runId: String(raw.runId || '').slice(0, 128),
    startedAt: Number.isSafeInteger(raw.startedAt) && raw.startedAt >= 0 ? raw.startedAt : Date.now(),
    endedAt: Number.isSafeInteger(raw.endedAt) && raw.endedAt >= 0 ? raw.endedAt : undefined,
    status: ['running', 'success', 'error', 'stopped'].includes(raw.status) ? raw.status : 'success',
    mode: ORCHESTRATION_MODE_IDS.has(raw.mode) ? raw.mode : 'collaborative',
    roundsCompleted: Number.isInteger(raw.roundsCompleted) && raw.roundsCompleted >= 0 ? raw.roundsCompleted : 0,
    agentCount: Number.isInteger(raw.agentCount) && raw.agentCount >= 0 ? raw.agentCount : 0,
    converged: Boolean(raw.converged),
    error: typeof raw.error === 'string' && raw.error ? raw.error.slice(0, 500) : undefined,
    log: sanitizeRunLog(raw.log),
  };
}

export function normalizeOrchestratorConfig(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const maxRoundsRaw = Number(source.maxRounds);
  const maxRounds = Number.isInteger(maxRoundsRaw) && maxRoundsRaw >= 1 && maxRoundsRaw <= 6 ? maxRoundsRaw : 2;
  return {
    v: 1,
    mode: ORCHESTRATION_MODE_IDS.has(source.mode) ? source.mode : 'collaborative',
    goal: (typeof source.goal === 'string' ? source.goal : '').slice(0, MAX_GOAL_CHARS),
    maxRounds,
    stopOnError: source.stopOnError !== false,
    sharedMemory: source.sharedMemory !== false,
    consensusStop: source.consensusStop !== false,
    supervisorAgentId: typeof source.supervisorAgentId === 'string' ? source.supervisorAgentId.slice(0, 128) : '',
    lastRun: sanitizeOrchestratorRun(source.lastRun),
  };
}

export function readOrchestratorConfig(item) {
  return normalizeOrchestratorConfig(safeJsonParse(item?.format, AGENT_ORCHESTRATOR_PREFIX) || {});
}

export function writeOrchestratorPatch(item, patchOrUpdater) {
  const prevConfig = readOrchestratorConfig(item);
  const rawPatch = typeof patchOrUpdater === 'function' ? patchOrUpdater(prevConfig, item) : patchOrUpdater;
  if (!rawPatch || typeof rawPatch !== 'object') return null;

  const { title, color, text, ...configPatch } = rawPatch;
  const nextConfig = normalizeOrchestratorConfig({ ...prevConfig, ...configPatch });
  const format = encodeBoundedFormat(AGENT_ORCHESTRATOR_PREFIX, nextConfig, (cfg) => ({
    ...cfg,
    goal: cfg.goal.slice(0, 2000),
    lastRun: cfg.lastRun
      ? { ...cfg.lastRun, log: (cfg.lastRun.log || []).slice(-8).map(entry => ({ ...entry, summary: entry.summary.slice(0, 140) })) }
      : null,
  }));

  const out = { format };
  if (title !== undefined) out.title = String(title || '').slice(0, 120);
  if (color !== undefined && /^#[0-9a-f]{6}$/i.test(String(color))) out.color = String(color).toLowerCase();
  if (text !== undefined) out.text = String(text || '').slice(0, MAX_TEXT_CHARS);
  return out;
}

export function normalizeAgentEdgeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const base = {
    v: 1,
    channel: EDGE_CHANNEL_IDS.has(source.channel) ? source.channel : 'auto',
    delivery: EDGE_DELIVERY_IDS.has(source.delivery) ? source.delivery : 'both',
    enabled: source.enabled !== false,
  };
  const routeFormats = normalizeFormatList(source.routeFormats);
  const routeKeywords = typeof source.routeKeywords === 'string' ? source.routeKeywords.trim().slice(0, 240) : '';
  const routeJsonCondition = typeof source.routeJsonCondition === 'string' ? source.routeJsonCondition.trim().slice(0, 600) : '';
  const routeDescription = typeof source.routeDescription === 'string' ? source.routeDescription.trim().slice(0, 400) : '';
  const routeDefault = source.routeDefault === true;
  const priorityRaw = Number(source.routePriority);
  const routePriority = Number.isInteger(priorityRaw) && priorityRaw >= 1 && priorityRaw <= 100 ? priorityRaw : 0;

  if (routeFormats.length) base.routeFormats = routeFormats;
  if (routeKeywords) base.routeKeywords = routeKeywords;
  if (routeJsonCondition) base.routeJsonCondition = routeJsonCondition;
  if (routeDescription) base.routeDescription = routeDescription;
  if (routeDefault) base.routeDefault = true;
  if (routePriority > 0) base.routePriority = routePriority;
  return base;
}

export function readAgentEdgeConfig(connector) {
  return normalizeAgentEdgeConfig(safeJsonParse(connector?.format, AGENT_EDGE_PREFIX) || {});
}

export function readAgentEdgeRouteConfig(connector) {
  const cfg = readAgentEdgeConfig(connector);
  return {
    routeFormats: cfg.routeFormats || [],
    routeKeywords: cfg.routeKeywords || '',
    routeJsonCondition: cfg.routeJsonCondition || '',
    routeDescription: cfg.routeDescription || '',
    routeDefault: cfg.routeDefault === true,
    routePriority: cfg.routePriority || 0,
  };
}

export function writeAgentEdgePatch(connector, patchOrUpdater) {
  const prevConfig = readAgentEdgeConfig(connector);
  const rawPatch = typeof patchOrUpdater === 'function' ? patchOrUpdater(prevConfig, connector) : patchOrUpdater;
  if (!rawPatch || typeof rawPatch !== 'object') return null;

  const { label, labelMode, ...configPatch } = rawPatch;
  const nextConfig = normalizeAgentEdgeConfig({ ...prevConfig, ...configPatch });
  const out = {
    format: `${AGENT_EDGE_PREFIX}${JSON.stringify(nextConfig)}`,
  };
  if (label !== undefined) {
    out.label = String(label || '').slice(0, 2000);
    out.labelMode = ['plain', 'markdown', 'latex'].includes(labelMode)
      ? labelMode
      : (['plain', 'markdown', 'latex'].includes(connector?.labelMode) ? connector.labelMode : 'plain');
  } else if (labelMode !== undefined && ['plain', 'markdown', 'latex'].includes(labelMode)) {
    out.labelMode = labelMode;
  }
  return out;
}

export function createAgentNodeItem(overrides = {}) {
  const preset = AGENT_ROLE_PRESETS.find(p => p.id === overrides.presetId) || AGENT_ROLE_PRESETS[0];
  const {
    title = preset.defaultTitle,
    color = preset.color,
    text = '',
    x = 0.2,
    y = 0.2,
    width = 0.28,
    height = 0.3,
    permission,
    ...configOverrides
  } = overrides;
  const config = normalizeAgentNodeConfig({
    ...AGENT_DEFAULTS,
    presetId: preset.id,
    role: preset.role,
    systemPrompt: preset.systemPrompt,
    ...configOverrides,
  });
  return {
    kind: 'shape',
    shapeType: 'rectangle',
    runtimeRole: 'executor',
    title: String(title).slice(0, 120),
    color: /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color).toLowerCase() : preset.color,
    format: `${AGENT_NODE_PREFIX}${JSON.stringify(config)}`,
    text: String(text).slice(0, MAX_TEXT_CHARS),
    x,
    y,
    width,
    height,
    ...(permission !== undefined ? { permission } : {}),
  };
}

export function createOrchestratorItem(overrides = {}) {
  const {
    title = '멀티 에이전트 오케스트레이터',
    color = '#7055d6',
    text = '',
    x = 0.2,
    y = 0.2,
    width = 0.34,
    height = 0.38,
    permission,
    ...configOverrides
  } = overrides;
  const config = normalizeOrchestratorConfig(configOverrides);
  return {
    kind: 'shape',
    shapeType: 'rectangle',
    runtimeRole: 'executor',
    title: String(title).slice(0, 120),
    color: /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color).toLowerCase() : '#7055d6',
    format: `${AGENT_ORCHESTRATOR_PREFIX}${JSON.stringify(config)}`,
    text: String(text).slice(0, MAX_TEXT_CHARS),
    x,
    y,
    width,
    height,
    ...(permission !== undefined ? { permission } : {}),
  };
}

export function createAgentInputItem(overrides = {}) {
  const {
    title = '입력 객체',
    color = '#2563eb',
    text = '',
    x = 0.2,
    y = 0.2,
    width = 0.28,
    height = 0.3,
    permission,
    ...configOverrides
  } = overrides;
  const config = normalizeAgentInputConfig(configOverrides);
  return {
    kind: 'shape',
    shapeType: 'rectangle',
    runtimeRole: 'executor',
    title: String(title).slice(0, 120),
    color: /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color).toLowerCase() : '#2563eb',
    format: `${AGENT_INPUT_PREFIX}${JSON.stringify(config)}`,
    text: String(text).slice(0, MAX_TEXT_CHARS),
    x,
    y,
    width,
    height,
    ...(permission !== undefined ? { permission } : {}),
  };
}

export function createAgentRouterItem(overrides = {}) {
  const {
    title = '라우터 객체',
    color = '#d97706',
    text = '',
    x = 0.2,
    y = 0.2,
    width = 0.32,
    height = 0.36,
    permission,
    ...configOverrides
  } = overrides;
  const config = normalizeAgentRouterConfig(configOverrides);
  return {
    kind: 'shape',
    shapeType: 'rectangle',
    runtimeRole: 'executor',
    title: String(title).slice(0, 120),
    color: /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color).toLowerCase() : '#d97706',
    format: `${AGENT_ROUTER_PREFIX}${JSON.stringify(config)}`,
    text: String(text).slice(0, MAX_TEXT_CHARS),
    x,
    y,
    width,
    height,
    ...(permission !== undefined ? { permission } : {}),
  };
}

export function createAgentOutputItem(overrides = {}) {
  const {
    title = '출력 객체',
    color = '#0f766e',
    text = '',
    x = 0.2,
    y = 0.2,
    width = 0.3,
    height = 0.32,
    runtimeResults = [],
    permission,
    ...configOverrides
  } = overrides;
  const config = normalizeAgentOutputConfig(configOverrides);
  return {
    kind: 'shape',
    shapeType: 'rectangle',
    runtimeRole: 'output',
    title: String(title).slice(0, 120),
    color: /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color).toLowerCase() : '#0f766e',
    format: `${AGENT_OUTPUT_PREFIX}${JSON.stringify(config)}`,
    text: String(text).slice(0, MAX_TEXT_CHARS),
    runtimeResults: sanitizeRuntimeResultsList(runtimeResults),
    x,
    y,
    width,
    height,
    ...(permission !== undefined ? { permission } : {}),
  };
}

function makeEdge(
  from,
  to,
  permission,
  {
    channel = 'auto',
    delivery = 'both',
    label = '',
    color = '#617d68',
    routeFormats,
    routeKeywords,
    routeDescription,
    routeDefault,
    routePriority,
  } = {},
) {
  const edge = {
    kind: 'connector',
    from,
    to,
    bend: 0,
    color,
    strokeWidth: 2,
    endHead: 'triangle',
    format: `${AGENT_EDGE_PREFIX}${JSON.stringify(normalizeAgentEdgeConfig({
      channel,
      delivery,
      enabled: true,
      routeFormats,
      routeKeywords,
      routeDescription,
      routeDefault,
      routePriority,
    }))}`,
    permission,
  };
  if (label) {
    edge.label = label.slice(0, 2000);
    edge.labelMode = 'plain';
  }
  return edge;
}

export function buildMultiAgentTemplate(templateId, orchestratorId, orchestratorItem, permission = 'default', createId) {
  if (!isAgentOrchestratorItem(orchestratorItem)) {
    throw new Error('오케스트레이터 객체가 필요합니다.');
  }
  const genId = typeof createId === 'function'
    ? createId
    : (() => {
      let seq = 1;
      return () => `ma-${Date.now()}-${seq++}`;
    })();
  const ox = Number(orchestratorItem.x) || 0.2;
  const oy = Number(orchestratorItem.y) || 0.2;
  const ow = Number(orchestratorItem.width) || 0.34;
  const createdEntries = [];
  const push = (item) => {
    const id = String(genId());
    createdEntries.push({ id, item });
    return id;
  };

  let orchPatch = {};

  if (templateId === 'mock-routing') {
    orchPatch = { title: '모형 에이전트 분기 테스트', mode: 'graph' };
    const inputId = push(createAgentInputItem({
      title: '테스트 입력', text: '텍스트 경로를 확인합니다.', x: ox - 0.34, y: oy, permission,
    }));
    const routerId = push(createAgentRouterItem({
      title: '테스트 라우터', routingMode: 'format', fallbackPolicy: 'skip', x: ox + ow + 0.08, y: oy, permission,
    }));
    const outputId = push(createAgentOutputItem({
      title: '테스트 출력', x: ox + ow + 1.12, y: oy, permission,
    }));
    push(makeEdge(inputId, orchestratorId, permission, { channel: 'input' }));
    push(makeEdge(orchestratorId, routerId, permission, { channel: 'route' }));
    for (const [format, title, mockResponse, offset] of [
      ['text', '텍스트 모형', '텍스트 경로 실행 완료', 0],
      ['image', '이미지 모형', '이미지 경로 실행 완료', 0.38],
    ]) {
      const agentId = push(createAgentNodeItem({
        title, engine: 'mock', mockResponse, x: ox + ow + 0.58, y: oy + offset, permission,
      }));
      push(makeEdge(routerId, agentId, permission, { channel: 'route', routeFormats: [format] }));
      push(makeEdge(agentId, outputId, permission, { channel: 'output' }));
    }
  } else if (templateId === 'smart-router-team') {
    orchPatch = {
      title: '멀티모달 라우터 오케스트라',
      mode: 'graph',
      maxRounds: 1,
      goal: '입력 객체의 데이터 포맷과 의도를 라우터가 판별하여 알맞은 전문 에이전트에게 전달하고 출력 객체로 응답을 반환하세요.',
    };
    const inputId = push(createAgentInputItem({
      title: '사용자 입력',
      text: '분석할 텍스트를 입력하거나 이미지·오디오·동영상·PDF 파일을 첨부·연결하세요.',
      x: ox - 0.34,
      y: oy + 0.04,
      permission,
    }));
    const col1 = ox + ow + 0.08;
    const col2 = col1 + 0.38;
    const col3 = col2 + 0.36;
    const routerId = push(createAgentRouterItem({
      title: '멀티모달 지능형 라우터',
      routingMode: 'hybrid',
      multiMatch: true,
      allowMultiRoute: false,
      fallbackPolicy: 'default_target',
      x: col1,
      y: oy + 0.02,
      permission,
    }));
    const textAgentId = push(createAgentNodeItem({
      presetId: 'general',
      title: '텍스트·코드 분석가',
      role: '텍스트 · 코드 · 표 처리',
      color: '#2b6cb0',
      systemPrompt: '텍스트, 문서, 코드, 표, 웹 링크 입력을 분석하고 정확하고 구조화된 응답을 작성하세요.',
      x: col2,
      y: oy - 0.34,
      permission,
    }));
    const imageAgentId = push(createAgentNodeItem({
      presetId: 'researcher',
      title: '이미지·비전 분석가',
      role: '이미지 시각 분석',
      color: '#7c3aed',
      systemPrompt: '이미지 자료의 시각적 요소, 텍스트, 도표, 맥락을 파악해 상세히 설명하세요.',
      x: col2,
      y: oy - 0.1,
      permission,
    }));
    const mediaAgentId = push(createAgentNodeItem({
      presetId: 'researcher',
      title: '오디오·동영상 분석가',
      role: '음성 · 영상 미디어 분석',
      color: '#0f766e',
      systemPrompt: '오디오 및 동영상 자료의 핵심 내용, 흐름, 타임라인 요약을 정리하세요.',
      x: col2,
      y: oy + 0.14,
      permission,
    }));
    const pdfAgentId = push(createAgentNodeItem({
      presetId: 'writer',
      title: 'PDF 문서 분석가',
      role: 'PDF 문서 요약 · 추출',
      color: '#c05621',
      systemPrompt: 'PDF 문서의 핵심 조항, 수치, 결론을 근거와 함께 추출해 정리하세요.',
      x: col2,
      y: oy + 0.38,
      permission,
    }));
    const outputId = push(createAgentOutputItem({
      title: '에이전트 출력',
      x: col3,
      y: oy + 0.04,
      permission,
    }));
    push(makeEdge(inputId, orchestratorId, permission, { channel: 'input', label: '사용자 입력' }));
    push(makeEdge(orchestratorId, routerId, permission, { channel: 'route', label: '라우팅 시작' }));
    push(makeEdge(routerId, textAgentId, permission, {
      channel: 'route',
      label: '텍스트 · 코드 · 표 · 링크',
      routeFormats: ['text', 'code', 'table', 'link', 'json'],
      routeDescription: '일반 질문, 글쓰기, 코드, 표, JSON, URL 요청 처리',
      routeDefault: true,
      routePriority: 10,
    }));
    push(makeEdge(routerId, imageAgentId, permission, {
      channel: 'route',
      label: '이미지',
      routeFormats: ['image'],
      routeDescription: '사진, 도면, 다이어그램, 스크린샷 등 이미지 분석',
      routePriority: 20,
    }));
    push(makeEdge(routerId, mediaAgentId, permission, {
      channel: 'route',
      label: '오디오 · 동영상',
      routeFormats: ['audio', 'video'],
      routeDescription: '음성 녹음, 오디오 파일, YouTube/동영상 처리',
      routePriority: 20,
    }));
    push(makeEdge(routerId, pdfAgentId, permission, {
      channel: 'route',
      label: 'PDF 문서',
      routeFormats: ['pdf'],
      routeDescription: 'PDF 문서 분석 및 요약',
      routePriority: 20,
    }));
    push(makeEdge(textAgentId, outputId, permission, { channel: 'output', label: '응답 반환' }));
    push(makeEdge(imageAgentId, outputId, permission, { channel: 'output', label: '응답 반환' }));
    push(makeEdge(mediaAgentId, outputId, permission, { channel: 'output', label: '응답 반환' }));
    push(makeEdge(pdfAgentId, outputId, permission, { channel: 'output', label: '응답 반환' }));
  } else if (templateId === 'parallel-synthesis') {
    orchPatch = {
      title: '병렬 분석 · 종합 오케스트라',
      mode: 'graph',
      maxRounds: 1,
      goal: '연결된 입력 자료를 다각도로 분석하고 리스크를 검토한 뒤 실행 가능한 최종 요약 문서를 작성하세요.',
    };
    const inputId = push(createAgentInputItem({
      title: '사용자 입력',
      text: '분석할 요구사항, 데이터, 또는 멀티모달 자료를 입력·첨부하세요.',
      x: ox - 0.34,
      y: oy + 0.04,
      permission,
    }));
    const col1 = ox + ow + 0.08;
    const col2 = col1 + 0.34;
    const col3 = col2 + 0.34;
    const analystId = push(createAgentNodeItem({
      presetId: 'researcher',
      title: '아이디어 분석가',
      role: '핵심 가치 · 기회 분석',
      x: col1,
      y: oy - 0.14,
      permission,
    }));
    const riskId = push(createAgentNodeItem({
      presetId: 'reviewer',
      title: '리스크 검토가',
      role: '제약 · 위험 분석',
      color: '#c05621',
      systemPrompt: '입력 자료의 기술적 제약, 누락된 가정, 잠재적 위험 요소를 구조적으로 도출하세요.',
      x: col1,
      y: oy + 0.22,
      permission,
    }));
    const synthId = push(createAgentNodeItem({
      presetId: 'writer',
      title: '종합 작성가',
      role: '최종 문서 통합',
      x: col2,
      y: oy + 0.04,
      permission,
    }));
    const outputId = push(createAgentOutputItem({
      title: '최종 출력',
      x: col3,
      y: oy + 0.04,
      permission,
    }));
    push(makeEdge(inputId, orchestratorId, permission, { channel: 'input', label: '입력 전달' }));
    push(makeEdge(orchestratorId, analystId, permission, { channel: 'auto', label: '병렬 분석 1' }));
    push(makeEdge(orchestratorId, riskId, permission, { channel: 'auto', label: '병렬 분석 2' }));
    push(makeEdge(analystId, synthId, permission, { channel: 'handoff', label: '분석 핸드오프' }));
    push(makeEdge(riskId, synthId, permission, { channel: 'handoff', label: '리스크 핸드오프' }));
    push(makeEdge(synthId, outputId, permission, { channel: 'output', label: '최종 결과' }));
  } else if (templateId === 'supervisor-team') {
    orchPatch = {
      title: '감독자 위임 팀',
      mode: 'supervisor',
      maxRounds: 2,
      goal: '감독 에이전트가 리서처와 구현자에게 하위 작업을 위임하고 결과를 검토해 최종 답변을 도출하세요.',
    };
    const inputId = push(createAgentInputItem({
      title: '팀 과제 입력',
      text: '감독자와 팀원이 함께 해결할 과제를 입력하거나 파일을 첨부하세요.',
      x: ox - 0.34,
      y: oy + 0.04,
      permission,
    }));
    const col1 = ox + ow + 0.08;
    const col2 = col1 + 0.34;
    const col3 = col2 + 0.34;
    const leadId = push(createAgentNodeItem({
      presetId: 'planner',
      title: '팀 리더 (감독자)',
      role: '감독자 · 작업 분배 및 통합',
      systemPrompt: '목표를 하위 작업으로 나누어 [DELEGATE: 에이전트이름]으로 팀원에게 배분하고, 결과를 검토해 부족하면 [REVISE: 에이전트이름], 충분하면 [DONE]으로 최종 산출물을 통합하세요.',
      x: col1,
      y: oy + 0.04,
      permission,
    }));
    const researcherId = push(createAgentNodeItem({
      presetId: 'researcher',
      title: '리서처',
      x: col2,
      y: oy - 0.14,
      permission,
    }));
    const devId = push(createAgentNodeItem({
      presetId: 'developer',
      title: '구현자',
      x: col2,
      y: oy + 0.22,
      permission,
    }));
    const outputId = push(createAgentOutputItem({
      title: '감독 최종 출력',
      x: col3,
      y: oy + 0.04,
      permission,
    }));
    orchPatch.supervisorAgentId = leadId;
    push(makeEdge(inputId, orchestratorId, permission, { channel: 'input', label: '목표 지시' }));
    push(makeEdge(orchestratorId, leadId, permission, { channel: 'supervisor', label: '감독자 지정' }));
    push(makeEdge(leadId, researcherId, permission, { channel: 'handoff', label: '조사 위임' }));
    push(makeEdge(leadId, devId, permission, { channel: 'handoff', label: '구현 위임' }));
    push(makeEdge(researcherId, leadId, permission, { channel: 'feedback', label: '조사 보고' }));
    push(makeEdge(devId, leadId, permission, { channel: 'feedback', label: '구현 보고' }));
    push(makeEdge(leadId, outputId, permission, { channel: 'output', label: '최종 보고' }));
  } else {
    orchPatch = {
      title: '기획 · 구현 · 리뷰 협업 오케스트라',
      mode: 'collaborative',
      maxRounds: 2,
      goal: '입력 객체의 요청을 바탕으로 기획, 구현, 품질 검토를 협업 라운드로 거쳐 완성도 높은 결과를 만드세요.',
    };
    const inputId = push(createAgentInputItem({
      title: '공통 요청 입력',
      text: '에이전트 팀이 함께 설계·구현·검토할 요청을 입력하거나 자료를 연결하세요.',
      x: ox - 0.34,
      y: oy + 0.04,
      permission,
    }));
    const col1 = ox + ow + 0.08;
    const col2 = col1 + 0.34;
    const col3 = col2 + 0.34;
    const col4 = col3 + 0.34;
    const plannerId = push(createAgentNodeItem({
      presetId: 'planner',
      title: '기획자',
      x: col1,
      y: oy + 0.04,
      permission,
    }));
    const devId = push(createAgentNodeItem({
      presetId: 'developer',
      title: '구현자',
      x: col2,
      y: oy + 0.04,
      permission,
    }));
    const reviewerId = push(createAgentNodeItem({
      presetId: 'reviewer',
      title: '리뷰어',
      x: col3,
      y: oy + 0.04,
      permission,
    }));
    const outputId = push(createAgentOutputItem({
      title: '최종 산출물',
      x: col4,
      y: oy + 0.04,
      permission,
    }));
    push(makeEdge(inputId, orchestratorId, permission, { channel: 'input', label: '공통 요청' }));
    push(makeEdge(orchestratorId, plannerId, permission, { channel: 'auto', label: '시작' }));
    push(makeEdge(plannerId, devId, permission, { channel: 'handoff', label: '설계 전달' }));
    push(makeEdge(devId, reviewerId, permission, { channel: 'handoff', label: '검토 요청' }));
    push(makeEdge(reviewerId, devId, permission, { channel: 'feedback', label: '검토 피드백' }));
    push(makeEdge(reviewerId, outputId, permission, { channel: 'output', label: '최종 산출물' }));
  }

  const updatedOrchestrator = {
    ...orchestratorItem,
    ...writeOrchestratorPatch(orchestratorItem, orchPatch),
  };
  const changes = {
    [orchestratorId]: updatedOrchestrator,
    ...Object.fromEntries(createdEntries.map(entry => [entry.id, entry.item])),
  };
  return { updatedOrchestrator, createdEntries, changes };
}

export { AGENT_DEFAULTS };
