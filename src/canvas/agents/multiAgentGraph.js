import { contentMode, contentSource, isTextContent } from '../content/contentPresentation.js';
import { displayedValue } from '../values/valueData.js';
import {
  isAgentCanvasObject,
  isAgentNodeItem,
  isAgentOrchestratorItem,
  readAgentEdgeConfig,
  readAgentNodeConfig,
  readOrchestratorConfig,
} from './agentCanvasModel.js';

export const MAX_MULTI_AGENTS = 16;
export const MAX_GRAPH_OBJECTS = 256;
export const MAX_EXTRACTED_ITEM_CHARS = 4000;

const PROMPT_LABEL_RE = /프롬프트|시스템|지시|규칙|역할|prompt|system|instruction/i;
const CONTEXT_LABEL_RE = /컨텍스트|배경|참고|context|ref/i;
const FEEDBACK_LABEL_RE = /피드백|리뷰|검토|수정|feedback|review|revise|critique/i;

function clip(text, max = MAX_EXTRACTED_ITEM_CHARS) {
  const value = String(text ?? '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 20)}\n…(생략됨)`;
}

function sortIdsByPosition(ids, items) {
  return [...ids].sort((a, b) => {
    const ia = items[a] || {};
    const ib = items[b] || {};
    return (Number(ia.y) || 0) - (Number(ib.y) || 0)
      || (Number(ia.x) || 0) - (Number(ib.x) || 0)
      || String(a).localeCompare(String(b));
  });
}

function itemLabel(id, item) {
  if (!item) return String(id);
  if (isAgentNodeItem(item)) return item.title || readAgentNodeConfig(item).role || 'AI 에이전트';
  if (isAgentOrchestratorItem(item)) return item.title || '멀티 에이전트 오케스트레이터';
  if (item.kind === 'note') return (item.text || '').split('\n').find(l => l.trim())?.replace(/^#+\s*/, '').slice(0, 40) || '포스트잇';
  if (isTextContent(item) && contentMode(item) === 'code') return item.filename || '코드 객체';
  if (isTextContent(item)) return (contentSource(item) || '').split('\n').find(l => l.trim())?.replace(/^#+\s*/, '').slice(0, 40) || '텍스트';
  if (item.kind === 'value') return item.title || `값 (${item.valueType})`;
  if (item.kind === 'table') return item.title || `테이블 (${item.rows?.length || 0}×${item.columns?.length || 0})`;
  if (item.kind === 'chart') return item.chartTitle || item.title || `그래프 (${item.chartType || 'bar'})`;
  if (item.kind === 'question') return (item.questionPrompt || '문제 객체').slice(0, 40);
  if (item.kind === 'link') return item.title || item.url || '링크';
  if (item.kind === 'pdf') return item.filename || item.title || 'PDF';
  if (item.kind === 'project') return item.title || '프로젝트';
  if (item.kind === 'user-group') return item.groupTitle || '사용자 그룹';
  if (item.runtimeRole === 'output') return '실행 결과 객체';
  if (item.runtimeRole === 'executor') return '실행 객체';
  return item.title || item.label || item.kind || String(id);
}

export function inferEdgeChannel(sourceItem, targetItem, connector) {
  const edgeConfig = readAgentEdgeConfig(connector);
  if (edgeConfig.channel !== 'auto') return edgeConfig.channel;
  if (isAgentOrchestratorItem(sourceItem) && isAgentNodeItem(targetItem)) return 'orchestrate';
  if (isAgentNodeItem(sourceItem) && isAgentNodeItem(targetItem)) {
    return FEEDBACK_LABEL_RE.test(connector?.label || '') ? 'feedback' : 'handoff';
  }
  if (
    (isAgentNodeItem(sourceItem) || isAgentOrchestratorItem(sourceItem))
    && (targetItem?.runtimeRole === 'output' || ['value', 'text', 'note'].includes(targetItem?.kind))
  ) {
    return 'output';
  }
  if (isAgentNodeItem(targetItem) || isAgentOrchestratorItem(targetItem)) {
    const label = connector?.label || '';
    if (PROMPT_LABEL_RE.test(label)) return 'prompt';
    if (CONTEXT_LABEL_RE.test(label)) return 'context';
    return 'data';
  }
  return 'data';
}

export function isAgentOutputSink(item, channel = 'auto') {
  if (!item || isAgentCanvasObject(item)) return false;
  if (item.runtimeRole === 'output' || item.kind === 'value' || item.kind === 'note') return true;
  if (item.kind === 'text') {
    const mode = contentMode(item);
    return mode !== 'code' || channel === 'output';
  }
  if (item.kind === 'code') return channel === 'output';
  return false;
}

export function extractCanvasObjectData(id, item, { freshAgentOutputs, freshRuntimeOutputs } = {}) {
  const key = String(id);
  if (!item) {
    return { id: key, kind: 'missing', title: key, typeLabel: '없음', content: '', summary: '', empty: true };
  }
  const title = itemLabel(key, item);
  let typeLabel = item.kind || 'object';
  let content = '';

  if (isAgentNodeItem(item)) {
    const cfg = readAgentNodeConfig(item);
    typeLabel = `에이전트(${cfg.role})`;
    content = freshAgentOutputs?.has(key) ? String(freshAgentOutputs.get(key) || '') : String(item.text || '');
  } else if (isAgentOrchestratorItem(item)) {
    const cfg = readOrchestratorConfig(item);
    typeLabel = '오케스트레이터';
    content = String(item.text || cfg.goal || '');
  } else if (item.runtimeRole === 'output') {
    typeLabel = '실행 결과';
    const records = freshRuntimeOutputs?.get(key) || item.runtimeResults || [];
    content = records
      .map(entry => entry?.error || entry?.output || '')
      .filter(Boolean)
      .join('\n---\n');
  } else if (isTextContent(item)) {
    const mode = contentMode(item);
    const raw = contentSource(item);
    if (mode === 'code') {
      typeLabel = `코드(${item.language || 'text'})`;
      const name = item.filename || key;
      content = raw ? `파일: ${name} (${item.language || 'text'})\n\`\`\`${item.language || ''}\n${raw}\n\`\`\`` : '';
    } else {
      typeLabel = mode === 'latex' ? '수식' : mode === 'markdown' ? '마크다운' : '텍스트';
      content = raw;
    }
  } else if (item.kind === 'note') {
    typeLabel = '메모';
    content = String(item.text || '');
  } else if (item.kind === 'value') {
    typeLabel = `값(${item.valueType})`;
    const val = displayedValue(item);
    content = `${item.title || key}: ${val ?? ''}`;
  } else if (item.kind === 'table' || item.kind === 'chart') {
    typeLabel = item.kind === 'chart' ? `그래프(${item.chartType || 'bar'})` : '테이블';
    const cols = Array.isArray(item.columns) ? item.columns : [];
    const rows = Array.isArray(item.rows) ? item.rows.slice(0, 40) : [];
    if (cols.length) {
      const header = `| ${cols.join(' | ')} |`;
      const sep = `| ${cols.map(() => '---').join(' | ')} |`;
      const body = rows.map(row => `| ${(Array.isArray(row) ? row : []).map(cell => String(cell ?? '').replace(/\n/g, ' ')).join(' | ')} |`);
      const prefix = item.kind === 'chart' && (item.chartTitle || item.title) ? `제목: ${item.chartTitle || item.title}\n` : '';
      content = `${prefix}${[header, sep, ...body].join('\n')}`;
    }
  } else if (item.kind === 'question') {
    typeLabel = '문제';
    const parts = [];
    if (item.questionPrompt) parts.push(`질문: ${item.questionPrompt}`);
    if (Array.isArray(item.questionOptions) && item.questionOptions.length) {
      parts.push(`선택지: ${item.questionOptions.join(', ')}`);
    }
    if (item.questionAnswer) parts.push(`답안: ${item.questionAnswer}`);
    if (item.questionFeedback) parts.push(`피드백: ${item.questionFeedback}`);
    content = parts.join('\n');
  } else if (item.kind === 'link') {
    typeLabel = `링크(${item.mediaType || 'link'})`;
    content = [item.title, item.url].filter(Boolean).join('\n');
  } else if (item.kind === 'pdf') {
    typeLabel = 'PDF';
    content = `${item.filename || item.title || 'PDF 문서'} (현재 페이지: ${item.pdfPage || 1})`;
  } else if (item.kind === 'project') {
    typeLabel = item.projectType === 'board' ? '프로젝트 보드' : `작업(${item.projectIssueType || 'Task'})`;
    const parts = [item.title];
    if (item.projectStatus) parts.push(`상태: ${item.projectStatus}`);
    if (item.projectPriority) parts.push(`우선순위: ${item.projectPriority}`);
    if (item.text) parts.push(item.text);
    content = parts.filter(Boolean).join('\n');
  } else if (item.kind === 'user-group') {
    typeLabel = '사용자 그룹';
    const members = (item.members || []).map(m => `${m.nickname || ''}#${m.tag_number ?? 0}`).join(', ');
    content = `${item.groupTitle || '그룹'}${members ? `: ${members}` : ''}`;
  } else if (item.kind === 'shape') {
    typeLabel = `도형(${item.shapeType || 'rectangle'})`;
    content = String(item.title || item.label || item.text || '');
  }

  const trimmed = clip(content);
  return {
    id: key,
    kind: item.kind,
    title,
    typeLabel,
    content: trimmed,
    summary: trimmed.replace(/\s+/g, ' ').slice(0, 140),
    empty: !trimmed.length,
  };
}

function makeConnectionEntry(connectorId, edge, items, sideId) {
  const edgeConfig = readAgentEdgeConfig(edge);
  const sourceId = String(edge.from);
  const targetId = String(edge.to);
  const sourceItem = items[sourceId];
  const targetItem = items[targetId];
  const item = items[sideId];
  const channel = inferEdgeChannel(sourceItem, targetItem, edge);
  return {
    connectorId: String(connectorId),
    edge,
    edgeConfig,
    channel,
    sourceId,
    targetId,
    otherId: String(sideId),
    item,
    label: edge.label || '',
    summary: itemLabel(sideId, item),
  };
}

export function inspectAgentConnections(items = {}, nodeId) {
  const id = String(nodeId);
  const incomingRaw = [];
  const outgoingRaw = [];

  for (const [connectorId, edge] of Object.entries(items)) {
    if (edge?.kind !== 'connector') continue;
    const from = String(edge.from);
    const to = String(edge.to);
    if (to === id && items[from]) incomingRaw.push(makeConnectionEntry(connectorId, edge, items, from));
    if (from === id && items[to]) outgoingRaw.push(makeConnectionEntry(connectorId, edge, items, to));
  }

  const sortEntries = list => list.sort((a, b) => {
    const ia = items[a.otherId] || {};
    const ib = items[b.otherId] || {};
    return (Number(ia.y) || 0) - (Number(ib.y) || 0)
      || (Number(ia.x) || 0) - (Number(ib.x) || 0)
      || a.otherId.localeCompare(b.otherId)
      || a.connectorId.localeCompare(b.connectorId);
  });

  const incoming = sortEntries(incomingRaw);
  const outgoing = sortEntries(outgoingRaw);

  const enabledIncoming = incoming.filter(entry => entry.edgeConfig.enabled);
  const enabledOutgoing = outgoing.filter(entry => entry.edgeConfig.enabled);

  return {
    incoming,
    outgoing,
    promptInputs: enabledIncoming.filter(e => !isAgentCanvasObject(e.item) && e.channel === 'prompt'),
    dataInputs: enabledIncoming.filter(e => !isAgentCanvasObject(e.item) && !['prompt', 'output'].includes(e.channel)),
    upstreamAgents: enabledIncoming.filter(e => isAgentNodeItem(e.item) && e.channel !== 'feedback'),
    feedbackAgents: enabledIncoming.filter(e => isAgentNodeItem(e.item) && e.channel === 'feedback'),
    orchestrators: enabledIncoming.filter(e => isAgentOrchestratorItem(e.item)),
    downstreamAgents: enabledOutgoing.filter(e => isAgentNodeItem(e.item) && e.channel !== 'feedback'),
    feedbackTargets: enabledOutgoing.filter(e => isAgentNodeItem(e.item) && e.channel === 'feedback'),
    outputSinks: enabledOutgoing.filter(e => isAgentOutputSink(e.item, e.channel)),
  };
}

export function resolveSingleAgentGraph(items = {}, agentId) {
  const id = String(agentId);
  const item = items[id];
  if (!isAgentNodeItem(item)) throw new Error('AI 에이전트 객체가 필요합니다.');
  const config = readAgentNodeConfig(item);
  const connections = inspectAgentConnections(items, id);
  return {
    agentId: id,
    item,
    config,
    connections,
    promptInputs: connections.promptInputs,
    dataInputs: connections.dataInputs,
    upstreamAgents: connections.upstreamAgents,
    feedbackAgents: connections.feedbackAgents,
    outputSinks: connections.outputSinks,
  };
}

export function resolveMultiAgentGraph(items = {}, orchestratorId) {
  const rootId = String(orchestratorId);
  const rootItem = items[rootId];
  if (!isAgentOrchestratorItem(rootItem)) throw new Error('멀티 에이전트 오케스트레이터 객체가 필요합니다.');

  const config = readOrchestratorConfig(rootItem);
  const rootConnections = inspectAgentConnections(items, rootId);
  const orchestratorInputs = rootConnections.incoming.filter(e => e.edgeConfig.enabled && !isAgentCanvasObject(e.item));
  const orchestratorOutputs = rootConnections.outputSinks;

  const entryAgentIds = sortIdsByPosition(
    [...new Set(rootConnections.outgoing.filter(e => e.edgeConfig.enabled && isAgentNodeItem(e.item)).map(e => e.targetId))],
    items,
  );
  if (!entryAgentIds.length) {
    throw new Error('오케스트레이터에 연결된 AI 에이전트 객체가 없습니다.');
  }

  // Collect all reachable agent nodes via enabled Agent -> Agent connectors.
  const allConnectors = Object.entries(items)
    .filter(([, item]) => item?.kind === 'connector')
    .sort(([a], [b]) => a.localeCompare(b));

  const teamAgentSet = new Set(entryAgentIds);
  const queue = [...entryAgentIds];
  while (queue.length) {
    const currentId = queue.shift();
    for (const [, edge] of allConnectors) {
      const from = String(edge.from);
      const to = String(edge.to);
      if (from !== currentId || !isAgentNodeItem(items[to])) continue;
      if (!readAgentEdgeConfig(edge).enabled) continue;
      if (!teamAgentSet.has(to)) {
        if (teamAgentSet.size >= MAX_MULTI_AGENTS) {
          throw new Error(`멀티 에이전트 팀은 최대 ${MAX_MULTI_AGENTS}개까지 연결할 수 있습니다.`);
        }
        teamAgentSet.add(to);
        queue.push(to);
      }
    }
  }

  const agentIds = sortIdsByPosition([...teamAgentSet], items);
  const rawAgentEdges = [];
  for (const [connectorId, edge] of allConnectors) {
    const from = String(edge.from);
    const to = String(edge.to);
    if (!teamAgentSet.has(from) || !teamAgentSet.has(to)) continue;
    const edgeConfig = readAgentEdgeConfig(edge);
    if (!edgeConfig.enabled) continue;
    const channel = inferEdgeChannel(items[from], items[to], edge);
    rawAgentEdges.push({ connectorId, edge, edgeConfig, channel, from, to });
  }

  if (config.mode === 'graph') {
    const adj = new Map(agentIds.map(id => [id, []]));
    for (const e of rawAgentEdges) {
      if (e.from === e.to) {
        throw new Error('에이전트 그래프에 순환 연결이 있습니다. 협업 라운드 모드로 전환하거나 연결을 확인해주세요.');
      }
      adj.get(e.from).push(e.to);
    }
    const state = new Map();
    const visit = (id) => {
      const s = state.get(id);
      if (s === 1) {
        throw new Error('에이전트 그래프에 순환 연결이 있습니다. 협업 라운드 모드로 전환하거나 연결을 확인해주세요.');
      }
      if (s === 2) return;
      state.set(id, 1);
      for (const next of sortIdsByPosition(adj.get(id) || [], items)) visit(next);
      state.set(id, 2);
    };
    for (const id of entryAgentIds) visit(id);
    for (const id of agentIds) visit(id);
  }

  // Classify forward edges (forming a guaranteed DAG) vs feedback edges.
  const forwardEdges = [];
  const feedbackEdges = [];
  const nonExplicitFeedbackAdj = new Map(agentIds.map(id => [id, []]));
  for (const e of rawAgentEdges) {
    if (e.channel === 'feedback' || e.from === e.to) {
      feedbackEdges.push(e);
    } else {
      nonExplicitFeedbackAdj.get(e.from).push(e);
    }
  }

  const dfsState = new Map();
  const classifyDfs = (id) => {
    dfsState.set(id, 1);
    const outgoing = [...(nonExplicitFeedbackAdj.get(id) || [])].sort((a, b) => {
      const ia = items[a.to] || {};
      const ib = items[b.to] || {};
      return (Number(ia.y) || 0) - (Number(ib.y) || 0)
        || (Number(ia.x) || 0) - (Number(ib.x) || 0)
        || a.to.localeCompare(b.to);
    });
    for (const e of outgoing) {
      const targetState = dfsState.get(e.to);
      if (targetState === 1) {
        feedbackEdges.push(e);
      } else {
        forwardEdges.push(e);
        if (!targetState) classifyDfs(e.to);
      }
    }
    dfsState.set(id, 2);
  };
  for (const id of entryAgentIds) if (!dfsState.has(id)) classifyDfs(id);
  for (const id of agentIds) if (!dfsState.has(id)) classifyDfs(id);

  // Compute topological waves via Kahn's algorithm on forwardEdges.
  const inDegree = new Map(agentIds.map(id => [id, 0]));
  const forwardAdj = new Map(agentIds.map(id => [id, new Set()]));
  for (const e of forwardEdges) {
    if (!forwardAdj.get(e.from).has(e.to)) {
      forwardAdj.get(e.from).add(e.to);
      inDegree.set(e.to, inDegree.get(e.to) + 1);
    }
  }

  const waves = [];
  let ready = sortIdsByPosition(agentIds.filter(id => inDegree.get(id) === 0), items);
  while (ready.length) {
    waves.push(ready);
    const nextReady = [];
    for (const id of ready) {
      for (const next of forwardAdj.get(id) || []) {
        const deg = inDegree.get(next) - 1;
        inDegree.set(next, deg);
        if (deg === 0) nextReady.push(next);
      }
    }
    ready = sortIdsByPosition(nextReady, items);
  }

  const supervisorAgentId = config.mode === 'supervisor'
    ? (config.supervisorAgentId && teamAgentSet.has(config.supervisorAgentId) ? config.supervisorAgentId : entryAgentIds[0])
    : '';

  const agentsById = {};
  for (const id of agentIds) {
    const conn = inspectAgentConnections(items, id);
    const upstreamForward = forwardEdges.filter(e => e.to === id).map(e => e.from);
    const downstreamForward = forwardEdges.filter(e => e.from === id).map(e => e.to);
    const feedbackFrom = feedbackEdges.filter(e => e.to === id).map(e => e.from);
    agentsById[id] = {
      id,
      item: items[id],
      config: readAgentNodeConfig(items[id]),
      promptInputs: conn.promptInputs,
      dataInputs: conn.dataInputs,
      externalUpstreamAgents: conn.upstreamAgents.filter(e => !teamAgentSet.has(e.sourceId)),
      upstreamAgentIds: [...new Set(upstreamForward)],
      downstreamAgentIds: [...new Set(downstreamForward)],
      feedbackFromIds: [...new Set(feedbackFrom)],
      outputSinks: conn.outputSinks,
    };
  }

  return {
    orchestratorId: rootId,
    item: rootItem,
    config,
    entryAgentIds,
    agentIds,
    waves,
    forwardEdges,
    feedbackEdges,
    orchestratorInputs,
    orchestratorOutputs,
    supervisorAgentId,
    agentsById,
  };
}
