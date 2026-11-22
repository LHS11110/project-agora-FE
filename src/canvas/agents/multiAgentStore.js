import {
  isAgentInputItem,
  isAgentNodeItem,
  isAgentOrchestratorItem,
  isAgentOutputItem,
  isAgentRouterItem,
  isAgentRunnableItem,
  readAgentOutputConfig,
  writeAgentInputPatch,
  writeAgentNodePatch,
  writeAgentOutputPatch,
  writeAgentRouterPatch,
  writeOrchestratorPatch,
} from './agentCanvasModel.js';
import { formatTypeLabel } from './agentRouter.js';
import { resolveFlowFromNode, resolveMultiAgentGraph } from './multiAgentGraph.js';
import {
  runFromInputNode,
  runFromRouterNode,
  runMultiAgentOrchestration,
  runSingleAgent,
} from './runMultiAgentGraph.js';

const REMOTE_RUNNING_TTL_MS = 120_000;

export function createMultiAgentStore({
  getItems,
  executeAgent,
  resolveApiKey,
  getAnchor,
  saveOutput,
  saveValue,
  saveState,
  saveAgentItem,
  saveTextOutput,
  onBusyChange,
}) {
  const nodeStates = new Map();
  const nodeListeners = new Map();
  const activityListeners = new Set();
  const outputHistory = new Map();

  let activeRun = null;
  let activity = null;
  let disposed = false;

  const emitActivity = (next) => {
    activity = next;
    for (const listener of activityListeners) listener();
  };

  const emitNode = (id, state, { persist = true } = {}) => {
    const key = String(id);
    nodeStates.set(key, state);
    const targetItem = getItems()[key];
    // Never write runtimeState to runtimeRole: 'output' items (rejected by BE schema).
    if (persist && saveState && !disposed && (!targetItem || isAgentRunnableItem(targetItem))) {
      const status = ['running', 'queued', 'success', 'error', 'skipped'].includes(state?.status)
        ? state.status
        : state?.running ? 'running' : 'success';
      saveState(key, {
        running: Boolean(state?.running),
        status,
        phase: 'agent',
        completed: Boolean(state?.completed),
        failed: Boolean(state?.failed),
        ...(state?.runId ? { runId: String(state.runId) } : {}),
        ...(state?.detail ? { detail: String(state.detail).slice(-4000) } : {}),
        ...(state?.error ? { error: String(state.error).slice(-1000) } : {}),
      });
    }
    nodeListeners.get(key)?.forEach(listener => listener());
  };

  const isRemoteActive = (item) => {
    const remote = item?.runtimeState;
    return Boolean(remote?.running && Number.isFinite(remote.updatedAt) && Date.now() - remote.updatedAt < REMOTE_RUNNING_TTL_MS);
  };

  const deliverHandler = () => async (delivery) => {
    if (disposed) return;
    const currentItems = getItems();
    const targetItem = currentItems[delivery.targetId];
    if (!targetItem) return;

    if (delivery.type === 'agent' && isAgentNodeItem(targetItem)) {
      const patch = writeAgentNodePatch(targetItem, {
        text: delivery.text,
        lastMeta: delivery.meta,
      });
      if (patch) saveAgentItem?.(delivery.targetId, patch);
      return;
    }

    if (delivery.type === 'orchestrator' && isAgentOrchestratorItem(targetItem)) {
      const patch = writeOrchestratorPatch(targetItem, {
        ...(delivery.text ? { text: delivery.text } : {}),
        lastRun: delivery.runSummary,
      });
      if (patch) saveAgentItem?.(delivery.targetId, patch);
      return;
    }

    if (delivery.type === 'router' && isAgentRouterItem(targetItem)) {
      const patch = writeAgentRouterPatch(targetItem, {
        lastDecision: delivery.decision,
      });
      if (patch) saveAgentItem?.(delivery.targetId, patch);
      return;
    }

    if (delivery.type === 'agent_input' && isAgentInputItem(targetItem)) {
      const patch = writeAgentInputPatch(targetItem, {
        lastSubmittedAt: delivery.updatedAt || Date.now(),
      });
      if (patch) saveAgentItem?.(delivery.targetId, patch);
      return;
    }

    // Verify the connector still exists before writing to downstream output/canvas objects.
    const stillConnected = Object.values(currentItems).some(
      edge => edge?.kind === 'connector'
        && String(edge.from) === String(delivery.sourceId)
        && String(edge.to) === String(delivery.targetId),
    );
    if (!stillConnected) return;

    if (delivery.type === 'agent_output' && isAgentOutputItem(targetItem)) {
      const cfg = readAgentOutputConfig(targetItem);
      const prev = outputHistory.get(delivery.targetId) || targetItem.runtimeResults || [];
      const records = cfg.appendHistory !== false ? [...prev, delivery.record] : [delivery.record];
      while (records.length > 32 || new TextEncoder().encode(JSON.stringify(records)).length > 524288) {
        records.shift();
      }
      outputHistory.set(delivery.targetId, records);
      const patch = writeAgentOutputPatch(targetItem, {
        text: delivery.text,
        lastMeta: delivery.meta,
        runtimeResults: records,
      });
      if (saveAgentItem && patch) {
        saveAgentItem(delivery.targetId, patch);
      } else {
        saveOutput?.(delivery.targetId, records);
      }
      return;
    }

    if (delivery.type === 'value') {
      saveValue?.(delivery.targetId, delivery.valuePatch);
    } else if (delivery.type === 'text') {
      saveTextOutput?.(delivery.targetId, delivery.text);
    } else if (delivery.type === 'output' && targetItem.runtimeRole === 'output') {
      const prev = outputHistory.get(delivery.targetId) || targetItem.runtimeResults || [];
      const records = [...prev, delivery.record];
      while (records.length > 32 || new TextEncoder().encode(JSON.stringify(records)).length > 524288) {
        records.shift();
      }
      outputHistory.set(delivery.targetId, records);
      saveOutput?.(delivery.targetId, records);
    }
  };

  const finishRun = () => {
    activeRun = null;
    onBusyChange?.(false);
  };

  const handleFlowEvent = ({ rootId, trackedRunnables, isMultiStep = true }) => (event) => {
    if (event.type === 'input_ready') {
      emitNode(event.inputId, { running: false, status: 'success', completed: true, updatedAt: Date.now() });
    } else if (event.type === 'router_start') {
      emitNode(event.routerId, {
        running: true,
        status: 'running',
        phase: 'agent',
        detail: '라우팅 판단 중…',
        runId: event.runId,
        updatedAt: Date.now(),
      });
      if (isMultiStep) {
        emitActivity({
          ...activity,
          currentAgentId: event.routerId,
          currentAgentName: event.routerName,
          progress: `${event.routerName} 라우팅 분석 중…`,
          entries: [
            ...(activity?.entries || []),
            { agentId: event.routerId, agentName: event.routerName, round: event.round || 1, status: 'running' },
          ],
        });
      }
    } else if (event.type === 'router_progress') {
      const prev = nodeStates.get(event.routerId) || {};
      emitNode(event.routerId, { ...prev, detail: event.progress, updatedAt: Date.now() }, { persist: false });
      emitActivity({ ...activity, progress: event.progress });
    } else if (event.type === 'router_decision') {
      const d = event.decision;
      const summary = `${(d?.selectedTargetNames || []).join(', ') || '대상 없음'} (${(d?.detectedFormats || []).map(formatTypeLabel).join(', ')})`;
      emitNode(event.routerId, {
        running: false,
        status: d?.selectedTargetIds?.length ? 'success' : 'skipped',
        completed: Boolean(d?.selectedTargetIds?.length),
        detail: d?.reason || summary,
        runId: event.runId,
        updatedAt: Date.now(),
      });
      if (isMultiStep) {
        emitActivity({
          ...activity,
          entries: (activity?.entries || []).map((entry, idx, arr) =>
            idx === arr.length - 1 && entry.agentId === event.routerId && entry.status === 'running'
              ? { ...entry, status: d?.selectedTargetIds?.length ? 'success' : 'skipped', summary }
              : entry,
          ),
        });
      }
    } else if (event.type === 'agent_skipped' || event.type === 'router_skipped') {
      emitNode(event.agentId || event.routerId, {
        running: false,
        status: 'skipped',
        completed: false,
        failed: false,
        detail: event.reason || '건너뜀',
        runId: event.runId,
        updatedAt: Date.now(),
      });
    } else if (event.type === 'agent_start') {
      emitNode(event.agentId, {
        running: true,
        status: 'running',
        phase: 'agent',
        round: event.round,
        detail: `라운드 ${event.round}/${event.maxRounds} 실행 중`,
        runId: event.runId,
        updatedAt: Date.now(),
      });
      if (rootId && rootId !== event.agentId) {
        emitNode(rootId, {
          running: true,
          status: 'running',
          phase: 'agent',
          round: event.round,
          detail: `${event.agentName} (R${event.round}/${event.maxRounds})`,
          runId: event.runId,
          updatedAt: Date.now(),
        }, { persist: false });
      }
      emitActivity({
        ...activity,
        currentAgentId: event.agentId,
        currentAgentName: event.agentName,
        round: event.round,
        maxRounds: event.maxRounds,
        progress: `${event.agentName} 작업 시작…`,
        entries: [
          ...(activity?.entries || []),
          { agentId: event.agentId, agentName: event.agentName, round: event.round, status: 'running' },
        ],
      });
    } else if (event.type === 'agent_progress') {
      const prev = nodeStates.get(event.agentId) || {};
      emitNode(event.agentId, { ...prev, running: true, status: 'running', detail: event.progress, updatedAt: Date.now() }, { persist: false });
      emitActivity({ ...activity, progress: event.progress });
    } else if (event.type === 'agent_complete') {
      emitNode(event.agentId, {
        running: false,
        status: 'success',
        completed: true,
        failed: false,
        round: event.round,
        runId: event.runId,
        updatedAt: Date.now(),
      });
      emitActivity({
        ...activity,
        entries: (activity?.entries || []).map((entry, idx, arr) =>
          idx === arr.length - 1 && entry.agentId === event.agentId && entry.status === 'running'
            ? { ...entry, status: 'success', summary: event.summary, directives: event.directives, approved: event.approved, done: event.done }
            : entry,
        ),
      });
    } else if (event.type === 'agent_error') {
      emitNode(event.agentId, {
        running: false,
        status: 'error',
        failed: true,
        round: event.round,
        error: event.error,
        runId: event.runId,
        updatedAt: Date.now(),
      });
      emitActivity({
        ...activity,
        entries: (activity?.entries || []).map((entry, idx, arr) =>
          idx === arr.length - 1 && entry.agentId === event.agentId && entry.status === 'running'
            ? { ...entry, status: 'error', summary: event.error }
            : entry,
        ),
      });
    } else if (event.type === 'complete') {
      for (const nid of trackedRunnables || []) {
        const st = nodeStates.get(nid);
        if (st?.status === 'queued') {
          emitNode(nid, { running: false, status: 'skipped', updatedAt: Date.now() });
        }
      }
      const failed = event.status !== 'success';
      if (rootId) {
        emitNode(rootId, {
          running: false,
          status: failed ? 'error' : 'success',
          completed: !failed,
          failed,
          ...(event.error ? { error: event.error } : {}),
          runId: event.runId,
          updatedAt: Date.now(),
        });
      }
      emitActivity({
        ...activity,
        status: failed ? 'error' : 'success',
        endedAt: Date.now(),
        converged: event.converged,
        roundsCompleted: event.roundsCompleted,
        ...(event.error ? { error: event.error } : {}),
      });
    }
  };

  return {
    isRunning: () => Boolean(activeRun),
    getActivity: () => activity,
    dismissActivity() {
      if (!activeRun) emitActivity(null);
    },
    subscribeActivity(listener) {
      activityListeners.add(listener);
      return () => activityListeners.delete(listener);
    },
    getNodeState(id) {
      const key = String(id);
      const local = nodeStates.get(key);
      const remote = getItems()[key]?.runtimeState || null;
      if (!local) return remote;
      if (remote && !local.running && (remote.updatedAt || 0) > (local.updatedAt || 0)) return remote;
      return local;
    },
    subscribeNode(id, listener) {
      const key = String(id);
      if (!nodeListeners.has(key)) nodeListeners.set(key, new Set());
      nodeListeners.get(key).add(listener);
      return () => {
        nodeListeners.get(key)?.delete(listener);
        if (!nodeListeners.get(key)?.size) nodeListeners.delete(key);
      };
    },
    stop() {
      if (!activeRun) return;
      activeRun.controller.abort();
      for (const id of activeRun.nodeIds) {
        const current = nodeStates.get(id);
        if (current?.running || current?.status === 'queued') {
          emitNode(id, {
            ...current,
            running: false,
            status: 'error',
            failed: true,
            error: '사용자가 작업을 중지했습니다.',
            updatedAt: Date.now(),
          });
        }
      }
      if (activity && activity.status === 'running') {
        emitActivity({
          ...activity,
          status: 'error',
          error: '사용자가 작업을 중지했습니다.',
          endedAt: Date.now(),
        });
      }
    },
    dispose() {
      disposed = true;
      activeRun?.controller.abort();
      finishRun();
    },
    resume() {
      disposed = false;
    },
    async runAgent(agentId) {
      const id = String(agentId);
      const items = getItems();
      const item = items[id];
      if (activeRun || disposed || !isAgentNodeItem(item) || isRemoteActive(item)) return null;

      const controller = new AbortController();
      const startedAt = Date.now();
      activeRun = { rootId: id, controller, nodeIds: [id] };
      onBusyChange?.(true);
      emitNode(id, { running: true, status: 'running', phase: 'agent', detail: '준비 중…', updatedAt: startedAt });
      emitActivity({
        id,
        kind: 'single',
        title: item.title || 'AI 에이전트',
        status: 'running',
        startedAt,
        currentAgentId: id,
        currentAgentName: item.title || 'AI 에이전트',
        round: 1,
        maxRounds: 1,
        entries: [],
      });

      try {
        return await runSingleAgent({
          items,
          agentId: id,
          executeAgent,
          resolveApiKey,
          getAnchor,
          signal: controller.signal,
          onDeliver: deliverHandler(),
          onEvent: handleFlowEvent({ rootId: id, trackedRunnables: [id], isMultiStep: false }),
        });
      } catch (error) {
        const msg = error?.message || '에이전트 실행에 실패했습니다.';
        emitNode(id, { running: false, status: 'error', failed: true, error: msg, updatedAt: Date.now() });
        emitActivity({ ...activity, status: 'error', error: msg, endedAt: Date.now() });
        return null;
      } finally {
        finishRun();
      }
    },
    async runOrchestrator(orchestratorId) {
      const rootId = String(orchestratorId);
      const items = getItems();
      const rootItem = items[rootId];
      if (activeRun || disposed || !isAgentOrchestratorItem(rootItem) || isRemoteActive(rootItem)) return null;

      let resolved;
      try {
        resolved = resolveMultiAgentGraph(items, rootId);
      } catch (error) {
        emitNode(rootId, { running: false, status: 'error', failed: true, error: error.message, updatedAt: Date.now() });
        emitActivity({
          id: rootId,
          kind: 'orchestrator',
          title: rootItem.title || '멀티 에이전트 오케스트레이터',
          status: 'error',
          startedAt: Date.now(),
          endedAt: Date.now(),
          error: error.message,
          entries: [],
        });
        return null;
      }

      const controller = new AbortController();
      const startedAt = Date.now();
      const trackedRunnables = [...(resolved.routerIds || []), ...resolved.agentIds];
      const trackedIds = [rootId, ...(resolved.incomingInputIds || []), ...(resolved.inputIds || []), ...trackedRunnables];
      activeRun = { rootId, controller, nodeIds: trackedIds };
      onBusyChange?.(true);

      emitNode(rootId, { running: true, status: 'running', phase: 'agent', detail: `${resolved.agentIds.length}개 에이전트 시작`, updatedAt: startedAt });
      for (const nid of trackedRunnables) {
        emitNode(nid, { running: false, status: 'queued', phase: 'agent', updatedAt: startedAt });
      }
      emitActivity({
        id: rootId,
        kind: 'orchestrator',
        mode: resolved.config.mode,
        title: rootItem.title || '멀티 에이전트 오케스트레이터',
        status: 'running',
        startedAt,
        round: 1,
        maxRounds: resolved.config.mode === 'graph' ? 1 : resolved.config.maxRounds,
        entries: [],
      });

      try {
        return await runMultiAgentOrchestration({
          items,
          orchestratorId: rootId,
          executeAgent,
          resolveApiKey,
          getAnchor,
          signal: controller.signal,
          onDeliver: deliverHandler(),
          onEvent: handleFlowEvent({ rootId, trackedRunnables, isMultiStep: true }),
        });
      } catch (error) {
        const msg = error?.message || '멀티 에이전트 실행에 실패했습니다.';
        for (const nid of trackedRunnables) {
          const st = nodeStates.get(nid);
          if (st?.status === 'queued' || st?.running) {
            emitNode(nid, {
              running: false,
              status: st?.running ? 'error' : 'skipped',
              failed: Boolean(st?.running),
              ...(st?.running ? { error: msg } : {}),
              updatedAt: Date.now(),
            });
          }
        }
        emitNode(rootId, { running: false, status: 'error', failed: true, error: msg, updatedAt: Date.now() });
        emitActivity({ ...activity, status: 'error', error: msg, endedAt: Date.now() });
        return null;
      } finally {
        finishRun();
      }
    },
    async runInput(inputId) {
      const id = String(inputId);
      const items = getItems();
      const item = items[id];
      if (activeRun || disposed || !isAgentInputItem(item) || isRemoteActive(item)) return null;

      let flow;
      try {
        flow = resolveFlowFromNode(items, id);
      } catch (error) {
        emitNode(id, { running: false, status: 'error', failed: true, error: error.message, updatedAt: Date.now() });
        return null;
      }

      if (flow.orchestratorIds.length) {
        return this.runOrchestrator(flow.orchestratorIds[0]);
      }

      const controller = new AbortController();
      const startedAt = Date.now();
      const trackedRunnables = [...flow.routerIds, ...flow.agentIds];
      activeRun = { rootId: id, controller, nodeIds: [id, ...trackedRunnables] };
      onBusyChange?.(true);

      emitNode(id, { running: true, status: 'running', phase: 'agent', detail: '입력 전송 중…', updatedAt: startedAt });
      for (const nid of trackedRunnables) {
        emitNode(nid, { running: false, status: 'queued', phase: 'agent', updatedAt: startedAt });
      }
      emitActivity({
        id,
        kind: 'input',
        title: item.title || '입력 객체',
        status: 'running',
        startedAt,
        round: 1,
        maxRounds: 1,
        entries: [],
      });

      try {
        return await runFromInputNode({
          items,
          inputId: id,
          executeAgent,
          resolveApiKey,
          getAnchor,
          signal: controller.signal,
          onDeliver: deliverHandler(),
          onEvent: handleFlowEvent({ rootId: id, trackedRunnables, isMultiStep: true }),
        });
      } catch (error) {
        const msg = error?.message || '입력 객체 실행에 실패했습니다.';
        for (const nid of trackedRunnables) {
          const st = nodeStates.get(nid);
          if (st?.status === 'queued' || st?.running) {
            emitNode(nid, {
              running: false,
              status: st?.running ? 'error' : 'skipped',
              failed: Boolean(st?.running),
              ...(st?.running ? { error: msg } : {}),
              updatedAt: Date.now(),
            });
          }
        }
        emitNode(id, { running: false, status: 'error', failed: true, error: msg, updatedAt: Date.now() });
        emitActivity({ ...activity, status: 'error', error: msg, endedAt: Date.now() });
        return null;
      } finally {
        finishRun();
      }
    },
    async runRouter(routerId) {
      const id = String(routerId);
      const items = getItems();
      const item = items[id];
      if (activeRun || disposed || !isAgentRouterItem(item) || isRemoteActive(item)) return null;

      let flow;
      try {
        flow = resolveFlowFromNode(items, id);
      } catch (error) {
        emitNode(id, { running: false, status: 'error', failed: true, error: error.message, updatedAt: Date.now() });
        return null;
      }

      const controller = new AbortController();
      const startedAt = Date.now();
      const trackedRunnables = [...flow.routerIds.filter(rid => rid !== id), ...flow.agentIds];
      activeRun = { rootId: id, controller, nodeIds: [id, ...trackedRunnables] };
      onBusyChange?.(true);

      emitNode(id, { running: true, status: 'running', phase: 'agent', detail: '라우팅 분석 중…', updatedAt: startedAt });
      for (const nid of trackedRunnables) {
        emitNode(nid, { running: false, status: 'queued', phase: 'agent', updatedAt: startedAt });
      }
      emitActivity({
        id,
        kind: 'router',
        title: item.title || '라우터 객체',
        status: 'running',
        startedAt,
        round: 1,
        maxRounds: 1,
        entries: [],
      });

      try {
        return await runFromRouterNode({
          items,
          routerId: id,
          executeAgent,
          resolveApiKey,
          getAnchor,
          signal: controller.signal,
          onDeliver: deliverHandler(),
          onEvent: handleFlowEvent({ rootId: id, trackedRunnables, isMultiStep: true }),
        });
      } catch (error) {
        const msg = error?.message || '라우터 실행에 실패했습니다.';
        for (const nid of trackedRunnables) {
          const st = nodeStates.get(nid);
          if (st?.status === 'queued' || st?.running) {
            emitNode(nid, {
              running: false,
              status: st?.running ? 'error' : 'skipped',
              failed: Boolean(st?.running),
              ...(st?.running ? { error: msg } : {}),
              updatedAt: Date.now(),
            });
          }
        }
        emitNode(id, { running: false, status: 'error', failed: true, error: msg, updatedAt: Date.now() });
        emitActivity({ ...activity, status: 'error', error: msg, endedAt: Date.now() });
        return null;
      } finally {
        finishRun();
      }
    },
  };
}
