import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMultiAgentTemplate,
  createAgentInputItem,
  createAgentNodeItem,
  createAgentOutputItem,
  createAgentRouterItem,
  createOrchestratorItem,
  readAgentNodeConfig,
  readAgentOutputConfig,
  readAgentRouterConfig,
  readOrchestratorConfig,
  writeAgentEdgePatch,
  writeAgentInputPatch,
} from '../src/canvas/agents/agentCanvasModel.js';
import {
  compileAgentPrompt,
  parseCollaborationDirectives,
} from '../src/canvas/agents/agentPromptBuilder.js';
import {
  runFromInputNode,
  runFromRouterNode,
  runMultiAgentOrchestration,
  runSingleAgent,
} from '../src/canvas/agents/runMultiAgentGraph.js';
import { createMultiAgentStore } from '../src/canvas/agents/multiAgentStore.js';

function edge(from, to, extra = {}) {
  const base = { kind: 'connector', from, to };
  if (
    extra.channel ||
    extra.delivery ||
    extra.enabled !== undefined ||
    extra.label !== undefined ||
    extra.routeFormats !== undefined ||
    extra.routeKeywords !== undefined ||
    extra.routeDescription !== undefined ||
    extra.routeDefault !== undefined ||
    extra.routePriority !== undefined
  ) {
    Object.assign(base, writeAgentEdgePatch(base, extra));
  }
  return base;
}

test('canvas mock template routes input, skips the other branch and persists output through the store', async () => {
  let nextId = 0;
  let externalCalls = 0;
  let { changes: items } = buildMultiAgentTemplate(
    'mock-routing', 'orch', createOrchestratorItem(), 'default', () => `node-${++nextId}`,
  );
  const idFor = title => Object.keys(items).find(id => items[id].title === title);
  const store = createMultiAgentStore({
    getItems: () => items,
    executeAgent: async () => { externalCalls++; throw new Error('Unexpected model call'); },
    saveAgentItem: (id, patch) => { items = { ...items, [id]: { ...items[id], ...patch } }; },
  });
  const result = await store.runInput(idFor('테스트 입력'));
  assert.equal(result?.answer, '텍스트 경로 실행 완료');
  assert.equal(items[idFor('테스트 출력')].text, '텍스트 경로 실행 완료');
  assert.deepEqual(readAgentRouterConfig(items[idFor('테스트 라우터')]).lastDecision.selectedTargetIds, [idFor('텍스트 모형')]);
  assert.equal(store.getNodeState(idFor('이미지 모형')).status, 'skipped');
  const inputId = idFor('테스트 입력');
  items[inputId] = { ...items[inputId], ...writeAgentInputPatch(items[inputId], { inputType: 'image' }) };
  const imageResult = await store.runRouter(idFor('테스트 라우터'));
  assert.equal(imageResult?.answer, '이미지 경로 실행 완료');
  assert.equal(items[idFor('테스트 출력')].runtimeResults.length, 2);
  assert.equal(store.getNodeState(idFor('텍스트 모형')).status, 'skipped');
  assert.equal(externalCalls, 0);
});

test('mock agents reject mixed teams before any session or credential request', async () => {
  let externalCalls = 0;
  const items = {
    orch: createOrchestratorItem(),
    mock: createAgentNodeItem({ engine: 'mock' }),
    real: createAgentNodeItem(),
    first: edge('orch', 'mock'),
    second: edge('mock', 'real'),
  };
  await assert.rejects(runMultiAgentOrchestration({
    items,
    orchestratorId: 'orch',
    executeAgent: async () => { externalCalls++; },
  }), /모형 에이전트만/);
  assert.equal(externalCalls, 0);
});

test('an unselected router does not start its branch in either graph entry point', async () => {
  const items = {
    input: createAgentInputItem({ text: 'Sample text' }),
    root: createAgentRouterItem({ routingMode: 'format', fallbackPolicy: 'skip' }),
    unselected: createAgentRouterItem({ routingMode: 'format', fallbackPolicy: 'first' }),
    picked: createAgentNodeItem({ engine: 'mock', mockResponse: 'selected' }),
    other: createAgentNodeItem({ engine: 'mock', mockResponse: 'unselected' }),
    first: edge('input', 'root'),
    selected: edge('root', 'picked', { channel: 'route', routeFormats: ['text'] }),
    ignored: edge('root', 'unselected', { channel: 'route', routeFormats: ['image'] }),
    downstream: edge('unselected', 'other', { channel: 'route', routeFormats: ['image'] }),
  };
  for (const withOrchestrator of [false, true]) {
    const events = [];
    const scenario = withOrchestrator
      ? { ...items, orch: createOrchestratorItem({ mode: 'graph' }), first: edge('input', 'orch'), entry: edge('orch', 'root') }
      : items;
    await runFromInputNode({ items: scenario, inputId: 'input', onEvent: event => events.push(event) });
    assert.deepEqual(events.filter(event => event.type === 'router_start').map(event => event.routerId), ['root']);
    assert.deepEqual(events.filter(event => event.type === 'agent_start').map(event => event.agentId), ['picked']);

    const imageEvents = [];
    const imageItems = {
      ...scenario,
      input: createAgentInputItem({ text: 'Sample image', inputType: 'image' }),
      unselected: createAgentRouterItem({ routingMode: 'format', fallbackPolicy: 'skip' }),
    };
    await runFromInputNode({ items: imageItems, inputId: 'input', onEvent: event => imageEvents.push(event) });
    assert.deepEqual(imageEvents.filter(event => event.type === 'router_start').map(event => event.routerId), ['root', 'unselected']);
    assert.deepEqual(imageEvents.filter(event => event.type === 'agent_start').map(event => event.agentId), ['other']);
  }
});

test('local mock responses drive collaborative revisions and supervisor delegation', async () => {
  const mock = (title, mockResponse, mockFollowup) => createAgentNodeItem({ title, engine: 'mock', mockResponse, mockFollowup });
  const collab = {
    orch: createOrchestratorItem({ mode: 'collaborative', maxRounds: 3 }),
    dev: mock('Developer', 'First draft', 'Revised draft'),
    rev: mock('Reviewer', 'Needs changes\n[REVISE: dev] Please revise', 'Approved revision\n[APPROVED]'),
    e1: edge('orch', 'dev'),
    e2: edge('dev', 'rev'),
    e3: edge('rev', 'dev', { channel: 'feedback' }),
  };
  const supervisor = {
    orch: createOrchestratorItem({ mode: 'supervisor', maxRounds: 2, supervisorAgentId: 'lead' }),
    lead: mock('Lead', 'Assign work\n[DELEGATE: worker] Draft the report', 'Final report\n[DONE]'),
    worker: mock('Worker', 'Worker report'),
    other: mock('Other', 'Unexpected response'),
    e1: edge('orch', 'lead'),
    e2: edge('lead', 'worker'),
    e3: edge('lead', 'other'),
  };
  let externalCalls = 0;
  const run = items => runMultiAgentOrchestration({
    items, orchestratorId: 'orch',
    executeAgent: async () => { externalCalls++; throw new Error('Unexpected model call'); },
  });
  const revised = await run(collab);
  assert.deepEqual(revised.runSummary.log.map(entry => [entry.agentId, entry.round]), [['dev', 1], ['rev', 1], ['dev', 2], ['rev', 2]]);
  assert.equal(revised.answer, 'Approved revision');
  assert.equal(revised.runSummary.converged, true);
  const delegated = await run(supervisor);
  assert.deepEqual(delegated.runSummary.log.map(entry => entry.agentId), ['lead', 'worker', 'lead']);
  assert.equal(delegated.answer, 'Final report');
  assert.equal(externalCalls, 0);
});

test('mock collaboration respects delegation and early-stop settings', async () => {
  const items = {
    orch: createOrchestratorItem({ mode: 'collaborative', maxRounds: 3, consensusStop: false }),
    a: createAgentNodeItem({ engine: 'mock', canDelegate: false, mockResponse: 'Draft\n[ASK: b] Request' }),
    b: createAgentNodeItem({ engine: 'mock', mockResponse: 'Approved\n[APPROVED]' }),
    e1: edge('orch', 'a'),
    e2: edge('a', 'b'),
  };
  const result = await runMultiAgentOrchestration({ items, orchestratorId: 'orch' });
  assert.equal(result.runSummary.roundsCompleted, 3);
  assert.equal(result.runSummary.log.length, 6);
  assert.ok(result.runSummary.log.every(entry => entry.directives.length === 0));
});

test('an intelligent router in a mock flow applies its configured fallback locally', async () => {
  const items = {
    router: createAgentRouterItem({ routingMode: 'intelligent', fallbackPolicy: 'first' }),
    mock: createAgentNodeItem({ engine: 'mock', mockResponse: 'Fallback result' }),
    e: edge('router', 'mock'),
  };
  let externalCalls = 0;
  const events = [];
  const result = await runFromRouterNode({
    items, routerId: 'router',
    executeAgent: async () => { externalCalls++; },
    onEvent: event => events.push(event),
  });
  const decision = events.find(event => event.type === 'router_decision').decision;
  assert.equal(decision.fallbackUsed, true);
  assert.deepEqual(decision.selectedTargetIds, ['mock']);
  assert.equal(result.answer, 'Fallback result');
  assert.equal(externalCalls, 0);
});

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
    executeAgent: async (payload, onOutput) => {
      if (payload.operation === 'sessions') return { draft: { id: 'sess-1' } };
      attempts++;
      if (attempts === 1) {
        const err = new Error('busy');
        err.code = 'AGENT_REQUEST_BUSY';
        throw err;
      }
      assert.equal(payload.api_key, undefined);
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
    rev: createAgentNodeItem({ title: '리뷰어', systemPrompt: '검토하세요.', x: 0.5, y: 0.1 }),
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
    executeAgent: async (payload) => {
      if (payload.operation === 'sessions') return { draft: { id: 'collab-sess' } };
      calls.push(payload);
      if (payload.message.includes('객체 ID: rev')) {
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
  assert.equal(calls[0].api_key, undefined);
  assert.equal(calls[1].api_key, undefined);
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

test('runMultiAgentOrchestration branches through Input -> Orchestrator -> Router -> Agents -> AgentOutput and skips unselected targets', async () => {
  const items = {
    input: createAgentInputItem({
      title: '입력',
      inputType: 'auto',
      text: '이 PDF 계약서 핵심만 정리해줘',
      attachments: [{ id: 'att-pdf', name: 'contract.pdf', mimeType: 'application/pdf', formatType: 'pdf' }],
      x: 0.1,
      y: 0.2,
    }),
    orch: createOrchestratorItem({ mode: 'graph', x: 0.25, y: 0.2 }),
    router: createAgentRouterItem({ title: '포맷 분기', routingMode: 'format', x: 0.4, y: 0.2 }),
    imgAgent: createAgentNodeItem({ title: '이미지 분석가', x: 0.6, y: 0.1 }),
    pdfAgent: createAgentNodeItem({ title: 'PDF 분석가', x: 0.6, y: 0.25 }),
    audAgent: createAgentNodeItem({ title: '오디오 분석가', x: 0.6, y: 0.4 }),
    output: createAgentOutputItem({ title: '최종 출력', x: 0.85, y: 0.25 }),
    cIn: edge('input', 'orch', { channel: 'input' }),
    cOrch: edge('orch', 'router'),
    cImg: edge('router', 'imgAgent', { channel: 'route', routeFormats: ['image'] }),
    cPdf: edge('router', 'pdfAgent', { channel: 'route', routeFormats: ['pdf'] }),
    cAud: edge('router', 'audAgent', { channel: 'route', routeFormats: ['audio'] }),
    cOut1: edge('imgAgent', 'output', { channel: 'output' }),
    cOut2: edge('pdfAgent', 'output', { channel: 'output' }),
    cOut3: edge('audAgent', 'output', { channel: 'output' }),
  };

  const calledAgents = [];
  const events = [];
  const deliveries = [];

  await runMultiAgentOrchestration({
    items,
    orchestratorId: 'orch',
    executeAgent: async payload => {
      if (payload.operation === 'run') {
        calledAgents.push(payload.message);
        return { answer: '계약서 핵심: 납기 30일, 위약금 없음' };
      }
      return {};
    },
    onEvent: ev => events.push(ev),
    onDeliver: d => deliveries.push(d),
  });

  assert.equal(calledAgents.length, 1);
  assert.match(calledAgents[0], /contract\.pdf/);

  const skippedIds = events
    .filter(e => e.type === 'agent_skipped')
    .map(e => e.agentId)
    .sort();
  assert.deepEqual(skippedIds, ['audAgent', 'imgAgent']);

  const routerDelivery = deliveries.find(d => d.type === 'router');
  assert.ok(routerDelivery);
  assert.deepEqual(routerDelivery.decision.selectedTargetIds, ['pdfAgent']);

  const outDelivery = deliveries.find(d => d.type === 'agent_output');
  assert.ok(outDelivery);
  assert.equal(outDelivery.targetId, 'output');
  assert.match(outDelivery.text, /계약서 핵심/);
  assert.equal(outDelivery.meta.sourceName, 'PDF 분석가');

  // Verify direct execution from Input node and Router node as well.
  let routerRan = 0;
  await runFromInputNode({
    items,
    inputId: 'input',
    executeAgent: async payload => {
      if (payload.operation === 'run') routerRan += 1;
      return { answer: '입력 시작 실행 응답' };
    },
    onDeliver: () => {},
  });
  assert.equal(routerRan, 1);

  let fromRouterCalls = 0;
  await runFromRouterNode({
    items,
    routerId: 'router',
    executeAgent: async payload => {
      if (payload.operation === 'run') fromRouterCalls += 1;
      return { answer: '라우터 시작 실행 응답' };
    },
    onDeliver: () => {},
  });
  assert.equal(fromRouterCalls, 1);
});

test('createMultiAgentStore runInput and runRouter persist runtimeResults on AgentOutput without writing runtimeState on output role', async () => {
  const items = {
    input: createAgentInputItem({ title: '입력', inputType: 'text', text: '최신 AI 트렌드 요약', x: 0.1, y: 0.2 }),
    router: createAgentRouterItem({ title: '지능형 라우터', routingMode: 'intelligent', x: 0.3, y: 0.2 }),
    writer: createAgentNodeItem({ title: '작성 에이전트', role: 'writer', x: 0.55, y: 0.15 }),
    reviewer: createAgentNodeItem({ title: '검토 에이전트', role: 'reviewer', x: 0.55, y: 0.35 }),
    output: createAgentOutputItem({ title: '결과 카드', x: 0.8, y: 0.2 }),
    c1: edge('input', 'router', { channel: 'input' }),
    c2: edge('router', 'writer', { channel: 'route', routeFormats: ['text'] }),
    c3: edge('router', 'reviewer', { channel: 'route', routeFormats: ['code'] }),
    c4: edge('writer', 'output', { channel: 'output' }),
    c5: edge('reviewer', 'output', { channel: 'output' }),
  };

  const stateWrites = [];
  const store = createMultiAgentStore({
    getItems: () => items,
    patchItem: (id, patch) => {
      items[id] = { ...items[id], ...patch };
    },
    saveAgentItem: async (id, patch) => {
      items[id] = { ...items[id], ...patch };
    },
    saveState: async (id, state) => {
      stateWrites.push({ id, role: items[id]?.runtimeRole, status: state.status });
    },
    executeAgent: async payload => {
      if (payload.operation !== 'run') return {};
      if (payload.message.includes('[라우터 지시사항]')) {
        return { answer: '{"targets":["writer"],"reason":"텍스트 요약 작업"}' };
      }
      return { answer: 'AI 에이전트 오케스트레이션 최종 요약' };
    },
  });

  await store.runInput('input');
  assert.equal(store.isRunning(), false);
  assert.equal(stateWrites.some(w => w.id === 'output'), false);
  assert.equal(readAgentRouterConfig(items.router).lastDecision.modeUsed, 'intelligent');
  assert.deepEqual(readAgentRouterConfig(items.router).lastDecision.selectedTargetIds, ['writer']);
  assert.equal(items.output.text, 'AI 에이전트 오케스트레이션 최종 요약');
  assert.equal(items.output.runtimeResults.length, 1);
  assert.equal(readAgentOutputConfig(items.output).lastMeta.sourceId, 'writer');

  await store.runRouter('router');
  assert.equal(items.output.runtimeResults.length, 2);
});

test('runMultiAgentOrchestration routes JSON input payloads through JSON rule router end-to-end', async () => {
  const items = {
    input: createAgentInputItem({
      title: '주문 JSON 입력',
      inputType: 'auto',
      text: '{"type":"billing","invoiceId":"INV-900","priority":3}',
      x: 0.1,
      y: 0.2,
    }),
    orch: createOrchestratorItem({ mode: 'graph', x: 0.25, y: 0.2 }),
    router: createAgentRouterItem({
      title: 'JSON 규칙 라우터',
      routingMode: 'json',
      jsonRules: JSON.stringify({
        match: 'first',
        rules: [
          {
            name: '결제 요청 분기',
            all: [
              { path: 'type', op: 'equals', value: 'billing' },
              { path: 'priority', op: 'gte', value: 2 },
            ],
            targets: ['billingAgent'],
          },
          {
            name: '일반 문의 분기',
            path: 'type',
            op: 'equals',
            value: 'general',
            targets: ['generalAgent'],
          },
        ],
      }),
      x: 0.4,
      y: 0.2,
    }),
    billingAgent: createAgentNodeItem({ title: '결제 처리 에이전트', x: 0.65, y: 0.1 }),
    generalAgent: createAgentNodeItem({ title: '일반 상담 에이전트', x: 0.65, y: 0.35 }),
    output: createAgentOutputItem({ title: '응답 출력', x: 0.88, y: 0.2 }),
    cIn: edge('input', 'orch', { channel: 'input' }),
    cOrch: edge('orch', 'router'),
    cBill: edge('router', 'billingAgent', { channel: 'route' }),
    cGen: edge('router', 'generalAgent', { channel: 'route' }),
    cOut1: edge('billingAgent', 'output', { channel: 'output' }),
    cOut2: edge('generalAgent', 'output', { channel: 'output' }),
  };

  const generalStatuses = [];
  const calledMessages = [];
  const store = createMultiAgentStore({
    getItems: () => items,
    patchItem: (id, patch) => {
      items[id] = { ...items[id], ...patch };
    },
    saveAgentItem: async (id, patch) => {
      items[id] = { ...items[id], ...patch };
    },
    saveState: async () => {},
    executeAgent: async payload => {
      if (payload.operation !== 'run') return {};
      calledMessages.push(payload.message);
      return { answer: '청구서 INV-900 결제 처리 완료' };
    },
  });

  const unsub = store.subscribeNode('generalAgent', () => {
    const st = store.getNodeState('generalAgent');
    if (st?.status) generalStatuses.push(st.status);
  });
  try {
    await store.runOrchestrator('orch');
  } finally {
    unsub();
  }

  assert.equal(calledMessages.length, 1);
  assert.match(calledMessages[0], /INV-900/);
  assert.equal(generalStatuses.includes('skipped'), true);
  assert.equal(readAgentRouterConfig(items.router).lastDecision.modeUsed, 'json');
  assert.deepEqual(readAgentRouterConfig(items.router).lastDecision.selectedTargetIds, ['billingAgent']);
  assert.equal(items.output.text, '청구서 INV-900 결제 처리 완료');
  assert.equal(items.output.runtimeResults.length, 1);
  assert.equal(items.generalAgent.text, '');
});

test('agent abort rejects without CLI cancel requests, and busy errors retry', async () => {
  // (a) A node saved with the removed VM CLI engine runs on the API engine; abort sends no cli_cancel.
  const items = {
    agent: createAgentNodeItem({ engine: 'cli', cli_tool: 'claude', systemPrompt: 'test' }),
  };
  const seen = [];
  const controller = new AbortController();
  let runResolve;
  const runPromise = runSingleAgent({
    items,
    agentId: 'agent',
    signal: controller.signal,
    executeAgent: (payload) => {
      seen.push(payload);
      if (payload.operation === 'run') {
        return new Promise((resolve) => {
          runResolve = resolve;
          queueMicrotask(() => controller.abort());
        });
      }
      return Promise.resolve({});
    },
  });
  await assert.rejects(runPromise, (err) => err?.code === 'AGENT_ABORTED');
  const runReq = seen.find((p) => p.operation === 'run');
  assert.ok(runReq, 'expected run payload');
  assert.equal(seen.some((p) => p.operation === 'cli_cancel'), false);
  assert.equal(runReq.options.engine, undefined);
  assert.equal(runReq.options.cli_tool, undefined);
  runResolve?.({ answer: 'late' });

  // (b) AGENT_BUSY and RUNTIME_BUSY errors trigger retries cleanly
  let attempt = 0;
  const busyRes = await runSingleAgent({
    items,
    agentId: 'agent',
    executeAgent: async (payload) => {
      if (payload.operation !== 'run') return {};
      attempt += 1;
      if (attempt === 1) {
        const err = new Error('busy');
        err.code = 'AGENT_BUSY';
        throw err;
      }
      if (attempt === 2) {
        const err = new Error('runtime busy');
        err.code = 'RUNTIME_BUSY';
        throw err;
      }
      return { answer: 'recovered after busy retries' };
    },
  });
  assert.equal(attempt, 3);
  assert.equal(busyRes.answer, 'recovered after busy retries');
});

test('an unverified account cannot start agent work from any graph entry point', async () => {
  const store = createMultiAgentStore({
    hasAdultAccess: () => false,
    getItems: () => assert.fail('denied runs must not read canvas data'),
    executeAgent: () => assert.fail('denied runs must not request a model'),
  });

  assert.equal(await store.runAgent('agent'), null);
  assert.equal(await store.runInput('input'), null);
  assert.equal(await store.runRouter('router'), null);
  assert.equal(await store.runOrchestrator('orchestrator'), null);
});
