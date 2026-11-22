import { isAgentInputItem, isAgentNodeItem, readAgentNodeConfig } from './agentCanvasModel.js';
import { formatTypeLabel } from './agentRouter.js';
import { extractCanvasObjectData, isAgentOutputSink } from './multiAgentGraph.js';

export const MAX_AGENT_PROMPT_CHARS = 7600;

function formatInputSection(entries, items, freshOutputs, labelPrefix = '', maxEntryChars = 2400) {
  const lines = [];
  for (const entry of entries || []) {
    const id = entry.sourceId || entry.otherId;
    const item = entry.item || items?.[id];
    const delivery = entry.edgeConfig?.delivery || 'both';
    const edgeNote = entry.label ? ` · 연결 설명: "${entry.label}"` : '';
    const data = extractCanvasObjectData(id, item, freshOutputs);
    const fmtBadge = data.formatType ? ` · 형식: ${formatTypeLabel(data.formatType)}` : '';
    if (delivery === 'reference') {
      const safeTitle = item?.title || item?.filename || item?.groupTitle || data.typeLabel;
      lines.push(`- [${data.typeLabel}${fmtBadge}] ${safeTitle} (ID: ${id})${edgeNote}\n  (객체 ID 참조만 전달됨 — 필요 시 캔버스 도구로 직접 읽으세요.)`);
      continue;
    }
    const header = `- [${data.typeLabel}${fmtBadge}] ${data.title} (ID: ${id})${edgeNote}`;
    if (data.content) {
      const content = data.content.length > maxEntryChars
        ? `${data.content.slice(0, Math.max(80, maxEntryChars - 16))}\n…(일부 생략)`
        : data.content;
      lines.push(`${header}\n${content}`);
    } else {
      lines.push(`${header}\n  (현재 내용 없음)`);
    }
  }
  if (!lines.length) return '';
  return labelPrefix ? `${labelPrefix}\n${lines.join('\n\n')}` : lines.join('\n\n');
}

function formatRoutedItemsSection(routedInputs = [], maxEntryChars = 2400) {
  const lines = [];
  for (const entry of routedInputs || []) {
    const fmt = formatTypeLabel(entry.formatType);
    const header = `- [${fmt}] ${entry.title}${entry.sourceId ? ` (ID: ${entry.sourceId})` : ''}`;
    const body = String(entry.content || '');
    if (!body) {
      lines.push(header);
      continue;
    }
    const clipped = body.length > maxEntryChars
      ? `${body.slice(0, Math.max(80, maxEntryChars - 16))}\n…(일부 생략)`
      : body;
    lines.push(`${header}\n${clipped}`);
  }
  return lines.join('\n\n');
}

export function collectSelectedIdsForAgent({
  agentConfig,
  promptInputs = [],
  dataInputs = [],
  inputNodes = [],
  orchestratorInputs = [],
  routedInputs = [],
  outputSinks = [],
}) {
  if (agentConfig?.attachInputsAsSelection === false) return [];
  const ids = [];
  const push = (id) => {
    const key = String(id || '');
    if (key && !ids.includes(key) && ids.length < 20) ids.push(key);
  };
  for (const entry of [...promptInputs, ...dataInputs, ...inputNodes, ...orchestratorInputs]) {
    if (entry?.edgeConfig?.delivery !== 'inline') push(entry.sourceId || entry.otherId);
  }
  for (const entry of routedInputs || []) {
    push(entry.sourceId);
  }
  for (const entry of outputSinks) {
    if (isAgentOutputSink(entry.item, entry.channel)) push(entry.targetId || entry.otherId);
  }
  return ids;
}

export function compileAgentPrompt({
  agentId,
  agentItem,
  agentConfig,
  orchestratorConfig,
  items = {},
  freshAgentOutputs,
  freshRuntimeOutputs,
  orchestratorInputs = [],
  inputNodes = [],
  promptInputs = [],
  dataInputs = [],
  routedInputs = [],
  routeContext = null,
  upstreamAgents = [],
  upstreamAgentIds = [],
  peerMessages = [],
  sharedLog = [],
  teamRoster = [],
  downstreamPeers = [],
  round = 1,
  maxRounds = 1,
  mode = 'single',
  isSupervisor = false,
  maxChars = MAX_AGENT_PROMPT_CHARS,
}) {
  const cfg = agentConfig || readAgentNodeConfig(agentItem);
  const name = agentItem?.title || cfg.role || 'AI 에이전트';
  const sections = [];

  sections.push({
    key: 'identity',
    priority: 100,
    text: `## [에이전트 정체성]\n- 이름: ${name}\n- 객체 ID: ${agentId}\n- 역할: ${cfg.role}`
      + (mode !== 'single' ? `\n- 협업 모드: ${mode} (라운드 ${round}/${maxRounds}${isSupervisor ? ' · 팀 감독자' : ''})` : ''),
  });

  const allPromptInputs = promptInputs;
  const connectedInputNodes = (inputNodes || []).filter(e => isAgentInputItem(e.item || items[e.sourceId]));
  const perPromptEntry = Math.max(240, Math.floor((maxChars * 0.3) / Math.max(1, allPromptInputs.length)));
  const perOrchEntry = Math.max(240, Math.floor((maxChars * 0.3) / Math.max(1, orchestratorInputs.length)));
  const perDataEntry = Math.max(240, Math.floor((maxChars * 0.4) / Math.max(1, dataInputs.length + connectedInputNodes.length)));

  const promptParts = [];
  if (cfg.systemPrompt?.trim()) promptParts.push(cfg.systemPrompt.trim());
  const connectedPromptText = formatInputSection(allPromptInputs, items, { freshAgentOutputs, freshRuntimeOutputs }, '', perPromptEntry);
  if (connectedPromptText) promptParts.push(`### 연결된 프롬프트 객체\n${connectedPromptText}`);
  if (promptParts.length) {
    sections.push({
      key: 'systemPrompt',
      priority: 95,
      text: `## [기본 프롬프트 및 지시사항]\n${promptParts.join('\n\n')}`,
    });
  }

  const goalParts = [];
  if (orchestratorConfig?.goal?.trim()) goalParts.push(orchestratorConfig.goal.trim());
  const orchInputText = formatInputSection(orchestratorInputs, items, { freshAgentOutputs, freshRuntimeOutputs }, '', perOrchEntry);
  if (orchInputText) goalParts.push(`### 오케스트레이터 입력 자료\n${orchInputText}`);
  if (goalParts.length) {
    sections.push({
      key: 'goal',
      priority: 90,
      text: `## [공동 목표]\n${goalParts.join('\n\n')}`,
    });
  }

  if (routeContext) {
    const routeLines = [
      `- 라우터: ${routeContext.routerName || '라우터 객체'} (${routeContext.modeUsed === 'intelligent' ? '지능형 판단' : '포맷 규칙'})`,
      routeContext.formats?.length ? `- 감지된 포맷: ${routeContext.formats.map(formatTypeLabel).join(', ')}` : '',
      routeContext.reason ? `- 분기 사유: ${routeContext.reason}` : '',
    ].filter(Boolean);
    sections.push({
      key: 'routeContext',
      priority: 88,
      text: `## [라우터 전달 정보]\n${routeLines.join('\n')}`,
    });
  }

  const routedText = formatRoutedItemsSection(routedInputs, perDataEntry);
  if (routedText) {
    sections.push({
      key: 'routedInputs',
      priority: 82,
      text: `## [라우팅된 입력 자료]\n${routedText}`,
    });
  }

  const combinedDataInputs = [...connectedInputNodes, ...dataInputs];
  const dataText = formatInputSection(combinedDataInputs, items, { freshAgentOutputs, freshRuntimeOutputs }, '', perDataEntry);
  if (dataText) {
    sections.push({
      key: 'data',
      priority: 60,
      text: `## [시각적 그래프 입력 데이터]\n${dataText}`,
    });
  }

  const upstreamEntries = upstreamAgentIds.length
    ? upstreamAgentIds.map(id => ({ sourceId: id, item: items[id], edgeConfig: { delivery: 'both' } }))
    : upstreamAgents;
  const perUpstreamEntry = Math.max(280, Math.floor((maxChars * 0.4) / Math.max(1, upstreamEntries.length)));
  const upstreamText = formatInputSection(upstreamEntries, items, { freshAgentOutputs, freshRuntimeOutputs }, '', perUpstreamEntry);
  if (upstreamText) {
    sections.push({
      key: 'handoffs',
      priority: 75,
      text: `## [이전 에이전트 결과 (핸드오프)]\n${upstreamText}`,
    });
  }

  if (peerMessages.length) {
    const msgLines = peerMessages.map(msg => {
      const kindLabel = ({
        delegate: '작업 위임',
        revise: '수정 요청',
        ask: '질문',
        handoff: '핸드오프',
        broadcast: '공지',
      })[msg.type] || '협업 메시지';
      return `- [${kindLabel}] ${msg.fromName} (R${msg.round}):\n${msg.message}`;
    });
    sections.push({
      key: 'peerMessages',
      priority: 85,
      text: `## [동료 에이전트 협업 메시지 / 피드백]\n${msgLines.join('\n\n')}`,
    });
  }

  if (sharedLog.length && orchestratorConfig?.sharedMemory !== false) {
    const recentLog = sharedLog.slice(-10).map(entry =>
      `- R${entry.round} · ${entry.agentName} (${entry.role}): ${entry.summary}`,
    );
    sections.push({
      key: 'sharedLog',
      priority: 40,
      text: `## [팀 협업 공유 기록]\n${recentLog.join('\n')}`,
    });
  }

  if (mode !== 'single' && cfg.canDelegate !== false && teamRoster.length > 1) {
    const peersText = teamRoster
      .filter(peer => peer.id !== agentId)
      .map(peer => `- ${peer.name} (${peer.role})`)
      .join('\n');
    const downstreamNames = downstreamPeers.length
      ? `\n연결된 다음 에이전트: ${downstreamPeers.map(p => p.name).join(', ')}`
      : '';
    const directiveHelp = isSupervisor
      ? [
        '- 팀원에게 작업을 맡길 때: `[DELEGATE: 에이전트이름] 지시 내용`',
        '- 수정·보완이 필요할 때: `[REVISE: 에이전트이름] 구체적 수정 요청`',
        '- 모든 작업이 충분해 최종 종합을 마칠 때: `[DONE]`을 포함하고 최종 결과를 작성하세요.',
      ].join('\n')
      : [
        '- 특정 동료에게 결과를 넘길 때: `[HANDOFF: 에이전트이름] 전달 내용`',
        '- 앞선 산출물의 수정이 필요할 때: `[REVISE: 에이전트이름] 수정 요청`',
        '- 동료에게 확인이 필요할 때: `[ASK: 에이전트이름] 질문 내용`',
        '- 검토 결과 통과/완료 상태일 때: `[APPROVED]` 또는 `[DONE]`을 포함하세요.',
      ].join('\n');
    sections.push({
      key: 'protocol',
      priority: 70,
      text: `## [협업 동료 및 응답 지침]\n${peersText}${downstreamNames}\n\n필요한 경우 아래 협업 태그를 응답에 포함해 다른 에이전트에게 직접 전달할 수 있습니다:\n${directiveHelp}`,
    });
  }

  let compiled = sections.map(s => s.text).join('\n\n');
  if (compiled.length <= maxChars) return compiled;

  // Trim lowest priority sections first (`sharedLog`, then `data`, then `routedInputs`, then `handoffs`) to stay within backend limit.
  const shrinkOrder = ['sharedLog', 'data', 'routedInputs', 'handoffs', 'goal'];
  for (const targetKey of shrinkOrder) {
    if (compiled.length <= maxChars) break;
    const section = sections.find(s => s.key === targetKey);
    if (!section) continue;
    const excess = compiled.length - maxChars;
    const currentLen = section.text.length;
    if (currentLen <= 120) continue;
    const nextLen = Math.max(120, currentLen - excess - 24);
    section.text = `${section.text.slice(0, nextLen)}\n…(길이 제한으로 일부 생략)`;
    compiled = sections.map(s => s.text).join('\n\n');
  }

  return compiled.length <= maxChars ? compiled : compiled.slice(0, maxChars);
}

function resolveTeamTarget(rawTarget, teamAgents = []) {
  const query = String(rawTarget || '').trim();
  if (!query) return null;
  const lower = query.toLowerCase();

  const byId = teamAgents.find(a => a.id === query);
  if (byId) return byId;

  const exactName = teamAgents.find(a => (a.name || '').trim().toLowerCase() === lower);
  if (exactName) return exactName;

  const exactRole = teamAgents.find(a => (a.role || '').trim().toLowerCase() === lower);
  if (exactRole) return exactRole;

  const partial = teamAgents.filter(a => {
    const n = (a.name || '').toLowerCase();
    const r = (a.role || '').toLowerCase();
    return (n && (n.includes(lower) || lower.includes(n))) || (r && (r.includes(lower) || lower.includes(r)));
  });
  return partial.length === 1 ? partial[0] : null;
}

const DIRECTIVE_TAG_RE = /^\[(HANDOFF|REVISE|ASK|DELEGATE|BROADCAST)(?:\s*:\s*([^\]]+))?\]\s*(.*)$/i;
const STATUS_MARKER_RE = /\[(APPROVED|DONE)\]/gi;

export function parseCollaborationDirectives(rawText, teamAgents = []) {
  const text = String(rawText || '').trim();
  const directives = [];
  const cleanLines = [];
  let approved = false;
  let done = false;

  let current = null;
  const flushCurrent = () => {
    if (!current) return;
    current.message = current.lines.join('\n').trim();
    delete current.lines;
    if (current.message) directives.push(current);
    current = null;
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/\[(APPROVED)\]/i.test(trimmed)) approved = true;
    if (/\[(DONE)\]/i.test(trimmed)) done = true;

    const match = trimmed.match(DIRECTIVE_TAG_RE);
    if (match) {
      flushCurrent();
      const type = match[1].toLowerCase();
      const rawTarget = (match[2] || '').trim();
      const initialBody = (match[3] || '').replace(STATUS_MARKER_RE, '').trim();
      const resolved = type === 'broadcast' ? null : resolveTeamTarget(rawTarget, teamAgents);
      current = {
        type,
        rawTarget,
        toId: resolved?.id || null,
        toName: resolved?.name || (type === 'broadcast' ? '전체 팀' : rawTarget),
        lines: initialBody ? [initialBody] : [],
      };
      continue;
    }

    if (current) {
      if (!trimmed && current.lines.length) {
        flushCurrent();
      } else {
        const cleaned = line.replace(STATUS_MARKER_RE, '').trimEnd();
        if (cleaned.trim()) current.lines.push(cleaned);
      }
    } else {
      const cleaned = line.replace(STATUS_MARKER_RE, '');
      cleanLines.push(cleaned);
    }
  }
  flushCurrent();

  const cleanAnswer = cleanLines.join('\n').trim() || text.replace(STATUS_MARKER_RE, '').trim();
  return { directives, approved, done, cleanAnswer };
}

export function extractCodeForTarget(answer, _language) {
  const text = String(answer || '').trim();
  const fence = text.match(/```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text;
}

export function buildTeamRoster(items, agentIds) {
  return (agentIds || [])
    .filter(id => isAgentNodeItem(items[id]))
    .map(id => {
      const cfg = readAgentNodeConfig(items[id]);
      return { id, name: items[id].title || cfg.role || id, role: cfg.role };
    });
}
