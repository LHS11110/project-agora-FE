import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentNodeItem,
  createOrchestratorItem,
  readAgentNodeConfig,
  readOrchestratorConfig,
  writeAgentEdgePatch,
} from '../src/canvas/agents/agentCanvasModel.js';
import {
  compileAgentPrompt,
  parseCollaborationDirectives,
} from '../src/canvas/agents/agentPromptBuilder.js';
import {
  runMultiAgentOrchestration,
  runSingleAgent,
} from '../src/canvas/agents/runMultiAgentGraph.js';
import { createMultiAgentStore } from '../src/canvas/agents/multiAgentStore.js';

function edge(from, to, extra = {}) {
  const base = { kind: 'connector', from, to };
  if (extra.channel || extra.delivery || extra.enabled !== undefined || extra.label !== undefined) {
    Object.assign(base, writeAgentEdgePatch(base, extra));
  }
  return base;
}

test('compileAgentPrompt respects edge delivery modes and enforces prompt char budget', () => {
  const agent = createAgentNodeItem({ title: '분석가', role: '분석', systemPrompt: '핵심만 답하세요.' });
  const promptNote = { kind: 'note', text: '항상 한국어로 답하세요.' };
  const hugeData = { kind: 'text', text: 'X'.repeat(12000) };
  const refOnlyData = { kind: 'text', text: 'SHOULD_NOT_BE_INLINED' };

  const compiled = compileAgentPrompt({
    agentId: 'a1',
    agentItem: agent,
    agentConfig: readAgentNodeConfig(agent),
    items: { a1: agent, p1: promptNote, d1: hugeData, d2: refOnlyData },
    promptInputs: [{ sourceId: 'p1', item: promptNote, edgeConfig: { delivery: 'both', enabled: true } }],
    dataInputs: [
      { sourceId: 'd1', item: hugeData, edgeConfig: { delivery: 'both', enabled: true } },
      { sourceId: 'd2', item: refOnlyData, edgeConfig: { delivery: 'reference', enabled: true } },
    ],
    mode: 'single',
    maxChars: 2000,
  });

  assert.ok(compiled.length <= 2000);
  assert.match(compiled, /핵심만 답하세요/);
  assert.match(compiled, /항상 한국어로 답하세요/);
  assert.equal(compiled.includes('SHOULD_NOT_BE_INLINED'), false);
  assert.match(compiled, /d2/);
});

test('parseCollaborationDirectives parses HANDOFF, REVISE, ASK, DELEGATE, BROADCAST, APPROVED, DONE', () => {
  const team = [
    { id: 'a1', name: '기획자', role: '기획' },
    { id: 'a2', name: '구현자', role: '개발' },
    { id: 'a3', name: '리뷰어', role: 'QA' },
  ];
  const raw = [
    '핵심 설계를 완료했습니다.',
    '[HANDOFF: 구현자] API 스키마를 구현해주세요.',
    '[REVISE: a1] 오류 코드 정의를 보완해주세요.',
    '[ASK: QA] 부하 기준이 있나요?',
    '[BROADCAST] 모든 팀원은 UTF-8을 사용하세요.',
    '[APPROVED] [DONE]',
  ].join('\n');

  const parsed = parseCollaborationDirectives(raw, team);
  assert.equal(parsed.approved, true);
  assert.equal(parsed.done, true);
  assert.equal(parsed.directives.length, 4);
  assert.deepEqual(
    parsed.directives.map(d => [d.type, d.toId]),
    [['handoff', 'a2'], ['revise', 'a1'], ['ask', 'a3'], ['broadcast', null]],
  );
  assert.match(parsed.cleanAnswer, /핵심 설계를 완료했습니다/);
  assert.equal(parsed.cleanAnswer.includes('[APPROVED]'), false);
});

test('runSingleAgent retries AGENT_REQUEST_BUSY and writes to connected output, value, and note', async () => {
  const items = {
    promptNote: { kind: 'note', text: '숫자 7을 출력하세요.' },
    a1: createAgentNodeItem({ title: '계산 에이전트', systemPrompt: '입력 지시를 따르세요.' }),
    out: { kind: 'shape', runtimeRole: 'output' },
    val: { kind: 'value', title: 'answer', valueType: 'integer', valueMin: 0, valueMax: 100, valueStep: 1, valueNumber: 0, valueText: '', valueOptions: ['A'] },
    noteOut: { kind: 'note', text: '' },
    e1: edge('promptNote', 'a1', { channel: 'prompt' }),
    e2: edge('a1', 'out'),
    e3: edge('a1', 'val'),
    e4: edge('a1', 'noteOut'),
  };

  let attempts = 0;
  const deliveries = [];
  const res = await runSingleAgent({
    items,
    agentId: 'a1',
    resolveApiKey: () => 'tab-key-123',
    executeAgent: async (payload, onOutput) => {
      if (payload.operation === 'sessions') return { draft: { id: 'sess-1' } };
      attempts++;
      if (attempts === 1) {
        const err = new Error('busy');
        err.code = 'AGENT_REQUEST_BUSY';
        throw err;
      }
      assert.equal(payload.api_key, 'tab-key-123');
      assert.equal(payload.session_id, 'sess-1');
      assert.equal(payload.include_history, false);
      onOutput('계산 중');
      return { answer: '7', session_id: 'sess-1' };
    },
    onDeliver: d => deliveries.push(d),
  });

  assert.equal(attempts, 2);
  assert.equal(res.answer, '7');
  assert.equal(deliveries.some(d => d.type === 'agent' && d.text === '7'), true);
  assert.equal(deliveries.some(d => d.type === 'output' && d.targetId === 'out' && d.record.output.includes('7')), true);
  assert.equal(deliveries.some(d => d.type === 'value' && d.targetId === 'val' && d.valuePatch.valueNumber === 7), true);
  assert.equal(deliveries.some(d => d.type === 'text' && d.targetId === 'noteOut' && d.text === '7'), true);
});

test('runMultiAgentOrchestration runs collaborative feedback rounds and converges on approval', async () => {
  const items = {
    orch: createOrchestratorItem({ mode: 'collaborative', maxRounds: 3, goal: '안전한 파서를 작성하세요.' }),
    dev: createAgentNodeItem({ title: '구현자', systemPrompt: '코드를 작성하세요.', x: 0.3, y: 0.1 }),
    rev: createAgentNodeItem({ title: '리뷰어', engine: 'cli', cli_tool: 'claude', systemPrompt: '검토하세요.', x: 0.5, y: 0.1 }),
    out: { kind: 'shape', runtimeRole: 'output', x: 0.7, y: 0.1 },
    e1: edge('orch', 'dev'),
    e2: edge('dev', 'rev'),
    e3: edge('rev', 'dev', { channel: 'feedback', label: '검토 피드백' }),
    e4: edge('rev', 'out', { channel: 'output' }),
  };

  const calls = [];
  let revCalls = 0;
  const deliveries = [];

  const result = await runMultiAgentOrchestration({
    items,
    orchestratorId: 'orch',
    resolveApiKey: cfg => (cfg.engine === 'cli' ? 'cli-key' : 'api-key'),
    executeAgent: async (payload) => {
      if (payload.operation === 'sessions') return { draft: { id: 'collab-sess' } };
      calls.push(payload);
      if (payload.options.engine === 'cli') {
        revCalls++;
        if (revCalls === 1) {
          return {
            answer: 'Null 검사가 빠졌습니다.\n[REVISE: 구현자] 빈 입력 방어를 추가하세요.',
            session_id: 'collab-sess',
          };
        }
        return {
          answer: '완벽합니다. 모든 검사를 통과했습니다.\n[APPROVED]',
          session_id: 'collab-sess',
        };
      }
      if (payload.message.includes('빈 입력 방어를 추가하세요')) {
        return { answer: '빈 입력 방어를 추가했습니다: if (!s) return "";', session_id: 'collab-sess' };
      }
      return { answer: '초기 파서 구현: return s.trim();', session_id: 'collab-sess' };
    },
    onDeliver: d => deliveries.push(d),
  });

  assert.equal(result.runSummary.roundsCompleted, 2);
  assert.equal(result.runSummary.converged, true);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].api_key, 'api-key');
  assert.equal(calls[1].api_key, 'cli-key');
  assert.match(result.answer, /완벽합니다/);
  assert.equal(deliveries.some(d => d.type === 'orchestrator' && d.runSummary.roundsCompleted === 2), true);
  assert.equal(deliveries.some(d => d.type === 'output' && d.targetId === 'out' && d.record.output.includes('완벽합니다')), true);
});

test('runMultiAgentOrchestration supports supervisor delegation and final synthesis', async () => {
  const items = {
    orch: createOrchestratorItem({ mode: 'supervisor', maxRounds: 2, supervisorAgentId: 'lead', goal: '아키텍처 보고서 작성' }),
    lead: createAgentNodeItem({ title: '팀 리더', x: 0.3, y: 0.2 }),
    researcher: createAgentNodeItem({ title: '리서처', x: 0.5, y: 0.1 }),
    writer: createAgentNodeItem({ title: '작성가', x: 0.5, y: 0.3 }),
    e1: edge('orch', 'lead'),
    e2: edge('lead', 'researcher'),
    e3: edge('lead', 'writer'),
    e4: edge('researcher', 'lead', { channel: 'feedback' }),
    e5: edge('writer', 'lead', { channel: 'feedback' }),
  };

  let leadCalls = 0;
  const order = [];
  const res = await runMultiAgentOrchestration({
    items,
    orchestratorId: 'orch',
    executeAgent: async (payload) => {
      if (payload.operation === 'sessions') return { draft: { id: 'sup-sess' } };
      if (payload.message.includes('이름: 팀 리더')) {
        leadCalls++;
        order.push(`lead-${leadCalls}`);
        if (leadCalls === 1) {
          return { answer: '작업을 나눕니다.\n[DELEGATE: 리서처] 배경 조사를 진행하세요.', session_id: 'sup-sess' };
        }
        return { answer: '최종 보고서를 종합했습니다.\n[DONE]', session_id: 'sup-sess' };
      }
      if (payload.message.includes('이름: 리서처')) {
        order.push('researcher');
        return { answer: '조사 완료: 주요 근거 3건', session_id: 'sup-sess' };
      }
      order.push('writer');
      return { answer: '초안', session_id: 'sup-sess' };
    },
  });

  // Supervisor delegated only to researcher on round 1, then concluded with [DONE] on round 2.
  assert.deepEqual(order, ['lead-1', 'researcher', 'lead-2']);
  assert.equal(res.runSummary.converged, true);
  assert.match(res.answer, /최종 보고서를 종합했습니다/);
});

test('createMultiAgentStore persists node updates, updates activity, and supports stop()', async () => {
  const items = {
    orch: createOrchestratorItem({ mode: 'graph', goal: '단계별 실행' }),
    a1: createAgentNodeItem({ title: '에이전트 1', systemPrompt: '1번 작업' }),
    a2: createAgentNodeItem({ title: '에이전트 2', systemPrompt: '2번 작업' }),
    e1: edge('orch', 'a1'),
    e2: edge('a1', 'a2'),
  };
  let resolveTurn1;
  const store = createMultiAgentStore({
    getItems: () => items,
    executeAgent: async (payload) => {
      if (payload.operation === 'sessions') return { draft: { id: 's1' } };
      return new Promise(resolve => { resolveTurn1 = resolve; });
    },
    saveState: (id, state) => { items[id] = { ...items[id], runtimeState: state }; },
    saveAgentItem: (id, patch) => { items[id] = { ...items[id], ...patch }; },
  });

  const runPromise = store.runOrchestrator('orch');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(store.isRunning(), true);
  assert.equal(store.getNodeState('a1').status, 'running');
  assert.equal(store.getNodeState('a2').status, 'queued');
  assert.equal(store.getActivity().status, 'running');

  store.stop();
  resolveTurn1?.({ answer: '늦은 응답' });
  await runPromise;

  assert.equal(store.isRunning(), false);
  assert.equal(store.getActivity().status, 'error');
  assert.equal(readOrchestratorConfig(items.orch).lastRun.status, 'stopped');
  store.dismissActivity();
  assert.equal(store.getActivity(), null);
});
