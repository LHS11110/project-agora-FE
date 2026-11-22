import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentInputItem,
  createAgentNodeItem,
  createAgentRouterItem,
  writeAgentEdgePatch,
} from '../src/canvas/agents/agentCanvasModel.js';
import {
  applyRouterFallback,
  buildStarterJsonRoutingRules,
  collectInputEnvelope,
  detectFileFormatType,
  detectItemFormatType,
  evaluateAgentRouter,
  evaluateFormatRouting,
  evaluateJsonCondition,
  evaluateJsonRouting,
  extractRouterRoutes,
  getJsonPathValue,
  parseEdgeJsonCondition,
  parseRouterDecision,
  parseRouterJsonRules,
  tryParseJsonPayload,
} from '../src/canvas/agents/agentRouter.js';

function routeEdge(from, to, extra = {}) {
  const base = { kind: 'connector', from, to };
  return { ...base, ...writeAgentEdgePatch(base, extra) };
}

test('detectFileFormatType and detectItemFormatType classify multimodal files, links, and input nodes', () => {
  assert.equal(detectFileFormatType('chart.png', '', ''), 'image');
  assert.equal(detectFileFormatType('voice.mp3', '', ''), 'audio');
  assert.equal(detectFileFormatType('clip.webm', 'video/webm', ''), 'video');
  assert.equal(detectFileFormatType('spec.pdf', '', ''), 'pdf');
  assert.equal(detectFileFormatType('handler.py', '', ''), 'code');
  assert.equal(detectFileFormatType('metrics.csv', '', ''), 'table');
  assert.equal(detectFileFormatType('', '', 'https://youtu.be/abc123'), 'video');
  assert.equal(detectFileFormatType('', '', 'https://example.com/docs'), 'link');

  assert.equal(detectItemFormatType({ kind: 'image', url: 'x' }), 'image');
  assert.equal(detectItemFormatType({ kind: 'pdf', filename: 'doc.pdf' }), 'pdf');
  assert.equal(detectItemFormatType({ kind: 'table', columns: ['a'] }), 'table');
  assert.equal(detectItemFormatType({ kind: 'link', mediaType: 'audio', url: 'https://x/a' }), 'audio');
  assert.equal(detectItemFormatType({ kind: 'link', mediaType: 'gif', url: 'https://x/a.gif' }), 'image');
  assert.equal(detectItemFormatType({ kind: 'text', renderMode: 'code', text: 'x = 1' }), 'code');

  const mediaInput = createAgentInputItem({
    inputType: 'auto',
    text: '이 음성 파일을 요약해줘',
    attachments: [{ id: 'a1', name: 'call.wav', mimeType: 'audio/wav', formatType: 'audio' }],
  });
  assert.equal(detectItemFormatType(mediaInput), 'audio');

  const urlInput = createAgentInputItem({
    inputType: 'auto',
    text: 'https://example.com/slides.pdf',
  });
  assert.equal(detectItemFormatType(urlInput), 'pdf');
});

test('collectInputEnvelope aggregates input card text, attachments, and upstream canvas objects', () => {
  const items = {
    rawImg: { kind: 'image', title: '아키텍처 다이어그램', src: 'https://example.com/arch.png' },
    input: createAgentInputItem({
      name: '요청 입력',
      inputType: 'auto',
      text: '첨부된 PDF와 이미지를 분석해 주세요',
      attachments: [
        { id: 'att-1', name: 'report.pdf', mimeType: 'application/pdf', formatType: 'pdf', textSnippet: '분기 매출 요약' },
      ],
    }),
    router: createAgentRouterItem({ name: '라우터' }),
    c0: { kind: 'connector', from: 'rawImg', to: 'input' },
    c1: routeEdge('input', 'router', { channel: 'input' }),
  };

  const envelope = collectInputEnvelope(items, 'router');
  assert.ok(envelope.formats.includes('text'));
  assert.ok(envelope.formats.includes('pdf'));
  assert.ok(envelope.formats.includes('image'));
  assert.notEqual(envelope.primaryFormat, 'text');
  assert.equal(envelope.items.length, 3);
  assert.match(envelope.combinedText, /report\.pdf/);
  assert.match(envelope.combinedText, /아키텍처 다이어그램/);
});

test('evaluateFormatRouting matches formats and keywords, attaches companion text, and handles fallback policies', () => {
  const items = {
    input: createAgentInputItem({
      inputType: 'auto',
      text: '이 이미지에서 OCR로 표를 추출해줘',
      attachments: [{ id: 'att-img', name: 'scan.png', mimeType: 'image/png', formatType: 'image' }],
    }),
    router: createAgentRouterItem({ routingMode: 'format', multiMatch: false }),
    imgAgent: createAgentNodeItem({ title: '이미지 전문가', x: 0.1, y: 0.1 }),
    audioAgent: createAgentNodeItem({ title: '오디오 전문가', x: 0.2, y: 0.1 }),
    defaultAgent: createAgentNodeItem({ title: '기본 조교', x: 0.3, y: 0.1 }),
    cIn: routeEdge('input', 'router', { channel: 'input' }),
    eImg: routeEdge('router', 'imgAgent', { channel: 'route', routeFormats: ['image'], routeKeywords: 'ocr' }),
    eAud: routeEdge('router', 'audioAgent', { channel: 'route', routeFormats: ['audio'] }),
    eDef: routeEdge('router', 'defaultAgent', { channel: 'route', routeDefault: true }),
  };

  const routes = extractRouterRoutes(items, 'router');
  const envelope = collectInputEnvelope(items, 'router');
  const res = evaluateFormatRouting(envelope, routes, { multiMatch: false });

  assert.equal(res.matched, true);
  assert.deepEqual(res.selectedRoutes.map(r => r.targetId), ['imgAgent']);
  const routed = res.routedInputsByTarget.imgAgent;
  assert.equal(routed.some(i => i.formatType === 'image'), true);
  assert.equal(routed.some(i => i.formatType === 'text'), true);

  const emptyEnvelope = collectInputEnvelope({
    textOnly: createAgentInputItem({ inputType: 'video', text: '영상 설명' }),
  }, 'textOnly');
  const miss = evaluateFormatRouting(emptyEnvelope, routes, { multiMatch: false });
  assert.equal(miss.matched, false);

  assert.deepEqual(applyRouterFallback(routes, { fallbackPolicy: 'default_target' }).selectedRoutes.map(r => r.targetId), ['defaultAgent']);
  assert.deepEqual(applyRouterFallback(routes, { fallbackPolicy: 'first' }).selectedRoutes.map(r => r.targetId), ['imgAgent']);
  assert.equal(applyRouterFallback(routes, { fallbackPolicy: 'all' }).selectedRoutes.length, 3);
  assert.deepEqual(applyRouterFallback(routes, { fallbackPolicy: 'skip' }).selectedRoutes, []);
});

test('parseRouterDecision parses JSON, fenced JSON, and ROUTE tags while respecting allowMultiRoute', () => {
  const items = {
    router: createAgentRouterItem({}),
    a1: createAgentNodeItem({ title: '시각 분석가', role: 'vision', x: 0.1, y: 0.1 }),
    a2: createAgentNodeItem({ title: '문서 요약가', role: 'summarizer', x: 0.2, y: 0.1 }),
    c1: routeEdge('router', 'a1', { channel: 'route' }),
    c2: routeEdge('router', 'a2', { channel: 'route' }),
  };
  const routes = extractRouterRoutes(items, 'router');

  const d1 = parseRouterDecision('```json\n{"targets":["a1","a2"],"reason":"둘 다 필요"}\n```', routes, false);
  assert.equal(d1.parsed, true);
  assert.deepEqual(d1.selectedRoutes.map(r => r.targetId), ['a1']);
  assert.equal(d1.reason, '둘 다 필요');

  const d2 = parseRouterDecision('{"targets":["문서 요약가","a1"],"reason":"복수 선택"}', routes, true);
  assert.equal(d2.parsed, true);
  assert.deepEqual(d2.selectedRoutes.map(r => r.targetId), ['a2', 'a1']);

  const d3 = parseRouterDecision('[ROUTE: vision] 시각 작업', routes, false);
  assert.equal(d3.parsed, true);
  assert.deepEqual(d3.selectedRoutes.map(r => r.targetId), ['a1']);

  const d4 = parseRouterDecision('잘 모르겠습니다', routes, false);
  assert.equal(d4.parsed, false);
  assert.deepEqual(d4.selectedRoutes, []);
});

test('evaluateAgentRouter supports format, intelligent (API engine), fallback, and hybrid modes', async () => {
  const items = {
    input: createAgentInputItem({ inputType: 'pdf', text: 'PDF 논문 분석해줘' }),
    router: createAgentRouterItem({
      title: '지능형 라우터',
      routingMode: 'hybrid',
      // A router saved while VM CLI agents existed still runs on the API engine.
      engine: 'cli',
      cli_tool: 'claude',
      fallbackPolicy: 'default_target',
      routingPrompt: '작업 성격을 보고 선택',
    }),
    pdfAgent: createAgentNodeItem({ title: 'PDF 전문가' }),
    codeAgent: createAgentNodeItem({ title: '코드 전문가' }),
    cIn: routeEdge('input', 'router', { channel: 'input' }),
    cPdf: routeEdge('router', 'pdfAgent', { channel: 'route', routeFormats: ['pdf'] }),
    cCode: routeEdge('router', 'codeAgent', { channel: 'route', routeFormats: ['code'], routeDefault: true }),
  };

  let llmCalls = 0;
  const hybridFormatHit = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
    executeAgent: async () => {
      llmCalls += 1;
      return { answer: '{"targets":["codeAgent"]}' };
    },
  });
  assert.equal(hybridFormatHit.modeUsed, 'format');
  assert.deepEqual(hybridFormatHit.selectedTargetIds, ['pdfAgent']);
  assert.equal(llmCalls, 0);

  // Switch input to plain text (unmatched by pdf/code format rules) -> hybrid delegates to intelligent LLM call.
  items.input = createAgentInputItem({ inputType: 'text', text: '이 파이썬 함수 리팩토링 방향 잡아줘' });
  let capturedPayload = null;
  const hybridIntelligent = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
    executeAgent: async payload => {
      capturedPayload = payload;
      return { answer: '```json\n{"targets":["codeAgent"],"reason":"코드 리팩토링 요청"}\n```' };
    },
  });
  assert.equal(hybridIntelligent.modeUsed, 'intelligent');
  assert.deepEqual(hybridIntelligent.selectedTargetIds, ['codeAgent']);
  assert.equal(hybridIntelligent.fallbackUsed, false);
  assert.equal(hybridIntelligent.reason, '코드 리팩토링 요청');
  assert.equal(capturedPayload.api_key, undefined);
  assert.equal(capturedPayload.options.engine, undefined);
  assert.equal(capturedPayload.options.cli_tool, undefined);
  assert.equal(capturedPayload.options.reasoning_effort, 'low');

  // Unparseable response in intelligent mode applies configured fallback policy.
  items.router = createAgentRouterItem({ routingMode: 'intelligent', fallbackPolicy: 'default_target' });
  const fallbackRes = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
    executeAgent: async () => ({ answer: 'invalid non-json response' }),
  });
  assert.equal(fallbackRes.modeUsed, 'intelligent');
  assert.equal(fallbackRes.fallbackUsed, true);
  assert.deepEqual(fallbackRes.selectedTargetIds, ['codeAgent']);
});

test('tryParseJsonPayload and format classifiers recognize JSON files, text, fenced payloads, and code blocks', () => {
  assert.deepEqual(tryParseJsonPayload('{"type":"order","qty":3}'), { type: 'order', qty: 3 });
  assert.deepEqual(tryParseJsonPayload('```json\n[{"id":1}]\n```'), [{ id: 1 }]);
  assert.equal(tryParseJsonPayload('"just a string"'), null);
  assert.equal(tryParseJsonPayload('{broken json'), null);

  assert.equal(detectFileFormatType('payload.json', '', ''), 'json');
  assert.equal(detectFileFormatType('events.jsonl', '', ''), 'json');
  assert.equal(detectFileFormatType('data', 'application/json', ''), 'json');
  assert.equal(detectFileFormatType('problem', 'application/problem+json', ''), 'json');
  assert.equal(detectFileFormatType('handler.py', '', ''), 'code');

  assert.equal(detectItemFormatType(createAgentInputItem({ inputType: 'auto', text: '{"kind":"alert"}' })), 'json');
  assert.equal(detectItemFormatType({ kind: 'text', renderMode: 'code', language: 'json', text: '{"a":1}' }), 'json');
  assert.equal(detectItemFormatType({ kind: 'text', renderMode: 'plain', text: '{"a":1}' }), 'json');

  const envelope = collectInputEnvelope({
    input: createAgentInputItem({
      inputType: 'auto',
      text: '{"intent":"refund","amount":120}',
      attachments: [{ id: 'a1', name: 'extra.json', mimeType: 'application/json', formatType: 'json', textSnippet: '{"tier":"vip"}' }],
    }),
    router: createAgentRouterItem({}),
    c1: routeEdge('input', 'router', { channel: 'input' }),
  }, 'router');

  assert.ok(envelope.formats.includes('json'));
  assert.equal(envelope.primaryFormat, 'json');
  assert.equal(envelope.jsonPayloads.length, 2);
  assert.deepEqual(envelope.primaryJson, { intent: 'refund', amount: 120 });
});

test('getJsonPathValue, parseRouterJsonRules, parseEdgeJsonCondition, and evaluateJsonCondition safely evaluate rules', () => {
  const payload = {
    type: 'billing',
    priority: 5,
    items: [{ sku: 'PRO-1', price: 99 }, { sku: 'ADDON', price: 15 }],
    meta: { 'content-type': 'application/json', tags: ['urgent', 'vip'] },
    note: null,
  };
  const meta = { primaryFormat: 'json', formats: ['json'], count: 1 };

  assert.deepEqual(getJsonPathValue(payload, '$.items[0].sku', meta), { exists: true, value: 'PRO-1' });
  assert.deepEqual(getJsonPathValue(payload, 'meta["content-type"]', meta), { exists: true, value: 'application/json' });
  assert.deepEqual(getJsonPathValue(payload, '$meta.primaryFormat', meta), { exists: true, value: 'json' });
  assert.deepEqual(getJsonPathValue(payload, '__proto__.polluted', meta), { exists: false, value: undefined });
  assert.deepEqual(getJsonPathValue(payload, 'constructor.name', meta), { exists: false, value: undefined });
  assert.deepEqual(getJsonPathValue(payload, 'toString', meta), { exists: false, value: undefined });

  assert.equal(evaluateJsonCondition({ path: 'type', op: 'equals', value: 'billing' }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'type', op: 'not_equals', value: 'support' }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'meta.tags', op: 'contains', value: 'urgent' }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'items[0].sku', op: 'in', value: ['FREE', 'PRO-1'] }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'priority', op: 'gte', value: 5 }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'priority', op: 'lt', value: 10 }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'items[0].sku', op: 'regex', value: '^PRO-\\d+$' }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'items', op: 'type', value: 'array' }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'note', op: 'not_exists' }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ path: 'priority', op: 'exists' }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ not: { path: 'type', op: 'equals', value: 'support' } }, payload, meta), true);
  assert.equal(evaluateJsonCondition({ when: { type: 'billing', 'meta.tags': { op: 'contains', value: 'vip' } } }, payload, meta), true);

  const expr = parseEdgeJsonCondition('type == "billing" && priority >= 3 || $meta.primaryFormat == "pdf"');
  assert.equal(Boolean(expr.parseError), false);
  assert.equal(evaluateJsonCondition(expr, payload, meta), true);

  const shorthand = parseEdgeJsonCondition('{"type":"billing"}');
  assert.equal(evaluateJsonCondition(shorthand, payload, meta), true);

  const validSpec = parseRouterJsonRules('[{"path":"type","op":"equals","value":"billing","targets":["billAgent"]}]');
  assert.equal(validSpec.valid, true);
  assert.equal(validSpec.rules.length, 1);

  assert.equal(parseRouterJsonRules('{bad').valid, false);
  assert.equal(parseRouterJsonRules('{"foo":1}').valid, false);
  assert.equal(parseRouterJsonRules('[{"targets":["a"]}]').valid, false);
});

test('evaluateJsonRouting and evaluateAgentRouter handle json, format (json), and hybrid modes', async () => {
  const items = {
    input: createAgentInputItem({
      inputType: 'auto',
      text: '{"intent":"billing","amount":250,"tags":["urgent"]}',
    }),
    router: createAgentRouterItem({
      title: 'JSON 라우터',
      routingMode: 'json',
      jsonRules: JSON.stringify({
        match: 'first',
        rules: [
          {
            name: '결제 고액',
            all: [
              { path: 'intent', op: 'equals', value: 'billing' },
              { path: 'amount', op: 'gte', value: 100 },
            ],
            targets: ['결제 에이전트'],
          },
          {
            name: '일반',
            path: 'intent',
            op: 'equals',
            value: 'general',
            targets: ['generalAgent'],
          },
        ],
        defaultTarget: 'generalAgent',
      }),
    }),
    billingAgent: createAgentNodeItem({ title: '결제 에이전트', x: 0.1, y: 0.1 }),
    generalAgent: createAgentNodeItem({ title: '일반 에이전트', x: 0.2, y: 0.1 }),
    audioAgent: createAgentNodeItem({ title: '오디오 에이전트', x: 0.3, y: 0.1 }),
    cIn: routeEdge('input', 'router', { channel: 'input' }),
    cBill: routeEdge('router', 'billingAgent', { channel: 'route', routeFormats: ['json'] }),
    cGen: routeEdge('router', 'generalAgent', { channel: 'route', routeDefault: true }),
    cAud: routeEdge('router', 'audioAgent', { channel: 'route', routeJsonCondition: 'media.kind == "audio"' }),
  };

  const jsonRes = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
  });
  assert.equal(jsonRes.modeUsed, 'json');
  assert.equal(jsonRes.fallbackUsed, false);
  assert.deepEqual(jsonRes.selectedTargetIds, ['billingAgent']);

  // Edge JSON condition alone in json mode (empty jsonRules) matches audioAgent
  items.router = createAgentRouterItem({ routingMode: 'json', jsonRules: '' });
  items.input = createAgentInputItem({ inputType: 'auto', text: '{"media":{"kind":"audio"}}' });
  const edgeJsonRes = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
  });
  assert.equal(edgeJsonRes.modeUsed, 'json');
  assert.deepEqual(edgeJsonRes.selectedTargetIds, ['audioAgent']);

  // Unmatched JSON falls back cleanly to default target in json mode
  items.input = createAgentInputItem({ inputType: 'auto', text: '{"unknown":true}' });
  const jsonMissed = evaluateJsonRouting(
    collectInputEnvelope(items, 'router'),
    extractRouterRoutes(items, 'router'),
    { jsonRules: '', fallbackPolicy: 'default_target' },
  );
  assert.equal(jsonMissed.matched, false);
  const jsonFallback = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
  });
  assert.equal(jsonFallback.modeUsed, 'json');
  assert.equal(jsonFallback.fallbackUsed, true);
  assert.deepEqual(jsonFallback.selectedTargetIds, ['generalAgent']);

  // Hybrid mode prioritizes JSON rules without invoking LLM, and sends parsed JSON to LLM when unmatched
  items.router = createAgentRouterItem({
    routingMode: 'hybrid',
    jsonRules: '[{"path":"media.kind","op":"equals","value":"audio","targets":["audioAgent"]}]',
  });
  items.input = createAgentInputItem({ inputType: 'auto', text: '{"media":{"kind":"audio"}}' });
  let llmCalls = 0;
  const hybridJsonHit = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
    executeAgent: async () => {
      llmCalls += 1;
      return { answer: '{"targets":["generalAgent"]}' };
    },
  });
  assert.equal(hybridJsonHit.modeUsed, 'json');
  assert.deepEqual(hybridJsonHit.selectedTargetIds, ['audioAgent']);
  assert.equal(llmCalls, 0);

  // When JSON rules miss and format routes don't match either (note: no edge has 'json' except cBill above; use clean format routes)
  items.cBill = routeEdge('router', 'billingAgent', { channel: 'route', routeFormats: ['pdf'] });
  items.input = createAgentInputItem({ inputType: 'auto', text: '{"topic":"roadmap"}' });
  let seenPrompt = '';
  const hybridLlmFallback = await evaluateAgentRouter({
    items,
    routerId: 'router',
    inputEnvelope: collectInputEnvelope(items, 'router'),
    executeAgent: async payload => {
      seenPrompt = payload.message;
      return { answer: '{"targets":["generalAgent"],"reason":"로드맵 논의"}' };
    },
  });
  assert.equal(hybridLlmFallback.modeUsed, 'intelligent');
  assert.deepEqual(hybridLlmFallback.selectedTargetIds, ['generalAgent']);
  assert.match(seenPrompt, /\[파싱된 JSON 페이로드\]/);

  const starter = buildStarterJsonRoutingRules(extractRouterRoutes(items, 'router'));
  assert.equal(parseRouterJsonRules(starter).valid, true);
});
