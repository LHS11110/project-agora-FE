import { contentMode, contentSource, isTextContent } from '../content/contentPresentation.js';
import { displayedValue } from '../values/valueData.js';
import {
  INPUT_DATA_FORMATS,
  agentModelOptions,
  isAgentInputItem,
  isAgentNodeItem,
  isAgentOrchestratorItem,
  isAgentOutputItem,
  isAgentRouterItem,
  readAgentEdgeConfig,
  readAgentEdgeRouteConfig,
  readAgentInputConfig,
  readAgentNodeConfig,
  readAgentOutputConfig,
  readAgentRouterConfig,
} from './agentCanvasModel.js';

const FORMAT_LABELS = Object.fromEntries(INPUT_DATA_FORMATS.map(f => [f.id, f.label]));

const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|gif|bmp|avif|svg)(?:$|[?#])/i;
const AUDIO_EXT_RE = /\.(?:mp3|wav|ogg|m4a|aac|flac|opus|weba)(?:$|[?#])/i;
const VIDEO_EXT_RE = /\.(?:mp4|m4v|mov|webm|ogv|mkv)(?:$|[?#])/i;
const PDF_EXT_RE = /\.pdf(?:$|[?#])/i;
const JSON_EXT_RE = /\.json(?:c|l)?(?:$|[?#])/i;
const CODE_EXT_RE = /\.(?:js|mjs|cjs|jsx|ts|tsx|py|java|c|cpp|cc|h|hpp|go|rs|sh|bash|sql|html|css|ya?ml|xml)(?:$|[?#])/i;
const TABLE_EXT_RE = /\.(?:csv|tsv|xlsx|xls)(?:$|[?#])/i;
const YOUTUBE_URL_RE = /(?:youtube\.com|youtu\.be)/i;
const URL_RE = /^https?:\/\/\S+$/i;

const BLOCKED_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const LABEL_FORMAT_RULES = [
  ['image', /이미지|사진|그림|image|img|vision|photo|png|jpg|webp/i],
  ['audio', /오디오|음성|소리|녹음|audio|voice|sound|speech|mp3|wav/i],
  ['video', /동영상|비디오|영상|video|youtube|mp4|webm/i],
  ['pdf', /pdf|문서파일/i],
  ['json', /json|페이로드|payload|구조화|스키마/i],
  ['code', /코드|소스|스크립트|code|program|script/i],
  ['table', /표|테이블|시트|차트|그래프|table|sheet|chart|csv|xlsx/i],
  ['link', /링크|url|웹|link|http/i],
  ['text', /텍스트|글|문장|메모|text|markdown|prompt/i],
];

export function formatTypeLabel(formatType) {
  return FORMAT_LABELS[formatType] || formatType || '텍스트';
}

export function tryParseJsonPayload(raw) {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  if (!text) return null;
  const fenced = text.match(/^```(?:json|jsonc)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function detectFileFormatType(name = '', mimeType = '', url = '') {
  const mime = String(mimeType || '').trim().toLowerCase();
  const sample = `${name || ''} ${url || ''}`.trim();

  if (mime.startsWith('image/') || IMAGE_EXT_RE.test(sample)) return 'image';
  if (mime.startsWith('audio/') || AUDIO_EXT_RE.test(sample)) return 'audio';
  if (mime.startsWith('video/') || VIDEO_EXT_RE.test(sample) || YOUTUBE_URL_RE.test(String(url || ''))) return 'video';
  if (mime === 'application/pdf' || PDF_EXT_RE.test(sample)) return 'pdf';
  if (mime === 'application/json' || mime.endsWith('+json') || JSON_EXT_RE.test(sample)) return 'json';
  if (TABLE_EXT_RE.test(sample) || mime.includes('csv') || mime.includes('spreadsheet')) return 'table';
  if (CODE_EXT_RE.test(sample) || mime.includes('javascript') || mime.includes('python')) return 'code';
  if (URL_RE.test(String(url || '').trim())) return 'link';
  return 'text';
}

export function detectItemFormatType(item) {
  if (!item || typeof item !== 'object') return 'text';
  if (isAgentInputItem(item)) {
    const cfg = readAgentInputConfig(item);
    if (cfg.inputType && cfg.inputType !== 'auto') return cfg.inputType;
    const mediaAttachment = cfg.attachments.find(att => att.formatType !== 'text');
    if (mediaAttachment) return mediaAttachment.formatType;
    const trimmed = String(item.text || '').trim();
    if (tryParseJsonPayload(trimmed) !== null) return 'json';
    if (cfg.attachments.length) return cfg.attachments[0].formatType;
    if (URL_RE.test(trimmed)) return detectFileFormatType('', '', trimmed);
    return 'text';
  }
  if (item.kind === 'image') return 'image';
  if (item.kind === 'pdf') return 'pdf';
  if (item.kind === 'table' || item.kind === 'chart') return 'table';
  if (item.kind === 'code' || (isTextContent(item) && contentMode(item) === 'code')) {
    if (String(item.language || '').trim().toLowerCase() === 'json' || JSON_EXT_RE.test(item.filename || '')) {
      return 'json';
    }
    if (tryParseJsonPayload(contentSource(item)) !== null) return 'json';
    return 'code';
  }
  if (isTextContent(item)) {
    return tryParseJsonPayload(contentSource(item)) !== null ? 'json' : 'text';
  }
  if (item.kind === 'note') {
    return tryParseJsonPayload(String(item.text || '')) !== null ? 'json' : 'text';
  }
  if (isAgentOutputItem(item)) {
    if (readAgentOutputConfig(item).displayMode === 'json' || tryParseJsonPayload(item.text) !== null) {
      return 'json';
    }
    return 'text';
  }
  if (item.kind === 'link') {
    const media = String(item.mediaType || '').toLowerCase();
    if (media === 'gif' || media === 'image') return 'image';
    if (media === 'audio') return 'audio';
    if (media === 'video' || media === 'youtube') return 'video';
    const guessed = detectFileFormatType(item.title || item.filename || '', '', item.url || '');
    return guessed === 'text' ? 'link' : guessed;
  }
  return 'text';
}

function summarizeText(text, max = 140) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function itemDisplayTitle(id, item) {
  if (!item) return String(id);
  if (item.title) return String(item.title);
  if (item.filename) return String(item.filename);
  if (item.groupTitle) return String(item.groupTitle);
  if (item.kind === 'note' && item.text) return summarizeText(item.text.replace(/^#+\s*/g, ''), 40) || '메모';
  return String(item.kind || id);
}

function describeCanvasItemContent(id, item, { freshAgentOutputs, freshRuntimeOutputs } = {}) {
  if (!item) return '';
  if (isAgentNodeItem(item)) {
    const key = String(id);
    return freshAgentOutputs?.has(key) ? String(freshAgentOutputs.get(key) || '') : String(item.text || '');
  }
  if (isAgentOutputItem(item) || item.runtimeRole === 'output') {
    const key = String(id);
    if (item.text) return String(item.text);
    const records = freshRuntimeOutputs?.get(key) || item.runtimeResults || [];
    return records.map(r => r?.error || r?.output || '').filter(Boolean).join('\n---\n');
  }
  if (isTextContent(item)) return String(contentSource(item) || '');
  if (item.kind === 'note') return String(item.text || '');
  if (item.kind === 'value') return `${item.title || id}: ${displayedValue(item) ?? ''}`;
  if (item.kind === 'image') return `이미지: ${item.title || item.filename || item.src || id}`;
  if (item.kind === 'pdf') return `PDF: ${item.filename || item.title || id} (페이지 ${item.pdfPage || 1})`;
  if (item.kind === 'link') return [item.title, item.mediaType ? `형식: ${item.mediaType}` : '', item.url].filter(Boolean).join('\n');
  if (item.kind === 'table' || item.kind === 'chart') {
    const cols = Array.isArray(item.columns) ? item.columns.join(', ') : '';
    return `${item.chartTitle || item.title || '데이터 표'} (${cols})`;
  }
  if (item.kind === 'question') return [item.questionPrompt, item.questionAnswer].filter(Boolean).join('\n');
  return String(item.text || item.title || item.label || '');
}

function pushUniqueFormat(formats, fmt) {
  if (fmt && !formats.includes(fmt)) formats.push(fmt);
}

function collectNodeRecursive(items, nodeId, { freshAgentOutputs, freshRuntimeOutputs, visited, depth, envelopeItems, formats }) {
  const key = String(nodeId);
  if (visited.has(key) || depth > 2) return;
  visited.add(key);
  const item = items?.[key];
  if (!item) return;

  if (isAgentInputItem(item)) {
    const cfg = readAgentInputConfig(item);
    const text = String(item.text || '').trim();
    if (cfg.inputType && cfg.inputType !== 'auto') {
      pushUniqueFormat(formats, cfg.inputType);
    }
    if (text) {
      const parsedTextJson = tryParseJsonPayload(text);
      const textFmt = cfg.inputType && cfg.inputType !== 'auto'
        ? cfg.inputType
        : parsedTextJson !== null
          ? 'json'
          : URL_RE.test(text)
            ? detectFileFormatType('', '', text)
            : 'text';
      pushUniqueFormat(formats, textFmt);
      if (parsedTextJson !== null) pushUniqueFormat(formats, 'json');
      envelopeItems.push({
        id: `${key}:text`,
        sourceId: key,
        title: item.title || '사용자 입력',
        formatType: textFmt,
        mimeType: parsedTextJson !== null ? 'application/json' : '',
        filename: '',
        url: URL_RE.test(text) ? text : '',
        content: text,
        summary: summarizeText(text),
        ...(parsedTextJson !== null ? { parsedJson: parsedTextJson } : {}),
      });
    }
    for (const att of cfg.attachments) {
      const parsedAttJson = att.textSnippet ? tryParseJsonPayload(att.textSnippet) : null;
      const attFmt = att.formatType !== 'text'
        ? att.formatType
        : (parsedAttJson !== null ? 'json' : 'text');
      pushUniqueFormat(formats, attFmt);
      if (parsedAttJson !== null) pushUniqueFormat(formats, 'json');
      const descParts = [
        `첨부(${formatTypeLabel(attFmt)}): ${att.name}`,
        att.mimeType ? `MIME: ${att.mimeType}` : '',
        att.url ? `URL: ${att.url}` : '',
        att.textSnippet || '',
      ].filter(Boolean);
      const content = descParts.join('\n');
      envelopeItems.push({
        id: `${key}:${att.id}`,
        sourceId: key,
        title: att.name,
        formatType: attFmt,
        mimeType: att.mimeType,
        filename: att.name,
        url: att.url || '',
        content,
        summary: summarizeText(content),
        ...(parsedAttJson !== null ? { parsedJson: parsedAttJson } : {}),
      });
    }
    // Also collect objects wired directly into the Input node.
    for (const edge of Object.values(items || {})) {
      if (edge?.kind !== 'connector' || String(edge.to) !== key) continue;
      if (!readAgentEdgeConfig(edge).enabled) continue;
      collectNodeRecursive(items, edge.from, {
        freshAgentOutputs,
        freshRuntimeOutputs,
        visited,
        depth: depth + 1,
        envelopeItems,
        formats,
      });
    }
    return;
  }

  if (isAgentOrchestratorItem(item)) {
    for (const edge of Object.values(items || {})) {
      if (edge?.kind !== 'connector' || String(edge.to) !== key) continue;
      if (!readAgentEdgeConfig(edge).enabled) continue;
      collectNodeRecursive(items, edge.from, {
        freshAgentOutputs,
        freshRuntimeOutputs,
        visited,
        depth: depth + 1,
        envelopeItems,
        formats,
      });
    }
    return;
  }

  const content = describeCanvasItemContent(key, item, { freshAgentOutputs, freshRuntimeOutputs });
  const parsedJson = tryParseJsonPayload(content);
  const fmt = detectItemFormatType(item);
  pushUniqueFormat(formats, fmt);
  if (parsedJson !== null) pushUniqueFormat(formats, 'json');
  const title = itemDisplayTitle(key, item);
  envelopeItems.push({
    id: key,
    sourceId: key,
    title,
    formatType: fmt,
    mimeType: parsedJson !== null ? 'application/json' : '',
    filename: item.filename || '',
    url: item.url || item.src || '',
    content: content || title,
    summary: summarizeText(content || title),
    ...(parsedJson !== null ? { parsedJson } : {}),
  });
}

/**
 * Builds a normalized multimodal input envelope from either a starting node ID
 * (following incoming connectors through Input/Orchestrator nodes) or an explicit
 * list of connection entries.
 */
export function collectInputEnvelope(items = {}, sourceOrEntries, options = {}) {
  const formats = [];
  const envelopeItems = [];
  const visited = new Set();
  for (const entry of options.routedInputs || []) {
    envelopeItems.push(entry);
    pushUniqueFormat(formats, entry.formatType);
    if (entry.parsedJson != null) pushUniqueFormat(formats, 'json');
  }

  if (Array.isArray(sourceOrEntries)) {
    for (const entry of sourceOrEntries) {
      const sid = entry?.sourceId || entry?.otherId;
      if (!sid) continue;
      collectNodeRecursive(items, sid, {
        ...options,
        visited,
        depth: 0,
        envelopeItems,
        formats,
      });
    }
  } else if (sourceOrEntries != null) {
    const startId = String(sourceOrEntries);
    const startItem = items?.[startId];
    if (isAgentInputItem(startItem)) {
      collectNodeRecursive(items, startId, {
        ...options,
        visited,
        depth: 0,
        envelopeItems,
        formats,
      });
    } else {
      visited.add(startId);
      for (const edge of Object.values(items || {})) {
        if (edge?.kind !== 'connector' || String(edge.to) !== startId) continue;
        if (!readAgentEdgeConfig(edge).enabled) continue;
        if (options.routingRouterIds?.has(String(edge.from))) continue;
        collectNodeRecursive(items, edge.from, {
          ...options,
          visited,
          depth: 0,
          envelopeItems,
          formats,
        });
      }
    }
  }

  if (!formats.length && envelopeItems.length) {
    pushUniqueFormat(formats, envelopeItems[0].formatType || 'text');
  }
  const primaryFormat = formats.find(f => f !== 'text') || formats[0] || 'text';
  const jsonPayloads = envelopeItems
    .filter(entry => entry.parsedJson != null)
    .map(entry => ({ item: entry, data: entry.parsedJson }));
  const primaryJson = jsonPayloads[0]?.data ?? null;
  const combinedText = envelopeItems.map(entry => entry.content).filter(Boolean).join('\n\n');
  const textSummary = envelopeItems
    .map(entry => `[${formatTypeLabel(entry.formatType)}] ${entry.title}: ${entry.summary}`)
    .join('\n');

  return {
    formats,
    primaryFormat,
    items: envelopeItems,
    jsonPayloads,
    primaryJson,
    combinedText,
    textSummary,
  };
}

function inferFormatsFromEdgeLabel(label) {
  const text = String(label || '').trim();
  if (!text) return [];
  const matched = [];
  for (const [fmt, re] of LABEL_FORMAT_RULES) {
    if (re.test(text)) matched.push(fmt);
  }
  return matched;
}

export function extractRouterRoutes(items = {}, routerId, routerConfig = null) {
  const key = String(routerId);
  const cfg = routerConfig || readAgentRouterConfig(items[key]);
  const connectors = Object.entries(items)
    .filter(([, item]) => item?.kind === 'connector' && String(item.from) === key && items[String(item.to)])
    .sort(([a], [b]) => a.localeCompare(b));

  const routes = [];
  for (const [connectorId, edge] of connectors) {
    const edgeConfig = readAgentEdgeConfig(edge);
    if (!edgeConfig.enabled) continue;
    const targetId = String(edge.to);
    const targetItem = items[targetId];
    const edgeRoute = readAgentEdgeRouteConfig(edge);
    const savedRule = cfg.routes?.[targetId] || {};

    const formats = edgeRoute.routeFormats.length
      ? edgeRoute.routeFormats
      : (savedRule.formats?.length ? savedRule.formats : inferFormatsFromEdgeLabel(edge.label));
    const keywords = edgeRoute.routeKeywords || savedRule.keywords || '';
    const jsonCondition = edgeRoute.routeJsonCondition || savedRule.jsonCondition || '';
    const description = edgeRoute.routeDescription || savedRule.description || edge.label || '';
    const isDefault = edgeRoute.routeDefault || savedRule.isDefault === true || cfg.defaultTargetId === targetId;
    const priority = edgeRoute.routePriority || savedRule.priority || 0;

    let targetName = targetItem?.title || targetId;
    let targetRole = targetItem?.kind || 'object';
    if (isAgentNodeItem(targetItem)) {
      const nodeCfg = readAgentNodeConfig(targetItem);
      targetName = targetItem.title || nodeCfg.role || targetId;
      targetRole = nodeCfg.role;
    } else if (isAgentRouterItem(targetItem)) {
      targetName = targetItem.title || '하위 라우터';
      targetRole = '라우터';
    } else if (isAgentOutputItem(targetItem) || targetItem?.runtimeRole === 'output') {
      targetName = targetItem.title || '출력 객체';
      targetRole = '출력';
    } else if (isAgentOrchestratorItem(targetItem)) {
      targetName = targetItem.title || '오케스트레이터';
      targetRole = '오케스트레이터';
    }

    routes.push({
      connectorId,
      targetId,
      targetItem,
      targetName,
      targetRole,
      targetKind: isAgentNodeItem(targetItem)
        ? 'agent'
        : isAgentRouterItem(targetItem)
          ? 'router'
          : isAgentOrchestratorItem(targetItem)
            ? 'orchestrator'
            : (isAgentOutputItem(targetItem) || targetItem?.runtimeRole === 'output' ? 'output' : 'object'),
      formats,
      keywords,
      jsonCondition,
      description,
      isDefault,
      priority,
      edge,
      edgeConfig,
    });
  }

  return routes.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const ya = Number(a.targetItem?.y) || 0;
    const yb = Number(b.targetItem?.y) || 0;
    if (ya !== yb) return ya - yb;
    return (Number(a.targetItem?.x) || 0) - (Number(b.targetItem?.x) || 0)
      || a.targetId.localeCompare(b.targetId);
  });
}

function splitKeywords(raw) {
  return String(raw || '')
    .split(/[,;\n]/)
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);
}

export function evaluateFormatRouting(inputEnvelope, routes = [], routerConfig = {}) {
  if (!routes.length) {
    return { matched: false, selectedRoutes: [], routedInputsByTarget: {}, reason: '연결된 라우팅 대상이 없습니다.' };
  }
  const envelopeItems = inputEnvelope?.items || [];
  const detectedFormats = inputEnvelope?.formats?.length ? inputEnvelope.formats : ['text'];
  const combinedLower = String(inputEnvelope?.combinedText || '').toLowerCase();

  const scored = routes.map((route, idx) => {
    const matchedItems = [];
    const matchedFormats = [];
    for (const item of envelopeItems) {
      if (route.formats.includes(item.formatType)) {
        matchedItems.push(item);
        pushUniqueFormat(matchedFormats, item.formatType);
      }
    }
    if (!envelopeItems.length) {
      for (const fmt of detectedFormats) {
        if (route.formats.includes(fmt)) pushUniqueFormat(matchedFormats, fmt);
      }
    }
    const keywords = splitKeywords(route.keywords);
    const matchedKeywords = keywords.filter(kw => combinedLower.includes(kw));

    // Media attachments often accompany a companion text instruction; prioritize media format over generic text.
    const mediaBonus = matchedFormats.some(f => f !== 'text') ? 15 : 0;
    const score = (matchedFormats.length * 10) + mediaBonus + (matchedKeywords.length * 12) + (route.priority || 0) * 0.1;
    return { route, idx, score, matchedItems, matchedFormats, matchedKeywords };
  });

  const hits = scored
    .filter(s => s.matchedFormats.length > 0 || s.matchedKeywords.length > 0)
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  if (!hits.length) {
    return {
      matched: false,
      selectedRoutes: [],
      routedInputsByTarget: {},
      reason: `입력 포맷(${detectedFormats.map(formatTypeLabel).join(', ')})과 일치하는 포맷 규칙이 없습니다.`,
    };
  }

  const chosen = routerConfig.multiMatch === false ? [hits[0]] : hits;
  const selectedRoutes = chosen.map(h => h.route);
  const textItems = envelopeItems.filter(i => i.formatType === 'text');
  const routedInputsByTarget = {};
  for (const h of chosen) {
    const specific = [...h.matchedItems];
    // Include user text instructions alongside routed media so the specialist agent knows what to do with it.
    if (specific.some(i => i.formatType !== 'text')) {
      for (const t of textItems) {
        if (!specific.some(s => s.id === t.id)) specific.push(t);
      }
    }
    routedInputsByTarget[h.route.targetId] = specific.length ? specific : envelopeItems;
  }

  const reasonParts = chosen.map(h => {
    const tags = [
      ...h.matchedFormats.map(formatTypeLabel),
      ...h.matchedKeywords.map(k => `"${k}"`),
    ];
    return `${h.route.targetName}(${tags.join(', ')})`;
  });

  return {
    matched: true,
    selectedRoutes,
    routedInputsByTarget,
    reason: `포맷/규칙 일치: ${reasonParts.join(', ')}`,
  };
}

export function compileRouterPrompt(routerItem, routerConfig, inputEnvelope, routes) {
  const title = routerItem?.title || '라우터 객체';
  const formatsText = (inputEnvelope?.formats || ['text']).map(f => `${f}(${formatTypeLabel(f)})`).join(', ');
  const itemsText = (inputEnvelope?.items || []).slice(0, 12).map((entry, idx) =>
    `${idx + 1}. [${formatTypeLabel(entry.formatType)}/${entry.formatType}] ${entry.title}: ${entry.content.slice(0, 400)}`,
  ).join('\n') || '(입력 내용 없음)';

  const candidatesText = routes.map(route => {
    const parts = [
      `- id: "${route.targetId}"`,
      `이름: "${route.targetName}"`,
      `역할: "${route.targetRole}"`,
      `지원 포맷: ${route.formats.length ? route.formats.join(', ') : '제한 없음'}`,
    ];
    if (route.description) parts.push(`설명: ${route.description}`);
    if (route.keywords) parts.push(`키워드: ${route.keywords}`);
    if (route.jsonCondition) parts.push(`JSON 조건: ${route.jsonCondition}`);
    if (route.isDefault) parts.push('(기본 폴백)');
    return parts.join(' | ');
  }).join('\n');

  const jsonSection = inputEnvelope?.jsonPayloads?.length
    ? [
      '',
      `## [파싱된 JSON 페이로드]`,
      JSON.stringify(
        inputEnvelope.jsonPayloads.length === 1
          ? inputEnvelope.jsonPayloads[0].data
          : inputEnvelope.jsonPayloads.map(p => p.data),
        null,
        2,
      ).slice(0, 1500),
    ]
    : [];

  const multiRule = routerConfig?.allowMultiRoute
    ? '필요하다면 여러 대상을 "targets" 배열에 모두 포함할 수 있습니다.'
    : '가장 적합한 대상 1개만 "targets" 배열에 선택하세요.';

  return [
    `## [라우터 지시사항]`,
    `라우터 이름: ${title}`,
    routerConfig?.routingPrompt || '',
    multiRule,
    '',
    `## [감지된 입력 포맷]`,
    formatsText,
    '',
    `## [입력 데이터 요약]`,
    itemsText,
    ...jsonSection,
    '',
    `## [연결된 후보 대상 목록]`,
    candidatesText,
    '',
    `## [출력 형식]`,
    '반드시 아래 JSON 형식으로만 답하세요:',
    '{"targets":["대상id"],"reason":"선택 이유 한 줄 요약"}',
  ].filter(Boolean).join('\n');
}

function resolveRouteTargetToken(token, routes) {
  const query = String(token || '').trim();
  if (!query) return null;
  const lower = query.toLowerCase();
  return routes.find(r => r.targetId === query)
    || routes.find(r => r.targetName.trim().toLowerCase() === lower)
    || routes.find(r => r.targetRole.trim().toLowerCase() === lower)
    || (() => {
      const partial = routes.filter(r =>
        r.targetName.toLowerCase().includes(lower) || lower.includes(r.targetName.toLowerCase()),
      );
      return partial.length === 1 ? partial[0] : null;
    })();
}

function parseJsonPathTokens(rawPath) {
  if (typeof rawPath !== 'string') return null;
  let pathStr = rawPath.trim();
  if (!pathStr) return null;

  let isMeta = false;
  if (pathStr === '$meta') {
    return { isMeta: true, tokens: [] };
  }
  if (pathStr.startsWith('$meta.') || pathStr.startsWith('$meta[')) {
    isMeta = true;
    pathStr = pathStr.slice(5);
    if (pathStr.startsWith('.')) pathStr = pathStr.slice(1);
  } else if (pathStr.startsWith('$.')) {
    pathStr = pathStr.slice(2);
  } else if (pathStr.startsWith('$[')) {
    pathStr = pathStr.slice(1);
  }

  const tokens = [];
  let i = 0;
  let buf = '';
  const flushBuf = () => {
    if (!buf) return true;
    if (BLOCKED_PATH_KEYS.has(buf)) return false;
    tokens.push(buf);
    buf = '';
    return true;
  };

  while (i < pathStr.length) {
    const ch = pathStr[i];
    if (ch === '.') {
      if (!flushBuf()) return null;
      i += 1;
      continue;
    }
    if (ch === '[') {
      if (!flushBuf()) return null;
      const closeIdx = pathStr.indexOf(']', i + 1);
      if (closeIdx === -1) return null;
      let inner = pathStr.slice(i + 1, closeIdx).trim();
      if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith('\'') && inner.endsWith('\''))) {
        inner = inner.slice(1, -1);
      }
      if (!inner || BLOCKED_PATH_KEYS.has(inner)) return null;
      tokens.push(inner);
      i = closeIdx + 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  if (!flushBuf()) return null;
  if (!tokens.length && !isMeta) return null;
  return { isMeta, tokens };
}

export function getJsonPathValue(root, rawPath, meta = {}) {
  const parsed = parseJsonPathTokens(rawPath);
  if (!parsed) return { exists: false, value: undefined };
  let curr = parsed.isMeta ? meta : root;
  if (parsed.tokens.length === 0) {
    return curr === undefined ? { exists: false, value: undefined } : { exists: true, value: curr };
  }
  for (const tok of parsed.tokens) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return { exists: false, value: undefined };
    }
    if (Array.isArray(curr)) {
      if (!/^\d+$/.test(tok)) return { exists: false, value: undefined };
      const idx = Number(tok);
      if (idx < 0 || idx >= curr.length) return { exists: false, value: undefined };
      curr = curr[idx];
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(curr, tok)) {
      return { exists: false, value: undefined };
    }
    curr = curr[tok];
  }
  return { exists: true, value: curr };
}

function deepEqualJsonValues(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((el, idx) => deepEqualJsonValues(el, b[idx]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqualJsonValues(a[k], b[k]));
}

function normalizeJsonOp(op) {
  const raw = String(op || 'equals').trim().toLowerCase();
  if (raw === '==' || raw === 'eq') return 'equals';
  if (raw === '!=' || raw === '!==' || raw === 'neq') return 'not_equals';
  if (raw === 'includes') return 'contains';
  if (raw === 'missing') return 'not_exists';
  if (raw === '>') return 'gt';
  if (raw === '>=') return 'gte';
  if (raw === '<') return 'lt';
  if (raw === '<=') return 'lte';
  if (raw === '~=' || raw === 'matches') return 'regex';
  return raw;
}

function evaluateLeafJsonCondition(cond, payload, meta) {
  const path = cond.path ?? cond.field ?? cond.key;
  if (typeof path !== 'string' || !path.trim()) return false;
  const op = normalizeJsonOp(cond.op ?? cond.operator ?? 'equals');
  const expected = cond.value;
  const { exists, value } = getJsonPathValue(payload, path, meta);

  switch (op) {
    case 'exists':
      return exists && value !== undefined && value !== null;
    case 'not_exists':
      return !exists || value === undefined || value === null;
    case 'equals':
      return exists && deepEqualJsonValues(value, expected);
    case 'not_equals':
      return !exists || !deepEqualJsonValues(value, expected);
    case 'contains': {
      if (!exists || value === null || value === undefined) return false;
      if (Array.isArray(value)) {
        return value.some(el => deepEqualJsonValues(el, expected)
          || (typeof el === 'string' && typeof expected === 'string' && el.toLowerCase() === expected.toLowerCase()));
      }
      if (typeof value === 'object') {
        return typeof expected === 'string' && Object.prototype.hasOwnProperty.call(value, expected);
      }
      return String(value).toLowerCase().includes(String(expected ?? '').toLowerCase());
    }
    case 'in':
      return exists && Array.isArray(expected) && expected.some(el => deepEqualJsonValues(el, value));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (!exists || value === null || value === '' || typeof value === 'boolean') return false;
      const numVal = Number(value);
      const numExp = Number(expected);
      if (!Number.isFinite(numVal) || !Number.isFinite(numExp)) return false;
      if (op === 'gt') return numVal > numExp;
      if (op === 'gte') return numVal >= numExp;
      if (op === 'lt') return numVal < numExp;
      return numVal <= numExp;
    }
    case 'regex': {
      if (!exists || value === null || value === undefined) return false;
      const pattern = typeof expected === 'string' ? expected : '';
      if (!pattern || pattern.length > 200) return false;
      try {
        const re = new RegExp(pattern, 'i');
        return re.test(typeof value === 'string' ? value : JSON.stringify(value));
      } catch {
        return false;
      }
    }
    case 'type': {
      const targetType = String(expected || '').trim().toLowerCase();
      if (!exists || value === undefined) return targetType === 'undefined';
      if (value === null) return targetType === 'null';
      if (Array.isArray(value)) return targetType === 'array';
      if (typeof value === 'number') return targetType === 'number' && Number.isFinite(value);
      return typeof value === targetType;
    }
    default:
      return false;
  }
}

export function evaluateJsonCondition(cond, payload, meta = {}) {
  if (!cond || typeof cond !== 'object') return false;
  if (Array.isArray(cond)) {
    return cond.length > 0 && cond.every(sub => evaluateJsonCondition(sub, payload, meta));
  }
  if (cond.not && typeof cond.not === 'object') {
    if (evaluateJsonCondition(cond.not, payload, meta)) return false;
    const hasOtherKeys = Boolean(cond.all || cond.any || cond.conditions || cond.when || cond.path || cond.field || cond.key);
    if (!hasOtherKeys) return true;
  }
  if (Array.isArray(cond.all)) {
    return cond.all.length > 0 && cond.all.every(sub => evaluateJsonCondition(sub, payload, meta));
  }
  if (Array.isArray(cond.any)) {
    return cond.any.length > 0 && cond.any.some(sub => evaluateJsonCondition(sub, payload, meta));
  }
  if (Array.isArray(cond.conditions)) {
    if (!cond.conditions.length) return false;
    return cond.match === 'any'
      ? cond.conditions.some(sub => evaluateJsonCondition(sub, payload, meta))
      : cond.conditions.every(sub => evaluateJsonCondition(sub, payload, meta));
  }
  if (cond.when && typeof cond.when === 'object' && !Array.isArray(cond.when)) {
    const entries = Object.entries(cond.when);
    if (!entries.length) return false;
    return entries.every(([pathKey, expected]) => {
      if (BLOCKED_PATH_KEYS.has(pathKey)) return false;
      if (expected && typeof expected === 'object' && !Array.isArray(expected) && ('op' in expected || 'operator' in expected)) {
        return evaluateLeafJsonCondition({ path: pathKey, ...expected }, payload, meta);
      }
      return evaluateLeafJsonCondition({ path: pathKey, op: 'equals', value: expected }, payload, meta);
    });
  }
  return evaluateLeafJsonCondition(cond, payload, meta);
}

function splitTopLevelDelimiter(raw, delimiter) {
  const parts = [];
  let current = '';
  let quote = '';
  let bracketDepth = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && i + 1 < raw.length) {
        current += raw[i + 1];
        i += 1;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '{' || ch === '(') {
      bracketDepth += 1;
      current += ch;
      continue;
    }
    if (ch === ']' || ch === '}' || ch === ')') {
      if (bracketDepth > 0) bracketDepth -= 1;
      current += ch;
      continue;
    }
    if (bracketDepth === 0 && raw.startsWith(delimiter, i)) {
      parts.push(current.trim());
      current = '';
      i += delimiter.length - 1;
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseConditionLiteral(rawVal) {
  const trimmed = String(rawVal || '').trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || trimmed.startsWith('[')
    || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.replace(/^["']|["']$/g, '');
    }
  }
  if (trimmed.startsWith('\'') && trimmed.endsWith('\'')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSingleExpressionAtom(atomRaw) {
  const atom = String(atomRaw || '').trim();
  if (!atom) return null;

  for (const [symbol, op] of [
    ['>=', 'gte'],
    ['<=', 'lte'],
    ['!=', 'not_equals'],
    ['==', 'equals'],
    ['~=', 'regex'],
    ['>', 'gt'],
    ['<', 'lt'],
  ]) {
    const parts = splitTopLevelDelimiter(atom, symbol);
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { path: parts[0], op, value: parseConditionLiteral(parts[1]) };
    }
  }

  const wordMatch = atom.match(/^([^\s]+)\s+(contains|in|regex|matches|type)\s+([\s\S]+)$/i);
  if (wordMatch) {
    return {
      path: wordMatch[1].trim(),
      op: normalizeJsonOp(wordMatch[2]),
      value: parseConditionLiteral(wordMatch[3]),
    };
  }

  if (atom.startsWith('!')) {
    const targetPath = atom.slice(1).trim();
    return targetPath ? { path: targetPath, op: 'not_exists' } : null;
  }
  return { path: atom, op: 'exists' };
}

export function parseEdgeJsonCondition(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return { all: parsed };
      if (!parsed || typeof parsed !== 'object') return { parseError: 'JSON 조건은 객체 또는 배열이어야 합니다.' };
      if ('path' in parsed || 'field' in parsed || 'key' in parsed
        || 'all' in parsed || 'any' in parsed || 'when' in parsed
        || 'conditions' in parsed || 'not' in parsed) {
        return parsed;
      }
      return { when: parsed };
    } catch (err) {
      return { parseError: err?.message || 'JSON 조건 문법 오류' };
    }
  }

  const orBranches = splitTopLevelDelimiter(trimmed, '||').filter(Boolean);
  if (!orBranches.length) return null;
  const compiledBranches = [];
  for (const branch of orBranches) {
    const andParts = splitTopLevelDelimiter(branch, '&&').filter(Boolean);
    const atoms = andParts.map(parseSingleExpressionAtom).filter(Boolean);
    if (!atoms.length) continue;
    compiledBranches.push(atoms.length === 1 ? atoms[0] : { all: atoms });
  }
  if (!compiledBranches.length) return { parseError: '유효한 조건식이 아닙니다.' };
  return compiledBranches.length === 1 ? compiledBranches[0] : { any: compiledBranches };
}

function normalizeRuleCondition(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;
  if (rule.condition && typeof rule.condition === 'object') return rule.condition;
  if (Array.isArray(rule.all)) return { all: rule.all };
  if (Array.isArray(rule.any)) return { any: rule.any };
  if (Array.isArray(rule.conditions)) return { conditions: rule.conditions, match: rule.match === 'any' ? 'any' : 'all' };
  if (rule.when && typeof rule.when === 'object') return { when: rule.when };
  if (typeof (rule.path ?? rule.field ?? rule.key) === 'string') {
    return {
      path: rule.path ?? rule.field ?? rule.key,
      op: rule.op ?? rule.operator ?? 'equals',
      value: rule.value,
    };
  }
  return null;
}

export function parseRouterJsonRules(rawJson) {
  const trimmed = String(rawJson || '').trim();
  if (!trimmed) {
    return { valid: true, error: '', rules: [], match: 'all', defaultTargets: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      valid: false,
      error: err?.message || 'JSON 규칙 문법 오류',
      rules: [],
      match: 'all',
      defaultTargets: [],
    };
  }

  let rawRules = null;
  let match = 'all';
  let defaultTargets = [];
  if (Array.isArray(parsed)) {
    rawRules = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (!Array.isArray(parsed.rules)) {
      return { valid: false, error: '"rules" 배열이 필요합니다.', rules: [], match: 'all', defaultTargets: [] };
    }
    rawRules = parsed.rules;
    match = parsed.match === 'first' ? 'first' : 'all';
    const rawDefs = Array.isArray(parsed.defaultTargets)
      ? parsed.defaultTargets
      : (parsed.defaultTarget ? [parsed.defaultTarget] : []);
    defaultTargets = rawDefs.map(t => String(t || '').trim()).filter(Boolean);
  } else {
    return { valid: false, error: 'JSON 규칙은 배열 또는 {"rules": [...]} 객체여야 합니다.', rules: [], match: 'all', defaultTargets: [] };
  }

  const rules = [];
  for (let idx = 0; idx < rawRules.length; idx += 1) {
    const entry = rawRules[idx];
    const condition = normalizeRuleCondition(entry);
    const rawTargets = Array.isArray(entry?.targets)
      ? entry.targets
      : (entry?.target ? [entry.target] : []);
    const targets = rawTargets.map(t => String(t || '').trim()).filter(Boolean);
    if (!condition || !targets.length) {
      return {
        valid: false,
        error: `${idx + 1}번째 규칙에 조건 또는 targets가 누락되었습니다.`,
        rules: [],
        match: 'all',
        defaultTargets: [],
      };
    }
    rules.push({
      name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `규칙 ${idx + 1}`,
      targets,
      condition,
    });
  }

  return { valid: true, error: '', rules, match, defaultTargets };
}

export function buildStarterJsonRoutingRules(routes = []) {
  const firstTarget = routes[0]?.targetName || routes[0]?.targetId || 'agent-1';
  const secondTarget = routes[1]?.targetName || routes[1]?.targetId || firstTarget;
  return JSON.stringify({
    match: 'first',
    rules: [
      {
        name: '유형 기반 분기',
        path: 'type',
        op: 'equals',
        value: 'billing',
        targets: [firstTarget],
      },
      {
        name: '복합 조건 분기',
        all: [
          { path: 'priority', op: 'gte', value: 2 },
          { path: 'tags', op: 'contains', value: 'urgent' },
        ],
        targets: [secondTarget],
      },
    ],
    defaultTarget: firstTarget,
  }, null, 2);
}

export function evaluateJsonRouting(inputEnvelope, routes = [], routerConfig = {}) {
  if (!routes.length) {
    return { matched: false, selectedRoutes: [], routedInputsByTarget: {}, matchedRules: [], reason: '연결된 라우팅 대상이 없습니다.' };
  }

  const spec = parseRouterJsonRules(routerConfig.jsonRules);
  if (!spec.valid) {
    return {
      matched: false,
      selectedRoutes: [],
      routedInputsByTarget: {},
      matchedRules: [],
      parseError: spec.error,
      reason: `JSON 라우팅 규칙 오류: ${spec.error}`,
    };
  }

  const envelopeItems = inputEnvelope?.items || [];
  const jsonPayloads = inputEnvelope?.jsonPayloads || [];
  const meta = {
    primaryFormat: inputEnvelope?.primaryFormat || 'text',
    formats: inputEnvelope?.formats || ['text'],
    text: inputEnvelope?.combinedText || '',
    count: envelopeItems.length,
    attachments: envelopeItems.filter(i => i.filename).map(i => i.filename),
  };
  const payloadEntries = jsonPayloads.length ? jsonPayloads : [{ item: null, data: null }];
  const textItems = envelopeItems.filter(i => i.formatType === 'text');

  const chosenByTarget = new Map();
  const matchedRules = [];
  const edgeErrors = [];

  const recordTargetMatch = (route, matchedItems, label) => {
    const tid = route.targetId;
    if (!chosenByTarget.has(tid)) {
      chosenByTarget.set(tid, { route, items: [], labels: [] });
    }
    const bucket = chosenByTarget.get(tid);
    for (const mi of matchedItems) {
      if (mi && !bucket.items.some(existing => existing.id === mi.id)) bucket.items.push(mi);
    }
    if (label && !bucket.labels.includes(label)) bucket.labels.push(label);
  };

  for (const rule of spec.rules) {
    const matchedPayloadItems = [];
    let ruleMatched = false;
    for (const entry of payloadEntries) {
      if (evaluateJsonCondition(rule.condition, entry.data, meta)) {
        ruleMatched = true;
        if (entry.item) matchedPayloadItems.push(entry.item);
      }
    }
    if (!ruleMatched) continue;
    let resolvedAny = false;
    for (const token of rule.targets) {
      const route = resolveRouteTargetToken(token, routes);
      if (!route) continue;
      resolvedAny = true;
      recordTargetMatch(route, matchedPayloadItems, rule.name);
    }
    if (resolvedAny) {
      matchedRules.push(rule.name);
      if (spec.match === 'first' || routerConfig.multiMatch === false) break;
    }
  }

  if (!(spec.match === 'first' && chosenByTarget.size > 0)) {
    const allowAdditionalEdges = !(routerConfig.multiMatch === false && chosenByTarget.size > 0);
    if (allowAdditionalEdges) {
      for (const route of routes) {
        if (!route.jsonCondition) continue;
        const parsedCond = parseEdgeJsonCondition(route.jsonCondition);
        if (!parsedCond) continue;
        if (parsedCond.parseError) {
          edgeErrors.push(`${route.targetName}: ${parsedCond.parseError}`);
          continue;
        }
        const matchedPayloadItems = [];
        let edgeMatched = false;
        for (const entry of payloadEntries) {
          if (evaluateJsonCondition(parsedCond, entry.data, meta)) {
            edgeMatched = true;
            if (entry.item) matchedPayloadItems.push(entry.item);
          }
        }
        if (edgeMatched) {
          recordTargetMatch(route, matchedPayloadItems, `${route.targetName}(${route.jsonCondition})`);
          matchedRules.push(`${route.targetName}(JSON 조건)`);
          if (routerConfig.multiMatch === false || spec.match === 'first') break;
        }
      }
    }
  }

  if (chosenByTarget.size === 0 && spec.defaultTargets.length) {
    for (const token of spec.defaultTargets) {
      const route = resolveRouteTargetToken(token, routes);
      if (route) {
        recordTargetMatch(route, envelopeItems, 'JSON 기본 경로');
        matchedRules.push(`기본 경로(${route.targetName})`);
      }
    }
  }

  if (chosenByTarget.size === 0) {
    const errSuffix = edgeErrors.length ? ` (조건식 오류: ${edgeErrors.join('; ')})` : '';
    const baseMsg = jsonPayloads.length
      ? '입력 JSON과 일치하는 라우팅 규칙이 없습니다.'
      : '입력 데이터에서 JSON 페이로드를 찾지 못했거나 일치하는 규칙이 없습니다.';
    return {
      matched: false,
      selectedRoutes: [],
      routedInputsByTarget: {},
      matchedRules: [],
      reason: `${baseMsg}${errSuffix}`,
    };
  }

  const chosenBuckets = [...chosenByTarget.values()];
  const selectedRoutes = chosenBuckets.map(b => b.route);
  const routedInputsByTarget = {};
  for (const bucket of chosenBuckets) {
    const list = [...bucket.items];
    for (const t of textItems) {
      if (!list.some(item => item.id === t.id)) list.push(t);
    }
    routedInputsByTarget[bucket.route.targetId] = list.length ? list : envelopeItems;
  }

  return {
    matched: true,
    selectedRoutes,
    routedInputsByTarget,
    matchedRules,
    reason: `JSON 규칙 일치(${matchedRules.join(', ')}) → ${selectedRoutes.map(r => r.targetName).join(', ')}`,
  };
}

export function parseRouterDecision(rawAnswer, routes = [], allowMultiRoute = false) {
  const text = String(rawAnswer || '').trim();
  const candidates = [];
  let reason = '';
  let parsed = false;

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const rawJson = jsonMatch ? jsonMatch[1].trim() : (text.match(/\{[\s\S]*\}/)?.[0] || '');
  if (rawJson) {
    try {
      const obj = JSON.parse(rawJson);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const rawTargets = Array.isArray(obj.targets)
          ? obj.targets
          : (obj.target ? [obj.target] : []);
        for (const t of rawTargets) {
          const hit = resolveRouteTargetToken(t, routes);
          if (hit && !candidates.some(c => c.targetId === hit.targetId)) candidates.push(hit);
        }
        if (typeof obj.reason === 'string') reason = obj.reason.trim().slice(0, 300);
        if (candidates.length) parsed = true;
      }
    } catch {
      // Fall through to tag/name extraction.
    }
  }

  if (!candidates.length) {
    const tagRe = /\[ROUTE\s*:\s*([^\]]+)\]/gi;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
      const hit = resolveRouteTargetToken(m[1], routes);
      if (hit && !candidates.some(c => c.targetId === hit.targetId)) candidates.push(hit);
    }
    if (candidates.length) {
      parsed = true;
      reason = reason || summarizeText(text.replace(tagRe, ''), 200);
    }
  }

  const selectedRoutes = allowMultiRoute ? candidates : candidates.slice(0, 1);
  return { selectedRoutes, reason, parsed };
}

export function applyRouterFallback(routes = [], routerConfig = {}, baseReason = '') {
  if (!routes.length) {
    return { selectedRoutes: [], reason: baseReason || '연결된 라우팅 대상이 없습니다.', fallbackUsed: true };
  }
  const policy = routerConfig.fallbackPolicy || 'default_target';
  if (policy === 'skip') {
    return {
      selectedRoutes: [],
      reason: `${baseReason ? `${baseReason} · ` : ''}폴백 정책에 따라 실행을 건너뜁니다.`,
      fallbackUsed: true,
    };
  }
  if (policy === 'all') {
    return {
      selectedRoutes: [...routes],
      reason: `${baseReason ? `${baseReason} · ` : ''}폴백: 모든 연결 대상으로 전달`,
      fallbackUsed: true,
    };
  }
  if (policy === 'default_target') {
    const defaults = routes.filter(r => r.isDefault || (routerConfig.defaultTargetId && r.targetId === routerConfig.defaultTargetId));
    if (defaults.length) {
      return {
        selectedRoutes: defaults,
        reason: `${baseReason ? `${baseReason} · ` : ''}기본 경로(${defaults.map(d => d.targetName).join(', ')})로 전달`,
        fallbackUsed: true,
      };
    }
  }
  return {
    selectedRoutes: [routes[0]],
    reason: `${baseReason ? `${baseReason} · ` : ''}기본 첫 경로(${routes[0].targetName})로 전달`,
    fallbackUsed: true,
  };
}

function buildRoutedInputsMap(selectedRoutes, inputEnvelope) {
  const map = {};
  for (const r of selectedRoutes) {
    map[r.targetId] = inputEnvelope?.items || [];
  }
  return map;
}

export async function evaluateAgentRouter({
  items,
  routerId,
  inputEnvelope,
  mock = false,
  executeAgent,
  getAnchor,
  callAgent,
  signal,
  sessionId,
  runId = '',
  onOutput,
}) {
  const id = String(routerId);
  const routerItem = items?.[id];
  if (!isAgentRouterItem(routerItem)) {
    throw new Error('라우터 객체가 필요합니다.');
  }
  const routerConfig = readAgentRouterConfig(routerItem);
  const routes = extractRouterRoutes(items, id, routerConfig);
  const detectedFormats = inputEnvelope?.formats?.length ? inputEnvelope.formats : ['text'];

  if (!routes.length) {
    throw new Error('라우터에 연결된 대상 에이전트 또는 객체가 없습니다.');
  }

  let modeUsed = routerConfig.routingMode;
  let selectedRoutes = [];
  let routedInputsByTarget = {};
  let reason = '';
  let fallbackUsed = false;

  if (routerConfig.routingMode === 'json') {
    const jsonRes = evaluateJsonRouting(inputEnvelope, routes, routerConfig);
    if (jsonRes.matched) {
      return {
        routerId: id,
        runId,
        modeUsed: 'json',
        detectedFormats,
        selectedRoutes: jsonRes.selectedRoutes,
        selectedTargetIds: jsonRes.selectedRoutes.map(r => r.targetId),
        selectedTargetNames: jsonRes.selectedRoutes.map(r => r.targetName),
        routedInputsByTarget: jsonRes.routedInputsByTarget,
        reason: jsonRes.reason,
        fallbackUsed: false,
        updatedAt: Date.now(),
      };
    }
    const fb = applyRouterFallback(routes, routerConfig, jsonRes.reason);
    return {
      routerId: id,
      runId,
      modeUsed: 'json',
      detectedFormats,
      selectedRoutes: fb.selectedRoutes,
      selectedTargetIds: fb.selectedRoutes.map(r => r.targetId),
      selectedTargetNames: fb.selectedRoutes.map(r => r.targetName),
      routedInputsByTarget: buildRoutedInputsMap(fb.selectedRoutes, inputEnvelope),
      reason: fb.reason,
      fallbackUsed: true,
      updatedAt: Date.now(),
    };
  }

  if (routerConfig.routingMode === 'hybrid') {
    const hasJsonConfig = Boolean(
      routerConfig.jsonRules?.trim() || routes.some(r => r.jsonCondition?.trim()),
    );
    if (hasJsonConfig) {
      const jsonRes = evaluateJsonRouting(inputEnvelope, routes, routerConfig);
      if (jsonRes.matched) {
        return {
          routerId: id,
          runId,
          modeUsed: 'json',
          detectedFormats,
          selectedRoutes: jsonRes.selectedRoutes,
          selectedTargetIds: jsonRes.selectedRoutes.map(r => r.targetId),
          selectedTargetNames: jsonRes.selectedRoutes.map(r => r.targetName),
          routedInputsByTarget: jsonRes.routedInputsByTarget,
          reason: jsonRes.reason,
          fallbackUsed: false,
          updatedAt: Date.now(),
        };
      }
    }
  }

  if (routerConfig.routingMode === 'format' || routerConfig.routingMode === 'hybrid') {
    const formatRes = evaluateFormatRouting(inputEnvelope, routes, routerConfig);
    if (formatRes.matched) {
      modeUsed = 'format';
      selectedRoutes = formatRes.selectedRoutes;
      routedInputsByTarget = formatRes.routedInputsByTarget;
      reason = formatRes.reason;
      return {
        routerId: id,
        runId,
        modeUsed,
        detectedFormats,
        selectedRoutes,
        selectedTargetIds: selectedRoutes.map(r => r.targetId),
        selectedTargetNames: selectedRoutes.map(r => r.targetName),
        routedInputsByTarget,
        reason,
        fallbackUsed: false,
        updatedAt: Date.now(),
      };
    }
    if (routerConfig.routingMode === 'format') {
      const fb = applyRouterFallback(routes, routerConfig, formatRes.reason);
      selectedRoutes = fb.selectedRoutes;
      routedInputsByTarget = buildRoutedInputsMap(selectedRoutes, inputEnvelope);
      reason = fb.reason;
      fallbackUsed = true;
      return {
        routerId: id,
        runId,
        modeUsed: 'format',
        detectedFormats,
        selectedRoutes,
        selectedTargetIds: selectedRoutes.map(r => r.targetId),
        selectedTargetNames: selectedRoutes.map(r => r.targetName),
        routedInputsByTarget,
        reason,
        fallbackUsed,
        updatedAt: Date.now(),
      };
    }
  }

  // Intelligent routing (or hybrid fallback when format rules didn't match).
  modeUsed = 'intelligent';
  const prompt = compileRouterPrompt(routerItem, routerConfig, inputEnvelope, routes);
  const selectedIds = (inputEnvelope?.items || [])
    .map(entry => entry.sourceId)
    .filter((sid, idx, arr) => sid && arr.indexOf(sid) === idx && items[sid])
    .slice(0, 20);

  const payload = {
    operation: 'run',
    message: prompt,
    selected_ids: selectedIds,
    anchor: getAnchor?.(id) ?? null,
    include_history: false,
    allow_delete: false,
    options: agentModelOptions(routerConfig),
    turn_id: globalThis.crypto?.randomUUID?.() || `${runId || 'route'}-${id}`,
    ...(sessionId ? { session_id: sessionId } : {}),
  };

  let answer = '';
  if (mock) {
    // A mock run exercises the configured fallback when rules require a model.
    answer = '';
  } else if (typeof callAgent === 'function') {
    const res = await callAgent(payload, onOutput);
    answer = String(res?.answer ?? res?.output ?? res?.message ?? '');
  } else if (typeof executeAgent === 'function') {
    const makeAbortError = () => {
      const abortErr = new Error('라우팅 작업이 중지되었습니다.');
      abortErr.name = 'AbortError';
      abortErr.code = 'AGENT_ABORTED';
      return abortErr;
    };
    if (signal?.aborted) throw makeAbortError();
    let onAbort = null;
    try {
      const reqPromise = Promise.resolve(executeAgent(payload, onOutput, signal));
      reqPromise.catch(() => {});
      const res = await new Promise((resolve, reject) => {
        onAbort = () => {
          reject(makeAbortError());
        };
        signal?.addEventListener?.('abort', onAbort, { once: true });
        reqPromise.then(resolve, reject);
      });
      answer = String(res?.answer ?? res?.output ?? res?.message ?? '');
    } finally {
      if (onAbort) signal?.removeEventListener?.('abort', onAbort);
    }
  } else {
    throw new Error('지능형 라우팅을 실행할 에이전트 연결이 없습니다.');
  }

  if (signal?.aborted) {
    const abortErr = new Error('라우팅 작업이 중지되었습니다.');
    abortErr.name = 'AbortError';
    abortErr.code = 'AGENT_ABORTED';
    throw abortErr;
  }

  const parsedDecision = parseRouterDecision(answer, routes, routerConfig.allowMultiRoute);
  if (parsedDecision.parsed && parsedDecision.selectedRoutes.length) {
    selectedRoutes = parsedDecision.selectedRoutes;
    routedInputsByTarget = buildRoutedInputsMap(selectedRoutes, inputEnvelope);
    reason = parsedDecision.reason || `지능형 라우팅: ${selectedRoutes.map(r => r.targetName).join(', ')}`;
  } else {
    const fb = applyRouterFallback(routes, routerConfig, mock
      ? '모형 실행에서는 지능형 판단 대신 미일치 정책을 적용합니다.'
      : '지능형 라우팅 응답에서 유효한 대상을 해석하지 못했습니다');
    selectedRoutes = fb.selectedRoutes;
    routedInputsByTarget = buildRoutedInputsMap(selectedRoutes, inputEnvelope);
    reason = fb.reason;
    fallbackUsed = true;
  }

  return {
    routerId: id,
    runId,
    modeUsed,
    detectedFormats,
    selectedRoutes,
    selectedTargetIds: selectedRoutes.map(r => r.targetId),
    selectedTargetNames: selectedRoutes.map(r => r.targetName),
    routedInputsByTarget,
    reason,
    fallbackUsed,
    updatedAt: Date.now(),
  };
}
