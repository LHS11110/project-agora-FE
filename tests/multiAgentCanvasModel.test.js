import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_INPUT_PREFIX,
  AGENT_NODE_PREFIX,
  AGENT_ORCHESTRATOR_PREFIX,
  AGENT_OUTPUT_PREFIX,
  AGENT_ROUTER_PREFIX,
  INPUT_DATA_FORMATS,
  JSON_RULE_OPERATORS,
  ROUTING_MODES,
  buildMultiAgentTemplate,
  createAgentInputItem,
  createAgentNodeItem,
  createAgentOutputItem,
  createAgentRouterItem,
  createOrchestratorItem,
  isAgentCanvasObject,
  isAgentEdgeItem,
  isAgentInputItem,
  isAgentNodeItem,
  isAgentOrchestratorItem,
  isAgentOutputItem,
  isAgentRouterItem,
  isAgentRunnableItem,
  readAgentEdgeConfig,
  readAgentEdgeRouteConfig,
  readAgentInputConfig,
  readAgentNodeConfig,
  readAgentOutputConfig,
  readAgentRouterConfig,
  readOrchestratorConfig,
  writeAgentEdgePatch,
  writeAgentInputPatch,
  writeAgentNodePatch,
  writeAgentOutputPatch,
  writeAgentRouterPatch,
  writeOrchestratorPatch,
} from '../src/canvas/agents/agentCanvasModel.js';
import { CANVAS_ITEM_FIELDS, exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';
import { isBlueprintNode, resolveBlueprint } from '../src/canvas/runtime/blueprintGraph.js';
import { validRuntimeState } from '../src/canvas/runtime/sharedState.js';
import { selectedRunnableForShortcut } from '../src/canvas/runtime/codeExecutionShortcut.js';

test('agent node, orchestrator, and edge models use only BE-whitelisted fields and never leak credentials', () => {
  const agent = createAgentNodeItem({
    presetId: 'developer',
    title: '백엔드 구현자',
    systemPrompt: '테스트 가능한 코드를 작성하세요.',
    engine: 'cli',
    cli_tool: 'claude',
    api_key: 'sk-secret-should-not-persist',
    cli_api_key: 'sk-cli-secret',
    permission: 'default',
  });
  const orch = createOrchestratorItem({
    title: '팀 오케스트라',
    mode: 'collaborative',
    maxRounds: 3,
    goal: 'API와 테스트를 완성하세요.',
    permission: 'default',
  });

  assert.equal(isAgentNodeItem(agent), true);
  assert.equal(isAgentOrchestratorItem(agent), false);
  assert.equal(isAgentOrchestratorItem(orch), true);
  assert.equal(isAgentCanvasObject(agent), true);
  assert.equal(isAgentCanvasObject(orch), true);
  assert.ok(agent.format.startsWith(AGENT_NODE_PREFIX));
  assert.ok(orch.format.startsWith(AGENT_ORCHESTRATOR_PREFIX));
  assert.equal(agent.format.includes('sk-secret'), false);
  assert.equal(agent.format.includes('sk-cli-secret'), false);

  for (const field of [...Object.keys(agent), ...Object.keys(orch)]) {
    assert.ok(CANVAS_ITEM_FIELDS.has(field), `field ${field} must be in CANVAS_ITEM_FIELDS`);
  }

  const patch = writeAgentNodePatch(agent, {
    title: '시니어 구현자',
    color: '#2B6CB0',
    systemPrompt: '새 프롬프트',
    api_key: 'sk-ignored',
    max_steps: 99,
  });
  assert.equal(patch.title, '시니어 구현자');
  assert.equal(patch.color, '#2b6cb0');
  assert.equal(patch.format.includes('sk-ignored'), false);
  for (const field of Object.keys(patch)) {
    assert.ok(CANVAS_ITEM_FIELDS.has(field));
  }
  const updatedAgent = { ...agent, ...patch };
  assert.equal(readAgentNodeConfig(updatedAgent).systemPrompt, '새 프롬프트');
  // Out-of-bounds max_steps falls back to default (8).
  assert.equal(readAgentNodeConfig(updatedAgent).max_steps, 8);

  const orchPatch = writeOrchestratorPatch(orch, { maxRounds: 99, mode: 'supervisor' });
  const updatedOrch = { ...orch, ...orchPatch };
  assert.equal(readOrchestratorConfig(updatedOrch).maxRounds, 2);
  assert.equal(readOrchestratorConfig(updatedOrch).mode, 'supervisor');

  const connector = { kind: 'connector', from: 'o1', to: 'a1', permission: 'default' };
  const edgePatch = writeAgentEdgePatch(connector, { channel: 'prompt', delivery: 'inline', enabled: false, label: '지시 전달' });
  const updatedConnector = { ...connector, ...edgePatch };
  assert.equal(isAgentEdgeItem(updatedConnector), true);
  assert.deepEqual(readAgentEdgeConfig(updatedConnector), {
    v: 1,
    channel: 'prompt',
    delivery: 'inline',
    enabled: false,
  });

  // Round-trip through manifest export + validation.
  const manifest = exportManifest({ a1: updatedAgent, o1: updatedOrch, c1: updatedConnector });
  const plan = planManifest(manifest, {}, 'default');
  assert.equal(plan.creates.length, 3);

  // Runtime state sync remains compatible with sharedState.js.
  assert.equal(validRuntimeState({ ...updatedAgent, runtimeState: { running: true, status: 'running', phase: 'agent', updatedAt: Date.now() } }), true);
  assert.equal(validRuntimeState({ ...updatedOrch, runtimeState: { running: false, status: 'success', completed: true, phase: 'agent', updatedAt: Date.now() } }), true);
});

test('all multi-agent templates produce valid non-overlapping canvas manifests', () => {
  for (const templateId of ['pipeline-review', 'parallel-synthesis', 'supervisor-team', 'smart-router-team']) {
    let seq = 1;
    const orch = createOrchestratorItem({ x: 0.2, y: 0.3, permission: 'default' });
    const result = buildMultiAgentTemplate(templateId, 'orch-1', orch, 'default', () => `${templateId}-${seq++}`);
    assert.ok(result.createdEntries.length >= 6);
    const manifest = exportManifest(result.changes);
    const plan = planManifest(manifest, {}, 'default');
    assert.equal(plan.creates.length, Object.keys(result.changes).length);
  }
});

test('agent input, router, and output items conform to backend field whitelist and strip router secrets', () => {
  const input = createAgentInputItem({
    name: '사용자 입력',
    inputType: 'pdf',
    text: 'PDF 분석 요청',
    permission: 'default',
  });
  const router = createAgentRouterItem({
    name: '스마트 라우터',
    routingMode: 'hybrid',
    fallbackPolicy: 'default_target',
    permission: 'default',
  });
  const output = createAgentOutputItem({
    name: '최종 응답',
    displayMode: 'markdown',
    permission: 'default',
  });

  for (const [prefix, item, expectedRole] of [
    [AGENT_INPUT_PREFIX, input, 'executor'],
    [AGENT_ROUTER_PREFIX, router, 'executor'],
    [AGENT_OUTPUT_PREFIX, output, 'output'],
  ]) {
    assert.equal(item.kind, 'shape');
    assert.equal(item.shapeType, 'rectangle');
    assert.equal(item.runtimeRole, expectedRole);
    assert.ok(item.format.startsWith(prefix));
    for (const key of Object.keys(item)) {
      assert.ok(CANVAS_ITEM_FIELDS.has(key), `unexpected canvas field ${key}`);
    }
  }

  assert.equal(isAgentInputItem(input), true);
  assert.equal(isAgentRouterItem(router), true);
  assert.equal(isAgentOutputItem(output), true);
  assert.equal(isAgentRunnableItem(input), true);
  assert.equal(isAgentRunnableItem(router), true);
  assert.equal(isAgentRunnableItem(output), false);
  assert.equal(isAgentCanvasObject(input), true);
  assert.equal(isAgentCanvasObject(router), true);
  assert.equal(isAgentCanvasObject(output), true);

  const inputPatched = {
    ...input,
    ...writeAgentInputPatch(input, {
      inputType: 'image',
      text: '새 이미지 요청',
      attachments: [{ id: 'att-1', name: 'chart.png', mimeType: 'image/png', formatType: 'image' }],
    }),
  };
  const inputCfg = readAgentInputConfig(inputPatched);
  assert.equal(inputCfg.inputType, 'image');
  assert.equal(inputPatched.text, '새 이미지 요청');
  assert.equal(inputCfg.attachments.length, 1);

  const routerPatched = {
    ...router,
    ...writeAgentRouterPatch(router, {
      routingMode: 'intelligent',
      engine: 'cli',
      cli_tool: 'codex',
      cli_model: 'gpt-5-codex',
      api_key: 'sk-must-not-persist',
      cli_api_key: 'cli-secret',
    }),
  };
  const routerCfg = readAgentRouterConfig(routerPatched);
  assert.equal(routerCfg.routingMode, 'intelligent');
  // VM CLI agents were removed: saved CLI options fall back to the API engine and are dropped.
  assert.equal(routerCfg.engine, 'api');
  assert.equal(routerCfg.cli_tool, undefined);
  assert.equal(routerCfg.cli_model, undefined);
  assert.equal(routerCfg.api_key, undefined);
  assert.equal(routerCfg.cli_api_key, undefined);
  assert.equal(routerPatched.format.includes('sk-must-not-persist'), false);
  assert.equal(routerPatched.format.includes('cli-secret'), false);

  const outputPatched = {
    ...output,
    ...writeAgentOutputPatch(output, {
      text: '완료 결과',
      displayMode: 'plain',
      runtimeResults: [
        {
          runId: 'run-1',
          codeId: 'agent-1',
          createdAt: '2026-11-22T00:00:00Z',
          output: '완료 결과',
          error: '',
          exitCode: 0,
        },
      ],
    }),
  };
  const outputCfg = readAgentOutputConfig(outputPatched);
  assert.equal(outputPatched.text, '완료 결과');
  assert.equal(outputCfg.displayMode, 'plain');
  assert.equal(outputPatched.runtimeResults.length, 1);

  const manifest = exportManifest({ input: inputPatched, router: routerPatched, output: outputPatched });
  const plan = planManifest(manifest, {}, 'default');
  assert.equal(plan.creates.length, 3);

  const conn = {
    kind: 'connector',
    from: 'router',
    to: 'agent-1',
    ...writeAgentEdgePatch(
      { kind: 'connector', from: 'router', to: 'agent-1' },
      {
        channel: 'route',
        routeFormats: ['image', 'pdf', 'json'],
        routeKeywords: '표, ocr',
        routeJsonCondition: 'type == "billing" && priority >= 2',
        routeDescription: '시각 문서 처리',
        routeDefault: true,
        routePriority: 10,
      },
    ),
  };
  const routeCfg = readAgentEdgeRouteConfig(conn);
  assert.deepEqual(routeCfg.routeFormats, ['image', 'pdf', 'json']);
  assert.equal(routeCfg.routeKeywords, '표, ocr');
  assert.equal(routeCfg.routeJsonCondition, 'type == "billing" && priority >= 2');
  assert.equal(routeCfg.routeDescription, '시각 문서 처리');
  assert.equal(routeCfg.routeDefault, true);
  assert.equal(routeCfg.routePriority, 10);

  assert.equal(INPUT_DATA_FORMATS.some(f => f.id === 'json'), true);
  assert.equal(ROUTING_MODES.some(m => m.id === 'json'), true);
  assert.equal(JSON_RULE_OPERATORS.some(o => o.id === 'equals'), true);

  const jsonRulesSample = '{"match":"first","rules":[{"path":"type","op":"equals","value":"billing","targets":["agent-1"]}]}';
  const routerJsonPatched = {
    ...routerPatched,
    ...writeAgentRouterPatch(routerPatched, {
      routingMode: 'json',
      jsonRules: jsonRulesSample,
    }),
  };
  const routerJsonCfg = readAgentRouterConfig(routerJsonPatched);
  assert.equal(routerJsonCfg.routingMode, 'json');
  assert.equal(routerJsonCfg.jsonRules, jsonRulesSample);

  const plainEdge = {
    kind: 'connector',
    from: 'a',
    to: 'b',
    ...writeAgentEdgePatch({ kind: 'connector', from: 'a', to: 'b' }, {
      channel: 'prompt',
      delivery: 'inline',
      enabled: false,
      routeJsonCondition: '',
    }),
  };
  assert.deepEqual(readAgentEdgeConfig(plainEdge), {
    v: 1,
    channel: 'prompt',
    delivery: 'inline',
    enabled: false,
  });
});

test('agent objects are excluded from code blueprint graphs while supporting Shift+Enter shortcut', () => {
  const agent = createAgentNodeItem({ permission: 'default' });
  const orch = createOrchestratorItem({ permission: 'default' });
  const input = createAgentInputItem({ permission: 'default' });
  const router = createAgentRouterItem({ permission: 'default' });
  const output = createAgentOutputItem({ permission: 'default' });
  const code = { kind: 'text', renderMode: 'code', language: 'python', text: 'print(1)' };
  const items = {
    agent,
    orch,
    input,
    router,
    output,
    code,
    c1: { kind: 'connector', from: 'agent', to: 'code' },
    c2: { kind: 'connector', from: 'orch', to: 'agent' },
  };
  assert.equal(isBlueprintNode(agent), false);
  assert.equal(isBlueprintNode(orch), false);
  assert.equal(isBlueprintNode(input), false);
  assert.equal(isBlueprintNode(router), false);
  assert.equal(isBlueprintNode(output), false);
  assert.throws(() => resolveBlueprint(items, 'agent'), /실행 객체가 필요합니다/);
  assert.throws(() => resolveBlueprint(items, 'orch'), /실행 객체가 필요합니다/);

  const event = { key: 'Enter', shiftKey: true };
  assert.equal(selectedRunnableForShortcut(event, ['agent'], items), 'agent');
  assert.equal(selectedRunnableForShortcut(event, ['orch'], items), 'orch');
  assert.equal(selectedRunnableForShortcut(event, ['input'], items), 'input');
  assert.equal(selectedRunnableForShortcut(event, ['router'], items), 'router');
  assert.equal(selectedRunnableForShortcut(event, ['output'], items), null);
  assert.equal(selectedRunnableForShortcut(event, ['agent'], items, 'agent'), null);
});
