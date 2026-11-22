import { contentMode, contentSource, isTextContent } from '../content/contentPresentation.js';
import { displayedValue } from '../values/valueData.js';
import {
  isAgentCanvasObject,
  isAgentInputItem,
  isAgentNodeItem,
  isAgentOrchestratorItem,
  isAgentOutputItem,
  isAgentRouterItem,
  readAgentEdgeConfig,
  readAgentInputConfig,
  readAgentNodeConfig,
  readAgentOutputConfig,
  readAgentRouterConfig,
  readOrchestratorConfig,
} from './agentCanvasModel.js';
import {
  detectItemFormatType,
  extractRouterRoutes,
  formatTypeLabel,
} from './agentRouter.js';

export const MAX_MULTI_AGENTS = 16;
export const MAX_PIPELINE_NODES = 48;
export const MAX_GRAPH_OBJECTS = 256;
export const MAX_EXTRACTED_ITEM_CHARS = 4000;

const PROMPT_LABEL_RE = /프롬프트|시스템|지시|규칙|역할|prompt|system|instruction/i;
const CONTEXT_LABEL_RE = /컨텍스트|배경|참고|context|ref/i;
const FEEDBACK_LABEL_RE = /피드백|리뷰|검토|수정|feedback|review|revise|critique/i;
const SUPERVISOR_LABEL_RE = /감독|리더|supervisor|lead/i;

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

function isPipelineNode(item) {
  return isAgentInputItem(item) || isAgentRouterItem(item) || isAgentNodeItem(item);
}

function itemLabel(id, item) {
  if (!item) return String(id);
  if (isAgentNodeItem(item)) return item.title || readAgentNodeConfig(item).role || 'AI 에이전트';
  if (isAgentOrchestratorItem(item)) return item.title || '멀티 에이전트 오케스트레이터';
  if (isAgentInputItem(item)) return item.title || '입력 객체';
  if (isAgentRouterItem(item)) return item.title || '라우터 객체';
  if (isAgentOutputItem(item)) return item.title || '출력 객체';
  if (item.kind === 'note') return (item.text || '').split('\n').find(l => l.trim())?.replace(/^#+\s*/, '').slice(0, 40) || '포스트잇';
  if (isTextContent(item) && contentMode(item) === 'code') return item.filename || '코드 객체';
  if (isTextContent(item)) return (contentSource(item) || '').split('\n').find(l => l.trim())?.replace(/^#+\s*/, '').slice(0, 40) || '텍스트';
  if (item.kind === 'image') return item.title || item.filename || '이미지';
  if (item.kind === 'value') return item.title || `값 (${item.valueType})`;
  if (item.kind === 'table') return item.title || `테이블 (${item.rows?.length || 0}×${item.columns?.length || 0})`;
  if (item.kind === 'chart') return item.chartTitle || item.title || `그래프 (${item.chartType || 'bar'})`;
  if (item.kind === 'question') return (item.questionPrompt || '문제 객체').slice(0, 40);
  if (item.kind === 'link') {
    const fallback = item.mediaType === 'audio' ? '오디오' : item.mediaType === 'video' ? '동영상' : '링크';
    return item.title || item.url || fallback;
  }
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
  if (isAgentInputItem(sourceItem)) return 'input';
  if (isAgentRouterItem(sourceItem)) return 'route';
  if (isAgentOutputItem(targetItem)) return 'output';
  if (isAgentOrchestratorItem(sourceItem) && isAgentNodeItem(targetItem)) {
    return SUPERVISOR_LABEL_RE.test(connector?.label || '') ? 'supervisor' : 'orchestrate';
  }
  if (isAgentOrchestratorItem(sourceItem) && (isAgentRouterItem(targetItem) || isAgentInputItem(targetItem))) {
    return isAgentRouterItem(targetItem) ? 'route' : 'input';
  }
  if (isAgentNodeItem(sourceItem) && isAgentNodeItem(targetItem)) {
    return FEEDBACK_LABEL_RE.test(connector?.label || '') ? 'feedback' : 'handoff';
  }
  if (
    (isAgentNodeItem(sourceItem) || isAgentOrchestratorItem(sourceItem) || isAgentRouterItem(sourceItem))
    && (targetItem?.runtimeRole === 'output' || ['value', 'text', 'note'].includes(targetItem?.kind))
  ) {
    return 'output';
  }
  if (isAgentNodeItem(targetItem) || isAgentOrchestratorItem(targetItem) || isAgentRouterItem(targetItem) || isAgentInputItem(targetItem)) {
    const label = connector?.label || '';
    if (PROMPT_LABEL_RE.test(label)) return 'prompt';
    if (CONTEXT_LABEL_RE.test(label)) return 'context';
    return 'data';
  }
  return 'data';
}

export function isAgentOutputSink(item, channel = 'auto') {
  if (!item) return false;
  if (isAgentOutputItem(item)) return true;
  if (isAgentCanvasObject(item)) return false;
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
    return { id: key, kind: 'missing', title: key, typeLabel: '없음', formatType: 'text', content: '', summary: '', empty: true };
  }
  const title = itemLabel(key, item);
  const formatType = detectItemFormatType(item);
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
  } else if (isAgentInputItem(item)) {
    const cfg = readAgentInputConfig(item);
    typeLabel = `입력(${formatTypeLabel(formatType)})`;
    const parts = [];
    if (item.text) parts.push(String(item.text));
    if (cfg.attachments.length) {
      parts.push(cfg.attachments.map(att => {
        const meta = [att.name, att.mimeType, att.url].filter(Boolean).join(' · ');
        return `[${formatTypeLabel(att.formatType)}] ${meta}${att.textSnippet ? `\n${att.textSnippet}` : ''}`;
      }).join('\n'));
    }
    content = parts.join('\n\n');
  } else if (isAgentRouterItem(item)) {
    const cfg = readAgentRouterConfig(item);
    typeLabel = `라우터(${cfg.routingMode})`;
    content = cfg.lastDecision?.reason
      ? `선택: ${(cfg.lastDecision.selectedTargetNames || []).join(', ')} (${cfg.lastDecision.reason})`
      : (cfg.routingPrompt || '');
  } else if (isAgentOutputItem(item) || item.runtimeRole === 'output') {
    typeLabel = isAgentOutputItem(item) ? '출력 객체' : '실행 결과';
    const records = freshRuntimeOutputs?.get(key) || item.runtimeResults || [];
    const fromRecords = records
      .map(entry => entry?.error || entry?.output || '')
      .filter(Boolean)
      .join('\n---\n');
    content = isAgentOutputItem(item) ? String(item.text || fromRecords) : fromRecords;
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
  } else if (item.kind === 'image') {
    typeLabel = '이미지';
    content = [item.title || item.filename || '이미지 파일', item.url || item.src].filter(Boolean).join('\n');
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
    const mediaLabel = ({
      audio: '오디오',
      video: '동영상',
      youtube: 'YouTube',
      gif: 'GIF 이미지',
      link: '웹 링크',
    })[item.mediaType || 'link'] || item.mediaType || 'link';
    typeLabel = `링크(${mediaLabel})`;
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
    formatType,
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
    inputNodes: enabledIncoming.filter(e => isAgentInputItem(e.item)),
    routerNodes: enabledIncoming.filter(e => isAgentRouterItem(e.item)),
    promptInputs: enabledIncoming.filter(e => !isAgentCanvasObject(e.item) && e.channel === 'prompt'),
    dataInputs: enabledIncoming.filter(e => !isAgentCanvasObject(e.item) && !['prompt', 'output'].includes(e.channel)),
    upstreamAgents: enabledIncoming.filter(e => isAgentNodeItem(e.item) && e.channel !== 'feedback'),
    feedbackAgents: enabledIncoming.filter(e => isAgentNodeItem(e.item) && e.channel === 'feedback'),
    orchestrators: enabledIncoming.filter(e => isAgentOrchestratorItem(e.item)),
    outgoingInputs: enabledOutgoing.filter(e => isAgentInputItem(e.item)),
    outgoingRouters: enabledOutgoing.filter(e => isAgentRouterItem(e.item)),
    outgoingOrchestrators: enabledOutgoing.filter(e => isAgentOrchestratorItem(e.item)),
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
    inputNodes: connections.inputNodes,
    routerNodes: connections.routerNodes,
    promptInputs: connections.promptInputs,
    dataInputs: connections.dataInputs,
    upstreamAgents: connections.upstreamAgents,
    feedbackAgents: connections.feedbackAgents,
    outputSinks: connections.outputSinks,
  };
}

function buildTopologicalWaves(nodeIds, forwardEdges, items) {
  const inDegree = new Map(nodeIds.map(id => [id, 0]));
  const forwardAdj = new Map(nodeIds.map(id => [id, new Set()]));
  for (const e of forwardEdges) {
    if (!inDegree.has(e.from) || !inDegree.has(e.to)) continue;
    if (!forwardAdj.get(e.from).has(e.to)) {
      forwardAdj.get(e.from).add(e.to);
      inDegree.set(e.to, inDegree.get(e.to) + 1);
    }
  }

  const waves = [];
  let ready = sortIdsByPosition(nodeIds.filter(id => inDegree.get(id) === 0), items);
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
  return waves;
}

function collectReachablePipeline(items, seedIds, allConnectors) {
  const pipelineSet = new Set();
  const queue = [];

  for (const seed of seedIds) {
    const key = String(seed);
    if (!pipelineSet.has(key) && isPipelineNode(items[key])) {
      pipelineSet.add(key);
      queue.push(key);
    }
  }

  let agentCount = [...pipelineSet].filter(id => isAgentNodeItem(items[id])).length;
  while (queue.length) {
    const currentId = queue.shift();
    for (const [, edge] of allConnectors) {
      const from = String(edge.from);
      const to = String(edge.to);
      if (from !== currentId || !isPipelineNode(items[to])) continue;
      if (!readAgentEdgeConfig(edge).enabled) continue;
      if (!pipelineSet.has(to)) {
        if (pipelineSet.size >= MAX_PIPELINE_NODES) {
          throw new Error(`멀티 에이전트 파이프라인 노드는 최대 ${MAX_PIPELINE_NODES}개까지 연결할 수 있습니다.`);
        }
        if (isAgentNodeItem(items[to])) {
          if (agentCount >= MAX_MULTI_AGENTS) {
            throw new Error(`멀티 에이전트 팀은 최대 ${MAX_MULTI_AGENTS}개까지 연결할 수 있습니다.`);
          }
          agentCount++;
        }
        pipelineSet.add(to);
        queue.push(to);
      }
    }
  }

  const pipelineIds = sortIdsByPosition([...pipelineSet], items);
  const inputIds = pipelineIds.filter(id => isAgentInputItem(items[id]));
  const routerIds = pipelineIds.filter(id => isAgentRouterItem(items[id]));
  const agentIds = pipelineIds.filter(id => isAgentNodeItem(items[id]));
  return { pipelineSet, pipelineIds, inputIds, routerIds, agentIds };
}

function classifyPipelineEdges(nodeIds, entryIds, rawEdges, items) {
  const forwardEdges = [];
  const feedbackEdges = [];
  const nonExplicitAdj = new Map(nodeIds.map(id => [id, []]));

  for (const e of rawEdges) {
    if (e.channel === 'feedback' || e.from === e.to) {
      feedbackEdges.push(e);
    } else {
      nonExplicitAdj.get(e.from)?.push(e);
    }
  }

  const dfsState = new Map();
  const classifyDfs = (id) => {
    dfsState.set(id, 1);
    const outgoing = [...(nonExplicitAdj.get(id) || [])].sort((a, b) => {
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

  for (const id of entryIds) if (nonExplicitAdj.has(id) && !dfsState.has(id)) classifyDfs(id);
  for (const id of nodeIds) if (!dfsState.has(id)) classifyDfs(id);

  return { forwardEdges, feedbackEdges };
}

function checkStrictDag(nodeIds, entryIds, edges, items) {
  const adj = new Map(nodeIds.map(id => [id, []]));
  for (const e of edges) {
    if (e.from === e.to) {
      throw new Error('에이전트 그래프에 순환 연결이 있습니다. 협업 라운드 모드로 전환하거나 연결을 확인해주세요.');
    }
    adj.get(e.from)?.push(e.to);
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
  for (const id of entryIds) if (adj.has(id)) visit(id);
  for (const id of nodeIds) visit(id);
}

function buildNodeSummaries(items, { agentIds, routerIds, inputIds, teamAgentSet, forwardAgentEdges, feedbackAgentEdges, forwardPipelineEdges }) {
  const agentsById = {};
  for (const id of agentIds) {
    const conn = inspectAgentConnections(items, id);
    const upstreamForward = forwardAgentEdges.filter(e => e.to === id).map(e => e.from);
    const downstreamForward = forwardAgentEdges.filter(e => e.from === id).map(e => e.to);
    const feedbackFrom = feedbackAgentEdges.filter(e => e.to === id).map(e => e.from);
    const incomingPipelineIds = forwardPipelineEdges.filter(e => e.to === id).map(e => e.from);
    const downstreamRouterIds = forwardPipelineEdges
      .filter(e => e.from === id && isAgentRouterItem(items[e.to]))
      .map(e => e.to);

    agentsById[id] = {
      id,
      item: items[id],
      config: readAgentNodeConfig(items[id]),
      inputNodes: conn.inputNodes,
      routerNodes: conn.routerNodes,
      promptInputs: conn.promptInputs,
      dataInputs: conn.dataInputs,
      externalUpstreamAgents: conn.upstreamAgents.filter(e => !teamAgentSet.has(e.sourceId)),
      upstreamAgentIds: [...new Set(upstreamForward)],
      downstreamAgentIds: [...new Set(downstreamForward)],
      downstreamRouterIds: [...new Set(downstreamRouterIds)],
      incomingPipelineIds: [...new Set(incomingPipelineIds)],
      feedbackFromIds: [...new Set(feedbackFrom)],
      outputSinks: conn.outputSinks,
    };
  }

  const routersById = {};
  for (const id of routerIds) {
    const conn = inspectAgentConnections(items, id);
    const config = readAgentRouterConfig(items[id]);
    const routes = extractRouterRoutes(items, id, config);
    routersById[id] = {
      id,
      item: items[id],
      config,
      routes,
      inputNodes: conn.inputNodes,
      dataInputs: [...conn.promptInputs, ...conn.dataInputs],
      upstreamIds: [...new Set(forwardPipelineEdges.filter(e => e.to === id).map(e => e.from))],
      downstreamIds: [...new Set(forwardPipelineEdges.filter(e => e.from === id).map(e => e.to))],
      outputSinks: conn.outputSinks,
    };
  }

  const inputsById = {};
  for (const id of inputIds) {
    const conn = inspectAgentConnections(items, id);
    inputsById[id] = {
      id,
      item: items[id],
      config: readAgentInputConfig(items[id]),
      dataInputs: [...conn.promptInputs, ...conn.dataInputs],
      outgoing: conn.outgoing,
    };
  }

  return { agentsById, routersById, inputsById };
}

export function resolveMultiAgentGraph(items = {}, orchestratorId) {
  const rootId = String(orchestratorId);
  const rootItem = items[rootId];
  if (!isAgentOrchestratorItem(rootItem)) throw new Error('멀티 에이전트 오케스트레이터 객체가 필요합니다.');

  const config = readOrchestratorConfig(rootItem);
  const rootConnections = inspectAgentConnections(items, rootId);
  const incomingInputNodes = rootConnections.inputNodes;
  const incomingInputIds = incomingInputNodes.map(e => e.sourceId);
  const orchestratorInputs = rootConnections.incoming.filter(
    e => e.edgeConfig.enabled && (!isAgentCanvasObject(e.item) || isAgentInputItem(e.item)),
  );
  const orchestratorOutputs = rootConnections.outputSinks;

  const entryPipelineIds = sortIdsByPosition(
    [...new Set(rootConnections.outgoing.filter(e => e.edgeConfig.enabled && isPipelineNode(e.item)).map(e => e.targetId))],
    items,
  );
  if (!entryPipelineIds.length) {
    throw new Error('오케스트레이터에 연결된 AI 에이전트 또는 라우터 객체가 없습니다.');
  }

  const allConnectors = Object.entries(items)
    .filter(([, item]) => item?.kind === 'connector')
    .sort(([a], [b]) => a.localeCompare(b));

  const { pipelineSet, pipelineIds, inputIds: downstreamInputIds, routerIds, agentIds } = collectReachablePipeline(
    items,
    entryPipelineIds,
    allConnectors,
  );

  if (!agentIds.length) {
    throw new Error('오케스트레이터에 연결된 AI 에이전트 객체가 없습니다.');
  }

  const teamAgentSet = new Set(agentIds);
  const entryAgentIds = sortIdsByPosition(
    entryPipelineIds.filter(id => isAgentNodeItem(items[id])),
    items,
  );

  const pipelineEdges = [];
  const rawAgentEdges = [];
  for (const [connectorId, edge] of allConnectors) {
    const from = String(edge.from);
    const to = String(edge.to);
    if (!pipelineSet.has(from) || !pipelineSet.has(to)) continue;
    const edgeConfig = readAgentEdgeConfig(edge);
    if (!edgeConfig.enabled) continue;
    const channel = inferEdgeChannel(items[from], items[to], edge);
    const entry = { connectorId, edge, edgeConfig, channel, from, to };
    pipelineEdges.push(entry);
    if (teamAgentSet.has(from) && teamAgentSet.has(to)) {
      rawAgentEdges.push(entry);
    }
  }

  if (config.mode === 'graph') {
    checkStrictDag(pipelineIds, entryPipelineIds, pipelineEdges, items);
  }

  const { forwardEdges, feedbackEdges } = classifyPipelineEdges(agentIds, entryAgentIds, rawAgentEdges, items);
  const { forwardEdges: forwardPipelineEdges } = classifyPipelineEdges(pipelineIds, entryPipelineIds, pipelineEdges, items);

  const waves = buildTopologicalWaves(agentIds, forwardEdges, items);
  const flowWaves = buildTopologicalWaves(pipelineIds, forwardPipelineEdges, items);

  const supervisorEdge = rootConnections.outgoing.find(
    e => e.edgeConfig.enabled && e.channel === 'supervisor' && isAgentNodeItem(e.item) && teamAgentSet.has(e.targetId),
  );
  const supervisorAgentId = config.mode === 'supervisor'
    ? (supervisorEdge?.targetId
      || (config.supervisorAgentId && teamAgentSet.has(config.supervisorAgentId) ? config.supervisorAgentId : '')
      || entryAgentIds[0]
      || agentIds[0])
    : '';

  const allInputIds = [...new Set([...incomingInputIds, ...downstreamInputIds])];
  const { agentsById, routersById, inputsById } = buildNodeSummaries(items, {
    agentIds,
    routerIds,
    inputIds: allInputIds,
    teamAgentSet,
    forwardAgentEdges: forwardEdges,
    feedbackAgentEdges: feedbackEdges,
    forwardPipelineEdges,
  });

  const outputIdSet = new Set(orchestratorOutputs.map(e => e.targetId || e.otherId));
  for (const node of [...Object.values(agentsById), ...Object.values(routersById)]) {
    for (const sink of node.outputSinks || []) {
      outputIdSet.add(sink.targetId || sink.otherId);
    }
  }

  return {
    orchestratorId: rootId,
    item: rootItem,
    config,
    entryPipelineIds,
    entryAgentIds,
    incomingInputIds,
    inputIds: downstreamInputIds,
    routerIds,
    agentIds,
    pipelineIds,
    outputIds: [...outputIdSet],
    waves,
    flowWaves,
    forwardEdges,
    forwardPipelineEdges,
    feedbackEdges,
    orchestratorInputs,
    orchestratorOutputs,
    supervisorAgentId,
    agentsById,
    routersById,
    inputsById,
  };
}

export function resolveFlowFromNode(items = {}, startNodeId) {
  const startId = String(startNodeId);
  const startItem = items[startId];
  if (!isAgentInputItem(startItem) && !isAgentRouterItem(startItem)) {
    throw new Error('입력 객체 또는 라우터 객체가 필요합니다.');
  }

  const startConn = inspectAgentConnections(items, startId);
  const orchestratorTargets = startConn.outgoingOrchestrators.map(e => e.targetId);

  const allConnectors = Object.entries(items)
    .filter(([, item]) => item?.kind === 'connector')
    .sort(([a], [b]) => a.localeCompare(b));

  const { pipelineSet, pipelineIds, inputIds, routerIds, agentIds } = collectReachablePipeline(
    items,
    [startId],
    allConnectors,
  );

  const teamAgentSet = new Set(agentIds);
  const pipelineEdges = [];
  const rawAgentEdges = [];
  for (const [connectorId, edge] of allConnectors) {
    const from = String(edge.from);
    const to = String(edge.to);
    if (!pipelineSet.has(from) || !pipelineSet.has(to)) continue;
    const edgeConfig = readAgentEdgeConfig(edge);
    if (!edgeConfig.enabled) continue;
    const channel = inferEdgeChannel(items[from], items[to], edge);
    const entry = { connectorId, edge, edgeConfig, channel, from, to };
    pipelineEdges.push(entry);
    if (teamAgentSet.has(from) && teamAgentSet.has(to)) rawAgentEdges.push(entry);
  }

  const { forwardEdges, feedbackEdges } = classifyPipelineEdges(agentIds, [], rawAgentEdges, items);
  const { forwardEdges: forwardPipelineEdges } = classifyPipelineEdges(pipelineIds, [startId], pipelineEdges, items);
  const flowWaves = buildTopologicalWaves(pipelineIds, forwardPipelineEdges, items);

  const { agentsById, routersById, inputsById } = buildNodeSummaries(items, {
    agentIds,
    routerIds,
    inputIds,
    teamAgentSet,
    forwardAgentEdges: forwardEdges,
    feedbackAgentEdges: feedbackEdges,
    forwardPipelineEdges,
  });

  return {
    startId,
    startItem,
    startKind: isAgentInputItem(startItem) ? 'input' : 'router',
    orchestratorIds: orchestratorTargets,
    inputIds,
    routerIds,
    agentIds,
    pipelineIds,
    flowWaves,
    forwardPipelineEdges,
    agentsById,
    routersById,
    inputsById,
    directOutputs: startConn.outputSinks,
  };
}
