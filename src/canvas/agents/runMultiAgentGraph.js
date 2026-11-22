import { validValue } from '../values/valueData.js';
import {
  agentModelOptions,
  isAgentInputItem,
  isAgentNodeItem,
  isAgentOutputItem,
  isAgentRouterItem,
  readAgentNodeConfig,
} from './agentCanvasModel.js';
import {
  buildTeamRoster,
  compileAgentPrompt,
  collectSelectedIdsForAgent,
  extractCodeForTarget,
  parseCollaborationDirectives,
} from './agentPromptBuilder.js';
import {
  collectInputEnvelope,
  evaluateAgentRouter,
} from './agentRouter.js';
import {
  resolveFlowFromNode,
  resolveMultiAgentGraph,
  resolveSingleAgentGraph,
} from './multiAgentGraph.js';

const RETRY_DELAYS_MS = [1200, 2500, 4000];
const RETRYABLE_BUSY_CODES = new Set(['AGENT_REQUEST_BUSY', 'AGENT_STATUS_BUSY']);

function makeAbortError() {
  const error = new Error('멀티 에이전트 작업이 중지되었습니다.');
  error.name = 'AbortError';
  error.code = 'AGENT_ABORTED';
  return error;
}

function abortableWait(ms, signal) {
  if (signal?.aborted) return Promise.reject(makeAbortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(makeAbortError());
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

async function acquireSessionId(executeAgent) {
  try {
    const res = await executeAgent({ operation: 'sessions', limit: 1, offset: 0 });
    return res?.draft?.id || undefined;
  } catch {
    return undefined;
  }
}

function createRunExecution(items, agentIds, executeAgent) {
  const mockAgents = new Map();
  for (const id of agentIds) {
    const config = readAgentNodeConfig(items[id]);
    if (config.engine === 'mock') mockAgents.set(id, config);
  }
  const mock = mockAgents.size > 0;
  if (mock && mockAgents.size !== agentIds.length) {
    throw new Error('모형 테스트에는 모형 에이전트만 연결하세요.');
  }
  const turns = new Map();
  return {
    mock,
    acquireSession: () => mock ? undefined : acquireSessionId(executeAgent),
    executorFor: id => {
      if (!mock) return executeAgent;
      const config = mockAgents.get(id);
      return async (_payload, onOutput) => {
        const turn = (turns.get(id) || 0) + 1;
        turns.set(id, turn);
        onOutput?.('모형 응답 생성');
        return { answer: turn > 1 && config.mockFollowup ? config.mockFollowup : config.mockResponse };
      };
    },
  };
}

async function callAgentWithRetry({ executeAgent, payload, onOutput, signal }) {
  if (signal?.aborted) throw makeAbortError();
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw makeAbortError();
    try {
      const result = await executeAgent(payload, line => {
        if (!signal?.aborted) onOutput?.(String(line || ''));
      });
      if (signal?.aborted) throw makeAbortError();
      const answer = String(result?.answer ?? result?.output ?? result?.message ?? '');
      return { answer, raw: result };
    } catch (error) {
      if (signal?.aborted) throw makeAbortError();
      if (!RETRYABLE_BUSY_CODES.has(error?.code) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }
      await abortableWait(RETRY_DELAYS_MS[attempt], signal);
    }
  }
}

function buildValuePatch(item, rawAnswer) {
  const text = String(rawAnswer || '').trim();
  let patch = null;
  if (item.valueType === 'text') {
    patch = { valueText: String(rawAnswer || '').replace(/\n$/, '').slice(0, 4096) };
  } else if (item.valueType === 'select') {
    const idx = (item.valueOptions || []).indexOf(text);
    patch = { valueNumber: idx >= 0 ? idx : (text ? Number(text) : NaN) };
  } else if (item.valueType === 'button') {
    const lower = text.toLowerCase();
    const num = ['1', 'true', '켜짐', 'on', 'yes'].includes(lower)
      ? 1
      : ['0', 'false', '꺼짐', 'off', 'no'].includes(lower)
        ? 0
        : Number(text);
    patch = { valueNumber: num };
  } else {
    patch = { valueNumber: text ? Number(text) : NaN };
  }
  return validValue({ ...item, ...patch }) ? patch : null;
}

async function deliverOutputs({
  sourceId,
  sourceName,
  answer,
  cleanAnswer,
  outputSinks,
  runId,
  items,
  routeMeta = null,
  onDeliver,
}) {
  const body = String(cleanAnswer || answer || '').trim();
  if (!body || !outputSinks?.length) return;
  for (const sink of outputSinks) {
    const targetId = sink.targetId || sink.otherId;
    const targetItem = items[targetId] || sink.item;
    if (!targetItem) continue;
    if (isAgentOutputItem(targetItem)) {
      await onDeliver?.({
        type: 'agent_output',
        targetId,
        sourceId,
        sourceName,
        runId,
        text: body,
        record: {
          runId,
          codeId: sourceId,
          createdAt: Date.now(),
          output: `[${sourceName}]\n${body}`,
          exitCode: 0,
        },
        meta: {
          updatedAt: Date.now(),
          status: 'success',
          sourceId,
          sourceName,
          runId,
          ...(routeMeta?.routedBy ? { routedBy: routeMeta.routedBy } : {}),
          ...(routeMeta?.routeReason ? { routeReason: routeMeta.routeReason } : {}),
          ...(routeMeta?.inputFormats?.length ? { inputFormats: routeMeta.inputFormats } : {}),
        },
      });
    } else if (targetItem.runtimeRole === 'output') {
      await onDeliver?.({
        type: 'output',
        targetId,
        sourceId,
        runId,
        record: {
          runId,
          codeId: sourceId,
          createdAt: Date.now(),
          output: `[${sourceName}]\n${body}`,
          exitCode: 0,
        },
      });
    } else if (targetItem.kind === 'value') {
      const valuePatch = buildValuePatch(targetItem, body);
      if (valuePatch) {
        await onDeliver?.({ type: 'value', targetId, sourceId, runId, valuePatch });
      }
    } else if (targetItem.kind === 'code' || (targetItem.kind === 'text' && targetItem.renderMode === 'code')) {
      if (sink.channel === 'output') {
        await onDeliver?.({
          type: 'text',
          targetId,
          sourceId,
          runId,
          text: extractCodeForTarget(body, targetItem.language),
        });
      }
    } else if (['text', 'note'].includes(targetItem.kind)) {
      await onDeliver?.({ type: 'text', targetId, sourceId, runId, text: body });
    }
  }
}

function summarizeText(text, max = 240) {
  const single = String(text || '').replace(/\s+/g, ' ').trim();
  if (single.length <= max) return single;
  return `${single.slice(0, max - 1)}…`;
}

function isBlockedByRouting(parentIds = [], routerIds, activeTargets, skippedNodes, nodeId) {
  return parentIds.length > 0 && !activeTargets.has(nodeId)
    && parentIds.every(id => routerIds.has(id) || skippedNodes.has(id));
}

function buildRouterInputEnvelope(items, routerId, { orchestratorInputs = [], ...options } = {}) {
  const direct = collectInputEnvelope(items, routerId, options);
  if (direct.items.length || !orchestratorInputs.length) return direct;
  return collectInputEnvelope(items, orchestratorInputs, options);
}

export async function runSingleAgent({
  items,
  agentId,
  executeAgent,
  resolveApiKey,
  getAnchor,
  signal,
  onEvent = () => {},
  onDeliver = () => {},
}) {
  const graph = resolveSingleAgentGraph(items, agentId);
  const execution = createRunExecution(items, [agentId], executeAgent);
  const runId = globalThis.crypto?.randomUUID?.() || `agent-${Date.now()}`;
  const name = graph.item.title || graph.config.role || 'AI 에이전트';

  onEvent({ type: 'start', runId, mode: 'single', rootId: agentId, agentIds: [agentId], totalRounds: 1 });
  onEvent({ type: 'agent_start', runId, agentId, agentName: name, round: 1, maxRounds: 1 });

  const sessionId = await execution.acquireSession();
  const envelope = collectInputEnvelope(items, agentId);
  const prompt = compileAgentPrompt({
    agentId,
    agentItem: graph.item,
    agentConfig: graph.config,
    items,
    inputNodes: graph.inputNodes,
    promptInputs: graph.promptInputs,
    dataInputs: graph.dataInputs,
    upstreamAgents: [...graph.upstreamAgents, ...graph.feedbackAgents],
    mode: 'single',
  });

  if (!execution.mock && !prompt.trim()) {
    throw new Error('에이전트 기본 프롬프트 또는 연결된 입력 객체가 필요합니다.');
  }

  const selectedIds = collectSelectedIdsForAgent({
    agentConfig: graph.config,
    inputNodes: graph.inputNodes,
    promptInputs: graph.promptInputs,
    dataInputs: graph.dataInputs,
    outputSinks: graph.outputSinks,
  });

  try {
    const { answer, raw } = await callAgentWithRetry({
      executeAgent: execution.executorFor(agentId),
      signal,
      payload: {
        operation: 'run',
        message: prompt,
        selected_ids: selectedIds,
        anchor: getAnchor?.(agentId) ?? null,
        include_history: false,
        allow_delete: Boolean(graph.config.allow_delete),
        options: agentModelOptions(graph.config),
        api_key: execution.mock ? '' : resolveApiKey?.(graph.config) || '',
        turn_id: globalThis.crypto?.randomUUID?.() || `${runId}:1`,
        ...(sessionId ? { session_id: sessionId } : {}),
      },
      onOutput: progress => onEvent({ type: 'agent_progress', runId, agentId, agentName: name, progress }),
    });

    const parsed = parseCollaborationDirectives(answer, []);
    const finalOutput = parsed.cleanAnswer || answer;
    await onDeliver({
      type: 'agent',
      targetId: agentId,
      sourceId: agentId,
      runId,
      text: finalOutput,
      meta: {
        updatedAt: Date.now(),
        status: 'success',
        runId,
        mode: 'single',
        round: 1,
        engine: graph.config.engine,
        cli_tool: graph.config.cli_tool,
        model: raw?.model || graph.config.cli_model || '',
      },
    });
    if (graph.config.writeToOutputs !== false) {
      await deliverOutputs({
        sourceId: agentId,
        sourceName: name,
        answer,
        cleanAnswer: finalOutput,
        outputSinks: graph.outputSinks,
        runId,
        items,
        routeMeta: { inputFormats: envelope.formats },
        onDeliver,
      });
    }
    onEvent({ type: 'agent_complete', runId, agentId, agentName: name, round: 1, answer: finalOutput, summary: summarizeText(finalOutput) });
    onEvent({ type: 'complete', runId, rootId: agentId, status: 'success', roundsCompleted: 1, answer: finalOutput });
    return { runId, answer: finalOutput, sessionId: raw?.session_id || sessionId };
  } catch (error) {
    onEvent({ type: 'agent_error', runId, agentId, agentName: name, round: 1, error: error.message });
    onEvent({ type: 'complete', runId, rootId: agentId, status: signal?.aborted ? 'stopped' : 'error', error: error.message });
    throw error;
  }
}

export async function runMultiAgentOrchestration({
  items,
  orchestratorId,
  executeAgent,
  resolveApiKey,
  getAnchor,
  signal,
  onEvent = () => {},
  onDeliver = () => {},
}) {
  const graph = resolveMultiAgentGraph(items, orchestratorId);
  const {
    config,
    agentIds,
    routerIds,
    incomingInputIds,
    inputIds,
    waves,
    flowWaves,
    forwardEdges,
    feedbackEdges,
    orchestratorInputs,
    orchestratorOutputs,
    supervisorAgentId,
    agentsById,
    routersById,
  } = graph;
  const execution = createRunExecution(items, agentIds, executeAgent);
  const runId = globalThis.crypto?.randomUUID?.() || `orch-${Date.now()}`;
  const startedAt = Date.now();
  const maxRounds = config.mode === 'graph' ? 1 : config.maxRounds;
  const teamRoster = buildTeamRoster(items, agentIds);
  const rosterById = new Map(teamRoster.map(entry => [entry.id, entry]));
  const routerIdSet = new Set(routerIds || []);

  onEvent({
    type: 'start',
    runId,
    mode: config.mode,
    rootId: orchestratorId,
    agentIds,
    routerIds: routerIds || [],
    inputIds: [...new Set([...(incomingInputIds || []), ...(inputIds || [])])],
    totalRounds: maxRounds,
  });

  let sessionId = await execution.acquireSession();
  const freshAgentOutputs = new Map();
  const freshRuntimeOutputs = new Map();
  const peerInbox = new Map(agentIds.map(id => [id, []]));
  const sharedLog = [];
  const routedInputsForTarget = new Map();
  const routeContextForTarget = new Map();
  const routerActivatedTargets = new Set();
  const skippedNodes = new Set();
  let roundsCompleted = 0;
  let converged = false;
  let lastSucceededId = '';
  let lastSucceededAnswer = '';
  let lastRouteMeta = null;
  const failedAgents = new Set();

  for (const inId of incomingInputIds || []) {
    await onDeliver({ type: 'agent_input', targetId: inId, sourceId: inId, runId, updatedAt: Date.now() });
    onEvent({ type: 'input_ready', runId, inputId: inId, inputName: items[inId]?.title || '입력 객체' });
  }

  const executeInputStep = async (inputId) => {
    const inputItem = items[inputId];
    const inputName = inputItem?.title || '입력 객체';
    await onDeliver({ type: 'agent_input', targetId: inputId, sourceId: inputId, runId, updatedAt: Date.now() });
    onEvent({ type: 'input_ready', runId, inputId, inputName });
  };

  const executeRouterStep = async (routerId, round = 1) => {
    const routerNode = routersById?.[routerId];
    const routerItem = items[routerId] || routerNode?.item;
    const routerName = routerItem?.title || '라우터 객체';
    if (isBlockedByRouting(routerNode?.upstreamIds, routerIdSet, routerActivatedTargets, skippedNodes, routerId)) {
      skippedNodes.add(routerId);
      onEvent({ type: 'router_skipped', runId, routerId });
      return;
    }
    onEvent({ type: 'router_start', runId, routerId, routerName, round });

    const envelope = buildRouterInputEnvelope(items, routerId, {
      orchestratorInputs,
      freshAgentOutputs,
      freshRuntimeOutputs,
      routedInputs: routedInputsForTarget.get(routerId),
      routingRouterIds: routerIdSet,
    });
    const decision = await evaluateAgentRouter({
      items,
      routerId,
      inputEnvelope: envelope,
      mock: execution.mock,
      executeAgent,
      resolveApiKey,
      getAnchor,
      callAgent: (payload, onOutput) => callAgentWithRetry({ executeAgent, payload, onOutput, signal }),
      signal,
      sessionId,
      runId,
      onOutput: progress => onEvent({ type: 'router_progress', runId, routerId, routerName, round, progress }),
    });

    for (const targetId of decision.selectedTargetIds) {
      routerActivatedTargets.add(targetId);
      const routedItems = decision.routedInputsByTarget?.[targetId] || envelope.items;
      const prev = routedInputsForTarget.get(targetId) || [];
      routedInputsForTarget.set(targetId, [...prev, ...routedItems]);
      routeContextForTarget.set(targetId, {
        routerId,
        routerName,
        modeUsed: decision.modeUsed,
        reason: decision.reason,
        formats: decision.detectedFormats,
      });
    }

    lastRouteMeta = {
      routedBy: routerName,
      routeReason: decision.reason,
      inputFormats: decision.detectedFormats,
    };

    const logEntry = {
      round,
      agentId: routerId,
      agentName: routerName,
      role: `라우터(${decision.modeUsed})`,
      status: decision.selectedTargetIds.length ? 'success' : 'skipped',
      summary: `${decision.selectedTargetNames.join(', ') || '선택 없음'} · ${decision.reason}`,
      directives: decision.selectedTargetIds.map((tid, idx) => ({
        type: 'route',
        toName: decision.selectedTargetNames[idx] || tid,
      })),
      approved: false,
      done: false,
    };
    sharedLog.push(logEntry);

    await onDeliver({
      type: 'router',
      targetId: routerId,
      sourceId: routerId,
      runId,
      decision: {
        updatedAt: decision.updatedAt,
        runId,
        modeUsed: decision.modeUsed,
        detectedFormats: decision.detectedFormats,
        selectedTargetIds: decision.selectedTargetIds,
        selectedTargetNames: decision.selectedTargetNames,
        reason: decision.reason,
        fallbackUsed: decision.fallbackUsed,
      },
    });

    // If the router points directly to an output sink (without an intermediate agent), deliver the routing report.
    const directOutputSinks = (routerNode?.outputSinks || []).filter(sink =>
      decision.selectedTargetIds.includes(sink.targetId || sink.otherId),
    );
    if (directOutputSinks.length) {
      const reportText = `## 라우팅 결과 (${routerName})\n- 선택 대상: ${decision.selectedTargetNames.join(', ')}\n- 이유: ${decision.reason}\n\n${envelope.combinedText || ''}`.trim();
      await deliverOutputs({
        sourceId: routerId,
        sourceName: routerName,
        answer: reportText,
        cleanAnswer: reportText,
        outputSinks: directOutputSinks,
        runId,
        items,
        routeMeta: lastRouteMeta,
        onDeliver,
      });
    }

    onEvent({
      type: 'router_decision',
      runId,
      routerId,
      routerName,
      round,
      decision,
      logEntry,
    });
    return decision;
  };

  const shouldSkipAgent = (agentId) => {
    return isBlockedByRouting(agentsById[agentId]?.incomingPipelineIds, routerIdSet, routerActivatedTargets, skippedNodes, agentId);
  };

  const executeAgentTurn = async ({ agentId, round, waveSnapshot, isSupervisor = false }) => {
    const node = agentsById[agentId];
    const agentConfig = readAgentNodeConfig(items[agentId] || node.item);
    const agentName = rosterById.get(agentId)?.name || node.item?.title || agentConfig.role || agentId;

    onEvent({ type: 'agent_start', runId, agentId, agentName, round, maxRounds });

    const inbox = peerInbox.get(agentId) || [];
    peerInbox.set(agentId, []);

    const downstreamPeers = node.downstreamAgentIds.map(id => rosterById.get(id)).filter(Boolean);
    const routedInputs = routedInputsForTarget.get(agentId) || [];
    const routeContext = routeContextForTarget.get(agentId) || null;
    const prompt = compileAgentPrompt({
      agentId,
      agentItem: node.item,
      agentConfig,
      orchestratorConfig: config,
      items,
      freshAgentOutputs: waveSnapshot || freshAgentOutputs,
      freshRuntimeOutputs,
      orchestratorInputs,
      inputNodes: node.inputNodes,
      promptInputs: node.promptInputs,
      dataInputs: node.dataInputs,
      routedInputs,
      routeContext,
      upstreamAgents: node.externalUpstreamAgents,
      upstreamAgentIds: node.upstreamAgentIds,
      peerMessages: inbox,
      sharedLog,
      teamRoster,
      downstreamPeers,
      round,
      maxRounds,
      mode: config.mode,
      isSupervisor,
    });

    const selectedIds = collectSelectedIdsForAgent({
      agentConfig,
      inputNodes: node.inputNodes,
      promptInputs: node.promptInputs,
      dataInputs: node.dataInputs,
      orchestratorInputs,
      routedInputs,
      outputSinks: node.outputSinks,
    });

    try {
      const { answer, raw } = await callAgentWithRetry({
        executeAgent: execution.executorFor(agentId),
        signal,
        payload: {
          operation: 'run',
          message: prompt,
          selected_ids: selectedIds,
          anchor: getAnchor?.(agentId) ?? null,
          include_history: false,
          allow_delete: Boolean(agentConfig.allow_delete),
          options: agentModelOptions(agentConfig),
          api_key: execution.mock ? '' : resolveApiKey?.(agentConfig) || '',
          turn_id: globalThis.crypto?.randomUUID?.() || `${runId}:${round}:${agentId}`,
          ...(sessionId ? { session_id: sessionId } : {}),
        },
        onOutput: progress => onEvent({ type: 'agent_progress', runId, agentId, agentName, round, progress }),
      });

      if (raw?.session_id) sessionId = raw.session_id;
      const parsed = parseCollaborationDirectives(answer, teamRoster);
      const cleanAnswer = parsed.cleanAnswer || answer;
      freshAgentOutputs.set(agentId, cleanAnswer);
      lastSucceededId = agentId;
      lastSucceededAnswer = cleanAnswer;

      const routedDirectives = [];
      for (const directive of agentConfig.canDelegate ? parsed.directives : []) {
        if (directive.type === 'broadcast') {
          for (const peerId of agentIds) {
            if (peerId !== agentId) {
              peerInbox.get(peerId).push({ fromId: agentId, fromName: agentName, type: 'broadcast', message: directive.message, round });
            }
          }
          routedDirectives.push({ type: 'broadcast', toId: null, toName: '전체 팀', message: directive.message });
        } else if (directive.toId && directive.toId !== agentId && peerInbox.has(directive.toId)) {
          peerInbox.get(directive.toId).push({
            fromId: agentId,
            fromName: agentName,
            type: directive.type,
            message: directive.message,
            round,
          });
          routedDirectives.push({ type: directive.type, toId: directive.toId, toName: directive.toName, message: directive.message });
        }
      }

      const logEntry = {
        round,
        agentId,
        agentName,
        role: agentConfig.role,
        status: 'success',
        summary: summarizeText(cleanAnswer),
        directives: routedDirectives,
        approved: parsed.approved,
        done: parsed.done,
      };
      sharedLog.push(logEntry);

      await onDeliver({
        type: 'agent',
        targetId: agentId,
        sourceId: agentId,
        runId,
        text: cleanAnswer,
        meta: {
          updatedAt: Date.now(),
          status: 'success',
          runId,
          mode: config.mode,
          round,
          engine: agentConfig.engine,
          cli_tool: agentConfig.cli_tool,
          model: raw?.model || agentConfig.cli_model || '',
          directivesCount: routedDirectives.length,
        },
      });

      const turnRouteMeta = routeContext
        ? {
          routedBy: routeContext.routerName,
          routeReason: routeContext.reason,
          inputFormats: routeContext.formats,
        }
        : lastRouteMeta;

      if (agentConfig.writeToOutputs !== false) {
        await deliverOutputs({
          sourceId: agentId,
          sourceName: agentName,
          answer,
          cleanAnswer,
          outputSinks: node.outputSinks,
          runId,
          items,
          routeMeta: turnRouteMeta,
          onDeliver,
        });
      }

      onEvent({
        type: 'agent_complete',
        runId,
        agentId,
        agentName,
        round,
        answer: cleanAnswer,
        summary: logEntry.summary,
        directives: routedDirectives,
        approved: parsed.approved,
        done: parsed.done,
        logEntry,
      });

      return { parsed, routedDirectives, cleanAnswer };
    } catch (error) {
      failedAgents.add(agentId);
      const logEntry = {
        round,
        agentId,
        agentName,
        role: agentConfig.role,
        status: 'error',
        summary: summarizeText(error.message),
        directives: [],
        approved: false,
        done: false,
      };
      sharedLog.push(logEntry);
      onEvent({ type: 'agent_error', runId, agentId, agentName, round, error: error.message, logEntry });
      if (config.stopOnError || signal?.aborted) throw error;
      return null;
    }
  };

  try {
    if (config.mode === 'graph') {
      roundsCompleted = 1;
      for (const wave of flowWaves) {
        const waveSnapshot = new Map(freshAgentOutputs);
        for (const nodeId of wave) {
          if (isAgentInputItem(items[nodeId])) {
            await executeInputStep(nodeId);
            continue;
          }
          if (isAgentRouterItem(items[nodeId])) {
            await executeRouterStep(nodeId, 1);
            continue;
          }
          if (isAgentNodeItem(items[nodeId])) {
            if (shouldSkipAgent(nodeId)) {
              skippedNodes.add(nodeId);
              onEvent({
                type: 'agent_skipped',
                runId,
                agentId: nodeId,
                agentName: rosterById.get(nodeId)?.name || nodeId,
                round: 1,
                reason: '라우터에서 선택되지 않아 건너뜁니다.',
              });
              continue;
            }
            if ([...(agentsById[nodeId]?.upstreamAgentIds || [])].some(up => failedAgents.has(up)) && config.stopOnError) {
              continue;
            }
            await executeAgentTurn({ agentId: nodeId, round: 1, waveSnapshot });
          }
        }
      }
      converged = true;
    } else if (config.mode === 'collaborative') {
      // Execute leading input/router waves before collaborative agent rounds.
      for (const wave of flowWaves) {
        for (const nodeId of wave) {
          if (isAgentInputItem(items[nodeId])) await executeInputStep(nodeId);
          else if (isAgentRouterItem(items[nodeId])) await executeRouterStep(nodeId, 1);
        }
      }

      const initialTargets = agentIds.filter(id => !shouldSkipAgent(id));
      for (const id of agentIds) {
        if (!initialTargets.includes(id)) {
          skippedNodes.add(id);
          onEvent({
            type: 'agent_skipped',
            runId,
            agentId: id,
            agentName: rosterById.get(id)?.name || id,
            round: 1,
            reason: '라우터에서 선택되지 않아 건너뜁니다.',
          });
        }
      }

      let nextRoundTargets = new Set(initialTargets);
      for (let round = 1; round <= maxRounds; round++) {
        if (!nextRoundTargets.size) {
          converged = true;
          break;
        }
        roundsCompleted = round;
        const roundOutcomes = new Map();
        const activeThisRound = new Set(nextRoundTargets);

        for (const wave of waves) {
          const waveSnapshot = new Map(freshAgentOutputs);
          for (const agentId of wave) {
            if (!activeThisRound.has(agentId)) continue;
            const outcome = await executeAgentTurn({ agentId, round, waveSnapshot });
            if (outcome) {
              roundOutcomes.set(agentId, outcome);
              for (const d of outcome.routedDirectives) {
                if (['handoff', 'ask'].includes(d.type) && d.toId) activeThisRound.add(d.toId);
              }
            }
          }
        }

        if (round >= maxRounds) break;

        const nextTargets = new Set();
        for (const id of agentIds) {
          const pending = peerInbox.get(id) || [];
          if (pending.some(m => ['revise', 'ask', 'delegate', 'handoff'].includes(m.type))) {
            nextTargets.add(id);
          }
        }

        // Feedback edges trigger another revision pass unless the reviewer explicitly approved/finished.
        for (const fb of feedbackEdges) {
          const sourceOutcome = roundOutcomes.get(fb.from);
          const sourceSatisfied = sourceOutcome && (sourceOutcome.parsed.approved || sourceOutcome.parsed.done);
          if (roundOutcomes.has(fb.from) && !sourceSatisfied) {
            nextTargets.add(fb.to);
            if (!peerInbox.get(fb.to).length && freshAgentOutputs.has(fb.from)) {
              peerInbox.get(fb.to).push({
                fromId: fb.from,
                fromName: rosterById.get(fb.from)?.name || fb.from,
                type: 'revise',
                message: freshAgentOutputs.get(fb.from),
                round,
              });
            }
          }
        }

        if (!nextTargets.size && config.consensusStop) {
          converged = true;
          break;
        }

        // Propagate downstream in DAG order so reviewers/synthesizers re-evaluate revised outputs.
        const propagated = nextTargets.size ? nextTargets : activeThisRound;
        let added = true;
        while (added) {
          added = false;
          for (const edge of forwardEdges) {
            if (propagated.has(edge.from) && !propagated.has(edge.to)) {
              propagated.add(edge.to);
              added = true;
            }
          }
        }
        nextRoundTargets = propagated;
      }
    } else if (config.mode === 'supervisor') {
      for (const wave of flowWaves) {
        for (const nodeId of wave) {
          if (isAgentInputItem(items[nodeId])) await executeInputStep(nodeId);
          else if (isAgentRouterItem(items[nodeId])) await executeRouterStep(nodeId, 1);
        }
      }

      const workers = agentIds.filter(id => id !== supervisorAgentId && !shouldSkipAgent(id));
      const workerWaves = waves.map(w => w.filter(id => id !== supervisorAgentId)).filter(w => w.length);

      for (let round = 1; round <= maxRounds; round++) {
        roundsCompleted = round;
        const supOutcome = await executeAgentTurn({
          agentId: supervisorAgentId,
          round,
          waveSnapshot: new Map(freshAgentOutputs),
          isSupervisor: true,
        });

        if (!supOutcome) break;
        if (supOutcome.parsed.done && (round > 1 || !workers.length)) {
          converged = true;
          break;
        }

        if (!workers.length) {
          converged = true;
          break;
        }

        const directedWorkers = new Set(
          supOutcome.routedDirectives
            .filter(d => ['delegate', 'revise', 'handoff', 'ask'].includes(d.type) && d.toId && d.toId !== supervisorAgentId)
            .map(d => d.toId),
        );

        if (round > 1 && supOutcome.parsed.approved && !directedWorkers.size) {
          converged = true;
          break;
        }

        const activeWorkers = round === 1 && !directedWorkers.size ? new Set(workers) : directedWorkers;
        if (!activeWorkers.size) {
          converged = true;
          break;
        }

        let added = true;
        while (added) {
          added = false;
          for (const edge of forwardEdges) {
            if (edge.from !== supervisorAgentId && edge.to !== supervisorAgentId && activeWorkers.has(edge.from) && !activeWorkers.has(edge.to)) {
              activeWorkers.add(edge.to);
              added = true;
            }
          }
        }

        let anyWorkerRan = false;
        for (const wave of workerWaves) {
          const waveSnapshot = new Map(freshAgentOutputs);
          for (const workerId of wave) {
            if (!activeWorkers.has(workerId)) continue;
            anyWorkerRan = true;
            const wOutcome = await executeAgentTurn({ agentId: workerId, round, waveSnapshot });
            if (wOutcome) {
              for (const d of wOutcome.routedDirectives) {
                if (['handoff', 'ask'].includes(d.type) && d.toId && d.toId !== supervisorAgentId) {
                  activeWorkers.add(d.toId);
                }
              }
            }
          }
        }

        // On the final round, run one concluding synthesis turn so the supervisor integrates worker deliverables.
        if (round === maxRounds && anyWorkerRan) {
          await executeAgentTurn({
            agentId: supervisorAgentId,
            round,
            waveSnapshot: new Map(freshAgentOutputs),
            isSupervisor: true,
          });
          converged = true;
        }
      }
    }

    const finalDeliverable = (config.mode === 'supervisor' && freshAgentOutputs.get(supervisorAgentId))
      || lastSucceededAnswer
      || '';
    const orchestratorTitle = graph.item.title || '멀티 에이전트 오케스트레이터';
    const summaryText = finalDeliverable
      || sharedLog.map(e => `### R${e.round} · ${e.agentName}\n${e.summary}`).join('\n\n');

    const runSummary = {
      runId,
      startedAt,
      endedAt: Date.now(),
      status: failedAgents.size && !lastSucceededId ? 'error' : 'success',
      mode: config.mode,
      roundsCompleted,
      agentCount: agentIds.length,
      converged,
      log: sharedLog,
    };

    await onDeliver({
      type: 'orchestrator',
      targetId: orchestratorId,
      sourceId: orchestratorId,
      runId,
      text: summaryText,
      runSummary,
    });

    await deliverOutputs({
      sourceId: orchestratorId,
      sourceName: orchestratorTitle,
      answer: summaryText,
      cleanAnswer: summaryText,
      outputSinks: orchestratorOutputs,
      runId,
      items,
      routeMeta: lastRouteMeta,
      onDeliver,
    });

    onEvent({
      type: 'complete',
      runId,
      rootId: orchestratorId,
      status: runSummary.status,
      roundsCompleted,
      converged,
      answer: summaryText,
      runSummary,
    });

    return { runId, sessionId, answer: summaryText, runSummary };
  } catch (error) {
    const status = signal?.aborted ? 'stopped' : 'error';
    const runSummary = {
      runId,
      startedAt,
      endedAt: Date.now(),
      status,
      mode: config.mode,
      roundsCompleted,
      agentCount: agentIds.length,
      converged: false,
      error: error.message,
      log: sharedLog,
    };
    await onDeliver({
      type: 'orchestrator',
      targetId: orchestratorId,
      sourceId: orchestratorId,
      runId,
      text: lastSucceededAnswer || '',
      runSummary,
    });
    onEvent({ type: 'complete', runId, rootId: orchestratorId, status, error: error.message, runSummary });
    throw error;
  }
}

async function runResolvedFlow({
  items,
  flow,
  executeAgent,
  resolveApiKey,
  getAnchor,
  signal,
  onEvent = () => {},
  onDeliver = () => {},
}) {
  const { startId, startItem, startKind, routerIds, agentIds, flowWaves, agentsById, routersById } = flow;
  const execution = createRunExecution(items, agentIds, executeAgent);
  const runId = globalThis.crypto?.randomUUID?.() || `${startKind}-${Date.now()}`;
  const teamRoster = buildTeamRoster(items, agentIds);
  const rosterById = new Map(teamRoster.map(entry => [entry.id, entry]));
  const routerIdSet = new Set(routerIds || []);

  onEvent({
    type: 'start',
    runId,
    mode: startKind,
    rootId: startId,
    agentIds,
    routerIds: routerIds || [],
    totalRounds: 1,
  });

  let sessionId = await execution.acquireSession();
  const freshAgentOutputs = new Map();
  const routedInputsForTarget = new Map();
  const routeContextForTarget = new Map();
  const routerActivatedTargets = new Set();
  const skippedNodes = new Set();
  let lastAnswer = '';
  let lastDecision = null;
  let lastRouteMeta = null;

  try {
    for (const wave of flowWaves) {
      const waveSnapshot = new Map(freshAgentOutputs);
      for (const nodeId of wave) {
        if (isAgentInputItem(items[nodeId])) {
          await onDeliver({ type: 'agent_input', targetId: nodeId, sourceId: nodeId, runId, updatedAt: Date.now() });
          onEvent({ type: 'input_ready', runId, inputId: nodeId, inputName: items[nodeId]?.title || '입력 객체' });
          continue;
        }

        if (isAgentRouterItem(items[nodeId])) {
          const routerNode = routersById[nodeId];
          if (isBlockedByRouting(routerNode?.upstreamIds, routerIdSet, routerActivatedTargets, skippedNodes, nodeId)) {
            skippedNodes.add(nodeId);
            onEvent({ type: 'router_skipped', runId, routerId: nodeId });
            continue;
          }
          const routerItem = items[nodeId] || routerNode?.item;
          const routerName = routerItem?.title || '라우터 객체';
          onEvent({ type: 'router_start', runId, routerId: nodeId, routerName, round: 1 });
          const envelope = collectInputEnvelope(items, nodeId, {
            freshAgentOutputs: waveSnapshot,
            routedInputs: routedInputsForTarget.get(nodeId),
            routingRouterIds: routerIdSet,
          });
          const decision = await evaluateAgentRouter({
            items,
            routerId: nodeId,
            inputEnvelope: envelope,
            mock: execution.mock,
            executeAgent,
            resolveApiKey,
            getAnchor,
            callAgent: (payload, onOutput) => callAgentWithRetry({ executeAgent, payload, onOutput, signal }),
            signal,
            sessionId,
            runId,
            onOutput: progress => onEvent({ type: 'router_progress', runId, routerId: nodeId, routerName, round: 1, progress }),
          });
          lastDecision = decision;
          lastRouteMeta = {
            routedBy: routerName,
            routeReason: decision.reason,
            inputFormats: decision.detectedFormats,
          };
          for (const targetId of decision.selectedTargetIds) {
            routerActivatedTargets.add(targetId);
            const routedItems = decision.routedInputsByTarget?.[targetId] || envelope.items;
            const prev = routedInputsForTarget.get(targetId) || [];
            routedInputsForTarget.set(targetId, [...prev, ...routedItems]);
            routeContextForTarget.set(targetId, {
              routerId: nodeId,
              routerName,
              modeUsed: decision.modeUsed,
              reason: decision.reason,
              formats: decision.detectedFormats,
            });
          }
          await onDeliver({
            type: 'router',
            targetId: nodeId,
            sourceId: nodeId,
            runId,
            decision: {
              updatedAt: decision.updatedAt,
              runId,
              modeUsed: decision.modeUsed,
              detectedFormats: decision.detectedFormats,
              selectedTargetIds: decision.selectedTargetIds,
              selectedTargetNames: decision.selectedTargetNames,
              reason: decision.reason,
              fallbackUsed: decision.fallbackUsed,
            },
          });
          const directOutputSinks = (routerNode?.outputSinks || []).filter(sink =>
            decision.selectedTargetIds.includes(sink.targetId || sink.otherId),
          );
          if (directOutputSinks.length) {
            const reportText = `## 라우팅 결과 (${routerName})\n- 선택 대상: ${decision.selectedTargetNames.join(', ')}\n- 이유: ${decision.reason}\n\n${envelope.combinedText || ''}`.trim();
            lastAnswer = reportText;
            await deliverOutputs({
              sourceId: nodeId,
              sourceName: routerName,
              answer: reportText,
              cleanAnswer: reportText,
              outputSinks: directOutputSinks,
              runId,
              items,
              routeMeta: lastRouteMeta,
              onDeliver,
            });
          }
          onEvent({ type: 'router_decision', runId, routerId: nodeId, routerName, round: 1, decision });
          continue;
        }

        if (isAgentNodeItem(items[nodeId])) {
          const node = agentsById[nodeId];
          if (isBlockedByRouting(node?.incomingPipelineIds, routerIdSet, routerActivatedTargets, skippedNodes, nodeId)) {
            skippedNodes.add(nodeId);
            onEvent({
              type: 'agent_skipped',
              runId,
              agentId: nodeId,
              agentName: rosterById.get(nodeId)?.name || nodeId,
              round: 1,
              reason: '라우터에서 선택되지 않아 건너뜁니다.',
            });
            continue;
          }

          const agentConfig = readAgentNodeConfig(items[nodeId]);
          const agentName = rosterById.get(nodeId)?.name || items[nodeId]?.title || agentConfig.role || nodeId;
          onEvent({ type: 'agent_start', runId, agentId: nodeId, agentName, round: 1, maxRounds: 1 });

          const routedInputs = routedInputsForTarget.get(nodeId) || [];
          const routeContext = routeContextForTarget.get(nodeId) || null;
          const prompt = compileAgentPrompt({
            agentId: nodeId,
            agentItem: node.item,
            agentConfig,
            items,
            freshAgentOutputs: waveSnapshot,
            inputNodes: node.inputNodes,
            promptInputs: node.promptInputs,
            dataInputs: node.dataInputs,
            routedInputs,
            routeContext,
            upstreamAgents: node.externalUpstreamAgents,
            upstreamAgentIds: node.upstreamAgentIds,
            mode: 'single',
          });
          const selectedIds = collectSelectedIdsForAgent({
            agentConfig,
            inputNodes: node.inputNodes,
            promptInputs: node.promptInputs,
            dataInputs: node.dataInputs,
            routedInputs,
            outputSinks: node.outputSinks,
          });

          try {
            const { answer, raw } = await callAgentWithRetry({
              executeAgent: execution.executorFor(nodeId),
              signal,
              payload: {
                operation: 'run',
                message: prompt,
                selected_ids: selectedIds,
                anchor: getAnchor?.(nodeId) ?? null,
                include_history: false,
                allow_delete: Boolean(agentConfig.allow_delete),
                options: agentModelOptions(agentConfig),
                api_key: execution.mock ? '' : resolveApiKey?.(agentConfig) || '',
                turn_id: globalThis.crypto?.randomUUID?.() || `${runId}:${nodeId}`,
                ...(sessionId ? { session_id: sessionId } : {}),
              },
              onOutput: progress => onEvent({ type: 'agent_progress', runId, agentId: nodeId, agentName, round: 1, progress }),
            });
            if (raw?.session_id) sessionId = raw.session_id;
            const parsed = parseCollaborationDirectives(answer, teamRoster);
            const finalOutput = parsed.cleanAnswer || answer;
            freshAgentOutputs.set(nodeId, finalOutput);
            lastAnswer = finalOutput;

            await onDeliver({
              type: 'agent',
              targetId: nodeId,
              sourceId: nodeId,
              runId,
              text: finalOutput,
              meta: {
                updatedAt: Date.now(),
                status: 'success',
                runId,
                mode: startKind,
                round: 1,
                engine: agentConfig.engine,
                cli_tool: agentConfig.cli_tool,
                model: raw?.model || agentConfig.cli_model || '',
              },
            });
            if (agentConfig.writeToOutputs !== false) {
              await deliverOutputs({
                sourceId: nodeId,
                sourceName: agentName,
                answer,
                cleanAnswer: finalOutput,
                outputSinks: node.outputSinks,
                runId,
                items,
                routeMeta: routeContext
                  ? { routedBy: routeContext.routerName, routeReason: routeContext.reason, inputFormats: routeContext.formats }
                  : lastRouteMeta,
                onDeliver,
              });
            }
            onEvent({ type: 'agent_complete', runId, agentId: nodeId, agentName, round: 1, answer: finalOutput, summary: summarizeText(finalOutput) });
          } catch (error) {
            onEvent({ type: 'agent_error', runId, agentId: nodeId, agentName, round: 1, error: error.message });
            throw error;
          }
        }
      }
    }

    onEvent({
      type: 'complete',
      runId,
      rootId: startId,
      status: 'success',
      roundsCompleted: 1,
      answer: lastAnswer,
      decision: lastDecision,
    });
    return { runId, sessionId, answer: lastAnswer, decision: lastDecision };
  } catch (error) {
    onEvent({
      type: 'complete',
      runId,
      rootId: startId,
      status: signal?.aborted ? 'stopped' : 'error',
      error: error.message,
    });
    throw error;
  }
}

export async function runFromInputNode({
  items,
  inputId,
  executeAgent,
  resolveApiKey,
  getAnchor,
  signal,
  onEvent = () => {},
  onDeliver = () => {},
}) {
  const flow = resolveFlowFromNode(items, inputId);
  if (flow.orchestratorIds.length) {
    return runMultiAgentOrchestration({
      items,
      orchestratorId: flow.orchestratorIds[0],
      executeAgent,
      resolveApiKey,
      getAnchor,
      signal,
      onEvent,
      onDeliver,
    });
  }
  if (!flow.routerIds.length && !flow.agentIds.length) {
    throw new Error('입력 객체에 연결된 오케스트레이터, 라우터 또는 AI 에이전트가 없습니다.');
  }
  return runResolvedFlow({
    items,
    flow,
    executeAgent,
    resolveApiKey,
    getAnchor,
    signal,
    onEvent,
    onDeliver,
  });
}

export async function runFromRouterNode({
  items,
  routerId,
  executeAgent,
  resolveApiKey,
  getAnchor,
  signal,
  onEvent = () => {},
  onDeliver = () => {},
}) {
  const flow = resolveFlowFromNode(items, routerId);
  return runResolvedFlow({
    items,
    flow,
    executeAgent,
    resolveApiKey,
    getAnchor,
    signal,
    onEvent,
    onDeliver,
  });
}
