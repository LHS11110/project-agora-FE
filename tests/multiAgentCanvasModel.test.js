import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_NODE_PREFIX,
  AGENT_ORCHESTRATOR_PREFIX,
  buildMultiAgentTemplate,
  createAgentNodeItem,
  createOrchestratorItem,
  isAgentCanvasObject,
  isAgentEdgeItem,
  isAgentNodeItem,
  isAgentOrchestratorItem,
  readAgentEdgeConfig,
  readAgentNodeConfig,
  readOrchestratorConfig,
  writeAgentEdgePatch,
  writeAgentNodePatch,
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
  for (const templateId of ['pipeline-review', 'parallel-synthesis', 'supervisor-team']) {
    let seq = 1;
    const orch = createOrchestratorItem({ x: 0.2, y: 0.3, permission: 'default' });
    const result = buildMultiAgentTemplate(templateId, 'orch-1', orch, 'default', () => `${templateId}-${seq++}`);
    assert.ok(result.createdEntries.length >= 6);
    const manifest = exportManifest(result.changes);
    const plan = planManifest(manifest, {}, 'default');
    assert.equal(plan.creates.length, Object.keys(result.changes).length);
  }
});

test('agent objects are excluded from code blueprint graphs while supporting Shift+Enter shortcut', () => {
  const agent = createAgentNodeItem({ permission: 'default' });
  const orch = createOrchestratorItem({ permission: 'default' });
  const code = { kind: 'text', renderMode: 'code', language: 'python', text: 'print(1)' };
  const items = {
    agent,
    orch,
    code,
    c1: { kind: 'connector', from: 'agent', to: 'code' },
    c2: { kind: 'connector', from: 'orch', to: 'agent' },
  };
  assert.equal(isBlueprintNode(agent), false);
  assert.equal(isBlueprintNode(orch), false);
  assert.throws(() => resolveBlueprint(items, 'agent'), /실행 객체가 필요합니다/);
  assert.throws(() => resolveBlueprint(items, 'orch'), /실행 객체가 필요합니다/);

  const event = { key: 'Enter', shiftKey: true };
  assert.equal(selectedRunnableForShortcut(event, ['agent'], items), 'agent');
  assert.equal(selectedRunnableForShortcut(event, ['orch'], items), 'orch');
  assert.equal(selectedRunnableForShortcut(event, ['agent'], items, 'agent'), null);
});
