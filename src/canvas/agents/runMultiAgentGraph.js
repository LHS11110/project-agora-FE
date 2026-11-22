import { validValue } from '../values/valueData.js';
import {
  agentModelOptions,
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

async function deliverOutputs({ sourceId, sourceName, answer, cleanAnswer, outputSinks, runId, items, onDeliver }) {
  const body = String(cleanAnswer || answer || '').trim();
  if (!body || !outputSinks?.length) return;
  for (const sink of outputSinks) {
    const targetId = sink.targetId || sink.otherId;
    const targetItem = items[targetId] || sink.item;
    if (!targetItem) continue;
    if (targetItem.runtimeRole === 'output') {
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
  const runId = globalThis.crypto?.randomUUID?.() || `agent-${Date.now()}`;
  const name = graph.item.title || graph.config.role || 'AI 에이전트';

  onEvent({ type: 'start', runId, mode: 'single', rootId: agentId, agentIds: [agentId], totalRounds: 1 });
  onEvent({ type: 'agent_start', runId, agentId, agentName: name, round: 1, maxRounds: 1 });

  const sessionId = await acquireSessionId(executeAgent);
  const prompt = compileAgentPrompt({
    agentId,
    agentItem: graph.item,
    agentConfig: graph.config,
    items,
    promptInputs: graph.promptInputs,
    dataInputs: graph.dataInputs,
    upstreamAgents: [...graph.upstreamAgents, ...graph.feedbackAgents],
    mode: 'single',
  });

  if (!prompt.trim()) {
    throw new Error('에이전트 기본 프롬프트 또는 연결된 입력 객체가 필요합니다.');
  }

  const selectedIds = collectSelectedIdsForAgent({
    agentConfig: graph.config,
    promptInputs: graph.promptInputs,
    dataInputs: graph.dataInputs,
    outputSinks: graph.outputSinks,
  });

  try {
    const { answer, raw } = await callAgentWithRetry({
      executeAgent,
      signal,
      payload: {
        operation: 'run',
        message: prompt,
        selected_ids: selectedIds,
        anchor: getAnchor?.(agentId) ?? null,
        include_history: false,
        allow_delete: Boolean(graph.config.allow_delete),
        options: agentModelOptions(graph.config),
        api_key: resolveApiKey?.(graph.config) || '',
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
  const { config, agentIds, waves, forwardEdges, feedbackEdges, orchestratorInputs, orchestratorOutputs, supervisorAgentId, agentsById } = graph;
  const runId = globalThis.crypto?.randomUUID?.() || `orch-${Date.now()}`;
  const startedAt = Date.now();
  const maxRounds = config.mode === 'graph' ? 1 : config.maxRounds;
  const teamRoster = buildTeamRoster(items, agentIds);
  const rosterById = new Map(teamRoster.map(entry => [entry.id, entry]));

  onEvent({
    type: 'start',
    runId,
    mode: config.mode,
    rootId: orchestratorId,
    agentIds,
    totalRounds: maxRounds,
  });

  let sessionId = await acquireSessionId(executeAgent);
  const freshAgentOutputs = new Map();
  const peerInbox = new Map(agentIds.map(id => [id, []]));
  const sharedLog = [];
  let roundsCompleted = 0;
  let converged = false;
  let lastSucceededId = '';
  let lastSucceededAnswer = '';
  const failedAgents = new Set();

  const executeAgentTurn = async ({ agentId, round, waveSnapshot, isSupervisor = false }) => {
    const node = agentsById[agentId];
    const agentConfig = readAgentNodeConfig(items[agentId] || node.item);
    const agentName = rosterById.get(agentId)?.name || node.item?.title || agentConfig.role || agentId;

    onEvent({ type: 'agent_start', runId, agentId, agentName, round, maxRounds });

    const inbox = peerInbox.get(agentId) || [];
    peerInbox.set(agentId, []);

    const downstreamPeers = node.downstreamAgentIds.map(id => rosterById.get(id)).filter(Boolean);
    const prompt = compileAgentPrompt({
      agentId,
      agentItem: node.item,
      agentConfig,
      orchestratorConfig: config,
      items,
      freshAgentOutputs: waveSnapshot || freshAgentOutputs,
      orchestratorInputs,
      promptInputs: node.promptInputs,
      dataInputs: node.dataInputs,
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
      promptInputs: node.promptInputs,
      dataInputs: node.dataInputs,
      orchestratorInputs,
      outputSinks: node.outputSinks,
    });

    try {
      const { answer, raw } = await callAgentWithRetry({
        executeAgent,
        signal,
        payload: {
          operation: 'run',
          message: prompt,
          selected_ids: selectedIds,
          anchor: getAnchor?.(agentId) ?? null,
          include_history: false,
          allow_delete: Boolean(agentConfig.allow_delete),
          options: agentModelOptions(agentConfig),
          api_key: resolveApiKey?.(agentConfig) || '',
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
      for (const directive of parsed.directives) {
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

      if (agentConfig.writeToOutputs !== false) {
        await deliverOutputs({
          sourceId: agentId,
          sourceName: agentName,
          answer,
          cleanAnswer,
          outputSinks: node.outputSinks,
          runId,
          items,
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
      for (const wave of waves) {
        const waveSnapshot = new Map(freshAgentOutputs);
        for (const agentId of wave) {
          if (wave.length && [...(agentsById[agentId]?.upstreamAgentIds || [])].some(up => failedAgents.has(up)) && config.stopOnError) {
            continue;
          }
          await executeAgentTurn({ agentId, round: 1, waveSnapshot });
        }
      }
      converged = true;
    } else if (config.mode === 'collaborative') {
      let nextRoundTargets = new Set(agentIds);
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
        const propagated = new Set(nextTargets);
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
      const workers = agentIds.filter(id => id !== supervisorAgentId);
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
