import { CANVAS_SPACE } from '../canvasSpace.js';

const KINDS = new Set(['text', 'note', 'code', 'math', 'shape', 'table', 'image', 'link', 'connector', 'stroke']);
const NUMBERS = new Set(['x', 'y', 'width', 'height', 'rotation', 'fontSize', 'strokeWidth', 'bend', 'opacity', 'contentScale', 'contentScaleX', 'contentScaleY']);
const STRINGS = new Set(['kind', 'text', 'code', 'formula', 'format', 'filename', 'language', 'shapeType', 'color', 'permission', 'groupId', 'src', 'url', 'title', 'mediaType', 'from', 'to', 'startHead', 'endHead', 'brush', 'embedUrl', 'videoId']);
const FIELDS = new Set([...NUMBERS, ...STRINGS, 'points', 'rows', 'columns', 'simulatePressure', 'complete']);
const unsafeId = id => !id || ['__proto__', 'constructor', 'prototype'].includes(id);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function convert(item, direction) {
  const result = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => FIELDS.has(key)))));
  for (const key of ['x', 'y', 'width', 'height']) {
    if (result[key] != null) {
      const size = ['x', 'width'].includes(key) ? CANVAS_SPACE.width : CANVAS_SPACE.height;
      result[key] = direction === 'export' ? Number((result[key] * size).toFixed(6)) : result[key] / size;
    }
  }
  if (result.points) result.points = result.points.map(point => ({ ...point,
    x: direction === 'export' ? Number((point.x * CANVAS_SPACE.width).toFixed(6)) : point.x / CANVAS_SPACE.width,
    y: direction === 'export' ? Number((point.y * CANVAS_SPACE.height).toFixed(6)) : point.y / CANVAS_SPACE.height,
  }));
  return result;
}
export function exportManifest(items) {
  return { version: 1, mode: 'merge', canvas: { ...CANVAS_SPACE }, items: Object.fromEntries(Object.entries(items).map(([id, item]) => [id, convert(item, 'export')])), remove: [] };
}
function validateItem(id, item) {
  if (unsafeId(id) || !plain(item)) fail(`${id}: 올바른 객체 ID와 객체 정의가 필요합니다.`);
  if (!KINDS.has(item.kind)) fail(`${id}: 지원하지 않는 kind입니다.`);
  for (const [key, value] of Object.entries(item)) {
    if (!FIELDS.has(key)) fail(`${id}.${key}: 지원하지 않는 필드입니다.`);
    if (NUMBERS.has(key) && (typeof value !== 'number' || !Number.isFinite(value))) fail(`${id}.${key}: 유한한 숫자가 필요합니다.`);
    if (STRINGS.has(key) && typeof value !== 'string') fail(`${id}.${key}: 문자열이 필요합니다.`);
  }
  for (const key of ['width', 'height', 'fontSize', 'strokeWidth', 'contentScale', 'contentScaleX', 'contentScaleY']) if (item[key] != null && item[key] <= 0) fail(`${id}.${key}: 0보다 커야 합니다.`);
  if (item.opacity != null && (item.opacity < 0 || item.opacity > 1)) fail(`${id}.opacity: 0~1 사이의 값이 필요합니다.`);
  if (item.complete != null && typeof item.complete !== 'boolean') fail(`${id}.complete: boolean이 필요합니다.`);
  if (item.simulatePressure != null && typeof item.simulatePressure !== 'boolean') fail(`${id}.simulatePressure: boolean이 필요합니다.`);
  if (item.points != null && (!Array.isArray(item.points) || item.points.some(p => !plain(p) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || (p.pressure != null && (!Number.isFinite(p.pressure) || p.pressure < 0 || p.pressure > 1))))) fail(`${id}.points: x, y와 선택적인 pressure(0~1)가 필요합니다.`);
  if (item.kind === 'stroke' && !item.points?.length) fail(`${id}: 드로잉에는 points가 필요합니다.`);
  if (item.kind === 'table' && (!Array.isArray(item.columns) || !item.columns.length || item.columns.length > 30 || item.columns.some(v => typeof v !== 'string') || !Array.isArray(item.rows) || !item.rows.length || item.rows.length > 100 || item.rows.some(row => !Array.isArray(row) || row.length !== item.columns.length || row.some(v => typeof v !== 'string')))) fail(`${id}: 표의 columns와 rows를 같은 열 수의 문자열 배열로 작성해주세요(최대 100행, 30열).`);
}
export function planManifest(source, currentItems, permission) {
  let manifest;
  try { manifest = typeof source === 'string' ? JSON.parse(source) : source; } catch (error) { fail(`JSON 문법 오류: ${error.message}`); }
  if (!plain(manifest) || manifest.version !== 1 || !plain(manifest.items)) fail('version: 1과 items 객체가 필요합니다.');
  for (const key of Object.keys(manifest)) if (!['version', 'mode', 'canvas', 'items', 'remove'].includes(key)) fail(`${key}: 지원하지 않는 최상위 필드입니다.`);
  const mode = manifest.mode || 'merge';
  if (!['merge', 'replace'].includes(mode)) fail('mode는 merge 또는 replace입니다.');
  if (manifest.canvas && (manifest.canvas.width !== CANVAS_SPACE.width || manifest.canvas.height !== CANVAS_SPACE.height)) fail('캔버스 공간은 1600 × 1000으로 고정되어 있습니다.');
  const remove = manifest.remove || [];
  if (!Array.isArray(remove) || remove.some(id => typeof id !== 'string' || unsafeId(id))) fail('remove는 삭제할 ID의 문자열 배열입니다.');
  const definitions = Object.entries(manifest.items);
  const deletes = new Set(remove.filter(id => Object.hasOwn(currentItems, id)));
  if (mode === 'replace') Object.keys(currentItems).forEach(id => { if (!Object.hasOwn(manifest.items, id)) deletes.add(id); });
  const creates = [], updates = [];
  const desired = { ...currentItems };
  deletes.forEach(id => { delete desired[id]; });
  for (const [id, definition] of definitions) {
    if (remove.includes(id)) fail(`${id}: items와 remove에 동시에 지정할 수 없습니다.`);
    const previous = Object.hasOwn(currentItems, id) ? currentItems[id] : null;
    if (!plain(definition)) fail(`${id}: 객체 정의가 필요합니다.`);
    const merged = { ...(previous ? convert(previous, 'export') : { permission }), ...definition };
    validateItem(id, merged);
    if (previous && previous.kind !== merged.kind) fail(`${id}: 기존 kind 변경은 새 ID로 생성해주세요.`);
    if (!['connector', 'stroke'].includes(merged.kind) && (!Number.isFinite(merged.x) || !Number.isFinite(merged.y))) fail(`${id}: x, y 좌표가 필요합니다.`);
    const item = convert(merged, 'import');
    desired[id] = item;
    if (!previous) creates.push({ id, item });
    else if (stable(convert(previous, 'export')) !== stable(merged)) updates.push({ id, item });
  }
  for (const [id, item] of Object.entries(desired)) if (item.kind === 'connector' && (!Object.hasOwn(desired, item.from) || !Object.hasOwn(desired, item.to) || ['connector', 'stroke'].includes(desired[item.from]?.kind) || ['connector', 'stroke'].includes(desired[item.to]?.kind))) fail(`${id}: 연결의 from/to는 남아 있는 일반 객체 ID여야 합니다. 연결도 함께 삭제해주세요.`);
  const touched = [...creates, ...updates].map(entry => entry.id).concat([...deletes]);
  return { creates, updates, deletes: [...deletes], baseline: Object.fromEntries([...new Set([...Object.keys(currentItems), ...touched])].map(id => [id, stable(currentItems[id] ? convert(currentItems[id], 'export') : null)])), existingIds: Object.keys(currentItems).sort(), mode };
}
export function assertPlanCurrent(plan, items) {
  if (stable(Object.keys(items).sort()) !== stable(plan.existingIds) || Object.entries(plan.baseline).some(([id, value]) => stable(items[id] ? convert(items[id], 'export') : null) !== value)) fail('검토 후 객체가 변경되었습니다. 변경 검토를 다시 실행해주세요.');
}
export const exampleManifest = {
  version: 1, mode: 'merge', canvas: { ...CANVAS_SPACE }, items: {
    'iac-title': { kind: 'text', x: 160, y: 120, width: 400, fontSize: 26, format: 'markdown', text: '# Canvas as Code\n객체와 연결을 코드로 관리합니다.' },
    'iac-service': { kind: 'code', x: 760, y: 180, width: 460, height: 260, filename: 'hello.py', language: 'python', code: 'print("Hello, FreLog!")' },
    'iac-link': { kind: 'connector', bend: 0, from: 'iac-title', to: 'iac-service', color: '#617d68', strokeWidth: 2, endHead: 'triangle' },
  }, remove: [],
};
