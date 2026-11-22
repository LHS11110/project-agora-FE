import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentNodeItem,
  createOrchestratorItem,
  writeAgentEdgePatch,
} from '../src/canvas/agents/agentCanvasModel.js';
import {
  extractCanvasObjectData,
  inferEdgeChannel,
  inspectAgentConnections,
  resolveMultiAgentGraph,
  resolveSingleAgentGraph,
} from '../src/canvas/agents/multiAgentGraph.js';

function edge(from, to, extra = {}) {
  const base = { kind: 'connector', from, to };
  if (extra.channel || extra.delivery || extra.enabled !== undefined || extra.label !== undefined) {
    Object.assign(base, writeAgentEdgePatch(base, extra));
  }
  return base;
}

test('extractCanvasObjectData reads diverse canvas object types cleanly', () => {
  assert.match(extractCanvasObjectData('n1', { kind: 'note', text: '요구사항 메모' }).content, /요구사항 메모/);
  assert.match(extractCanvasObjectData('c1', { kind: 'text', renderMode: 'code', filename: 'app.py', language: 'python', text: 'print(1)' }).content, /app\.py/);
  assert.equal(extractCanvasObjectData('v1', { kind: 'value', title: 'budget', valueType: 'integer', valueNumber: 42 }).content, 'budget: 42');
  assert.match(extractCanvasObjectData('t1', { kind: 'table', columns: ['Name', 'Score'], rows: [['Alice', '95']] }).content, /Alice \| 95/);
  assert.match(extractCanvasObjectData('ch1', { kind: 'chart', chartType: 'bar', chartTitle: '매출', columns: ['Q', 'V'], rows: [['Q1', '10']] }).content, /매출/);
  assert.match(extractCanvasObjectData('out1', { kind: 'shape', runtimeRole: 'output', runtimeResults: [{ output: 'stdout-ok' }] }).content, /stdout-ok/);
  assert.match(extractCanvasObjectData('q1', { kind: 'question', questionPrompt: '1+1?', questionOptions: ['1', '2'], questionAnswer: '2' }).content, /1\+1\?/);
  assert.match(extractCanvasObjectData('l1', { kind: 'link', mediaType: 'youtube', title: '참고 영상', url: 'https://example.com' }).content, /참고 영상/);
});

test('inspectAgentConnections infers prompt, data, context, handoff, feedback, and output channels', () => {
  const items = {
    promptNote: { kind: 'note', text: '규칙', x: 0.1, y: 0.1 },
    dataTable: { kind: 'table', columns: ['A'], rows: [['1']], x: 0.1, y: 0.2 },
    ctxLink: { kind: 'link', title: '문서', url: 'https://a.test', x: 0.1, y: 0.3 },
    disabledNote: { kind: 'note', text: '비활성', x: 0.1, y: 0.4 },
    prevAgent: createAgentNodeItem({ title: '기획자', x: 0.2, y: 0.1 }),
    reviewer: createAgentNodeItem({ title: '리뷰어', x: 0.6, y: 0.1 }),
    me: createAgentNodeItem({ title: '구현자', x: 0.4, y: 0.1 }),
    out: { kind: 'shape', runtimeRole: 'output', x: 0.8, y: 0.1 },
    e1: edge('promptNote', 'me', { label: '시스템 프롬프트' }),
    e2: edge('dataTable', 'me'),
    e3: edge('ctxLink', 'me', { label: '참고 컨텍스트' }),
    e4: edge('disabledNote', 'me', { enabled: false }),
    e5: edge('prevAgent', 'me'),
    e6: edge('reviewer', 'me', { label: '검토 피드백' }),
    e7: edge('me', 'out'),
  };

  assert.equal(inferEdgeChannel(items.promptNote, items.me, items.e1), 'prompt');
  assert.equal(inferEdgeChannel(items.dataTable, items.me, items.e2), 'data');
  assert.equal(inferEdgeChannel(items.ctxLink, items.me, items.e3), 'context');
  assert.equal(inferEdgeChannel(items.reviewer, items.me, items.e6), 'feedback');
  assert.equal(inferEdgeChannel(items.me, items.out, items.e7), 'output');

  const conn = inspectAgentConnections(items, 'me');
  assert.deepEqual(conn.promptInputs.map(e => e.sourceId), ['promptNote']);
  assert.deepEqual(conn.dataInputs.map(e => e.sourceId), ['dataTable', 'ctxLink']);
  assert.deepEqual(conn.upstreamAgents.map(e => e.sourceId), ['prevAgent']);
  assert.deepEqual(conn.feedbackAgents.map(e => e.sourceId), ['reviewer']);
  assert.deepEqual(conn.outputSinks.map(e => e.targetId), ['out']);

  const single = resolveSingleAgentGraph(items, 'me');
  assert.equal(single.promptInputs.length, 1);
  assert.equal(single.dataInputs.length, 2);
});

test('resolveMultiAgentGraph computes waves, rejects cycles in graph mode, and separates feedback in collaborative mode', () => {
  const items = {
    orch: createOrchestratorItem({ mode: 'graph', x: 0.1, y: 0.2 }),
    goalNote: { kind: 'note', text: '공동 목표', x: 0.02, y: 0.2 },
    a: createAgentNodeItem({ title: 'A', x: 0.3, y: 0.1 }),
    b: createAgentNodeItem({ title: 'B', x: 0.3, y: 0.3 }),
    c: createAgentNodeItem({ title: 'C', x: 0.5, y: 0.2 }),
    out: { kind: 'shape', runtimeRole: 'output', x: 0.7, y: 0.2 },
    eg: edge('goalNote', 'orch'),
    e1: edge('orch', 'a'),
    e2: edge('orch', 'b'),
    e3: edge('a', 'c'),
    e4: edge('b', 'c'),
    e5: edge('c', 'out'),
  };

  const dag = resolveMultiAgentGraph(items, 'orch');
  assert.deepEqual(dag.waves, [['a', 'b'], ['c']]);
  assert.deepEqual(dag.orchestratorInputs.map(e => e.sourceId), ['goalNote']);
  assert.deepEqual(dag.agentsById.c.outputSinks.map(e => e.targetId), ['out']);

  // Adding a cycle fails in strict graph mode...
  items.fb = edge('c', 'a', { channel: 'feedback', label: '피드백' });
  assert.throws(() => resolveMultiAgentGraph(items, 'orch'), /순환/);

  // ...and succeeds in collaborative mode with back-edge classified as feedback!
  items.orch = createOrchestratorItem({ mode: 'collaborative', maxRounds: 2, x: 0.1, y: 0.2 });
  const collab = resolveMultiAgentGraph(items, 'orch');
  assert.deepEqual(collab.waves, [['a', 'b'], ['c']]);
  assert.equal(collab.feedbackEdges.length, 1);
  assert.equal(collab.feedbackEdges[0].from, 'c');
  assert.equal(collab.feedbackEdges[0].to, 'a');
});
