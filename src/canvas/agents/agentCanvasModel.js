import {
  AGENT_DEFAULTS,
  CLI_TOOLS,
  modelOptions,
  normalizeAgentPreferences,
} from '../../components/agentPreferences.js';

export const AGENT_NODE_PREFIX = 'agent1:';
export const AGENT_ORCHESTRATOR_PREFIX = 'orchestrator1:';
export const AGENT_EDGE_PREFIX = 'agentEdge1:';

export const ORCHESTRATION_MODES = [
  { id: 'graph', label: '그래프 파이프라인', description: '연결 방향(DAG)에 따라 순차·병렬로 실행합니다.' },
  { id: 'collaborative', label: '협업 라운드', description: '핸드오프·피드백·수정 요청을 반복하며 합의에 도달합니다.' },
  { id: 'supervisor', label: '감독자 위임', description: '감독 에이전트가 작업을 분배하고 결과를 검토·종합합니다.' },
];

export const EDGE_CHANNELS = [
  { id: 'auto', label: '자동 추론' },
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
    id: 'pipeline-review',
    label: '기획 → 구현 → 리뷰 협업 루프',
    description: '요청 메모에서 출발해 기획자·구현자·리뷰어가 최대 2라운드 피드백 루프로 협업하고 결과를 저장합니다.',
  },
  {
    id: 'parallel-synthesis',
    label: '병렬 분석 → 종합 파이프라인',
    description: '두 분석 에이전트가 입력 데이터를 병렬로 검토한 뒤 종합 에이전트가 최종 산출물을 만듭니다.',
  },
  {
    id: 'supervisor-team',
    label: '감독자 팀 위임 오케스트라',
    description: '팀 리더 에이전트가 리서처·구현자에게 작업을 위임하고 결과를 검토·통합합니다.',
  },
];

const ORCHESTRATION_MODE_IDS = new Set(ORCHESTRATION_MODES.map(mode => mode.id));
const EDGE_CHANNEL_IDS = new Set(EDGE_CHANNELS.map(channel => channel.id));
const EDGE_DELIVERY_IDS = new Set(EDGE_DELIVERY_MODES.map(mode => mode.id));

const MAX_FORMAT_LENGTH = 28000;
const MAX_PROMPT_CHARS = 6000;
const MAX_GOAL_CHARS = 4000;
const MAX_TEXT_CHARS = 24000;
const MAX_RUN_LOG_ENTRIES = 24;

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

export function isAgentCanvasObject(item) {
  return isAgentNodeItem(item) || isAgentOrchestratorItem(item);
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
  if (typeof raw.cli_tool === 'string') entry.cli_tool = raw.cli_tool.slice(0, 32);
  if (typeof raw.model === 'string') entry.model = raw.model.slice(0, 128);
  if (Number.isInteger(raw.directivesCount) && raw.directivesCount >= 0) entry.directivesCount = raw.directivesCount;
  if (typeof raw.error === 'string' && raw.error) entry.error = raw.error.slice(0, 500);
  return entry;
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
    engine: prefs.engine,
    cli_tool: prefs.cli_tool,
    cli_model: prefs.cli_model,
    cli_command: prefs.cli_command,
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

  const { title, color, text, api_key: _drop1, cli_api_key: _drop2, ...configPatch } = rawPatch;
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
  return {
    v: 1,
    channel: EDGE_CHANNEL_IDS.has(source.channel) ? source.channel : 'auto',
    delivery: EDGE_DELIVERY_IDS.has(source.delivery) ? source.delivery : 'both',
    enabled: source.enabled !== false,
  };
}

export function readAgentEdgeConfig(connector) {
  return normalizeAgentEdgeConfig(safeJsonParse(connector?.format, AGENT_EDGE_PREFIX) || {});
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

function makeEdge(from, to, permission, { channel = 'auto', delivery = 'both', label = '', color = '#617d68' } = {}) {
  const edge = {
    kind: 'connector',
    from,
    to,
    bend: 0,
    color,
    strokeWidth: 2,
    endHead: 'triangle',
    format: `${AGENT_EDGE_PREFIX}${JSON.stringify(normalizeAgentEdgeConfig({ channel, delivery, enabled: true }))}`,
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

  if (templateId === 'parallel-synthesis') {
    orchPatch = {
      title: '병렬 분석 · 종합 오케스트라',
      mode: 'graph',
      maxRounds: 1,
      goal: '연결된 입력 자료를 다각도로 분석하고 리스크를 검토한 뒤 실행 가능한 최종 요약 문서를 작성하세요.',
    };
    const promptNoteId = push({
      kind: 'note',
      text: '# 작업 요청 & 입력 데이터\n여기에 분석할 요구사항, 데이터, 또는 맥락을 입력하세요.',
      x: ox - 0.3,
      y: oy + 0.04,
      width: 0.24,
      height: 0.2,
      color: '#f6edcf',
      rotation: 0,
      permission,
    });
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
    const outputId = push({
      kind: 'shape',
      shapeType: 'rectangle',
      runtimeRole: 'output',
      x: col3,
      y: oy + 0.06,
      width: 0.26,
      height: 0.28,
      permission,
    });
    push(makeEdge(promptNoteId, orchestratorId, permission, { channel: 'data', label: '입력 데이터' }));
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
    const promptNoteId = push({
      kind: 'note',
      text: '# 팀 목표\n감독자와 팀원이 함께 해결할 과제를 작성하세요.',
      x: ox - 0.3,
      y: oy + 0.04,
      width: 0.24,
      height: 0.2,
      color: '#dce9e0',
      rotation: 0,
      permission,
    });
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
    const outputId = push({
      kind: 'shape',
      shapeType: 'rectangle',
      runtimeRole: 'output',
      x: col3,
      y: oy + 0.06,
      width: 0.26,
      height: 0.28,
      permission,
    });
    orchPatch.supervisorAgentId = leadId;
    push(makeEdge(promptNoteId, orchestratorId, permission, { channel: 'prompt', label: '목표 지시' }));
    push(makeEdge(orchestratorId, leadId, permission, { channel: 'auto', label: '감독 시작' }));
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
      goal: '요청 메모를 바탕으로 기획, 구현, 품질 검토를 협업 라운드로 거쳐 완성도 높은 결과를 만드세요.',
    };
    const promptNoteId = push({
      kind: 'note',
      text: '# 공통 요청\n에이전트 팀이 함께 설계·구현·검토할 내용을 입력하세요.',
      x: ox - 0.3,
      y: oy + 0.04,
      width: 0.24,
      height: 0.2,
      color: '#f6edcf',
      rotation: 0,
      permission,
    });
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
    const outputId = push({
      kind: 'shape',
      shapeType: 'rectangle',
      runtimeRole: 'output',
      x: col4,
      y: oy + 0.06,
      width: 0.26,
      height: 0.28,
      permission,
    });
    push(makeEdge(promptNoteId, orchestratorId, permission, { channel: 'prompt', label: '공통 요청' }));
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

export { AGENT_DEFAULTS, CLI_TOOLS };
