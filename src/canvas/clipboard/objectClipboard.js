import { createId } from '../canvasIds.js';
import { CANVAS_SPACE } from '../canvasSpace.js';
import { exportManifest, planManifest } from '../asCode/manifest.js';
import { objectBounds } from '../../components/CanvasSpatialBTree.js';

export const CLIPBOARD_TYPE = 'frelog.canvas.objects';
const MAX_ITEMS = 1000, MAX_BYTES = 16 * 1024 * 1024;
let localCopy = '';
export const rememberObjects = text => { localCopy = text; };
export const rememberedObjects = () => localCopy;

export function captureObjects(items, selectedIds, canvasId, cut = false) {
  const ids = new Set(selectedIds.map(String).filter(id => items[id] && items[id].type !== 'chat_room'));
  if (!ids.size) return null;
  for (const [id, item] of Object.entries(items)) {
    if (item.kind === 'connector' && ((ids.has(String(item.from)) && ids.has(String(item.to))) || (cut && (ids.has(String(item.from)) || ids.has(String(item.to)))))) ids.add(id);
  }
  if (ids.size > MAX_ITEMS) throw new Error('한 번에 최대 1,000개 객체를 복사할 수 있습니다.');
  const chosen = Object.fromEntries([...ids].map(id => [id, items[id]]));
  const bounds = Object.values(chosen).filter(item => item.kind !== 'connector').map(item => objectBounds(item, items, CANVAS_SPACE.width, CANVAS_SPACE.height));
  const anchor = bounds.length ? {
    x: (Math.min(...bounds.map(b => b.minX)) + Math.max(...bounds.map(b => b.maxX))) / 2 * CANVAS_SPACE.width,
    y: (Math.min(...bounds.map(b => b.minY)) + Math.max(...bounds.map(b => b.maxY))) / 2 * CANVAS_SPACE.height,
  } : { x: 0, y: 0 };
  const payload = { type: CLIPBOARD_TYPE, version: 1, canvasId: String(canvasId), anchor, items: exportManifest(chosen).items };
  const text = JSON.stringify(payload);
  if (text.length > MAX_BYTES) throw new Error('복사할 데이터가 너무 큽니다. 선택한 객체 수를 줄여주세요.');
  return { text, originals: chosen };
}

export function preparePaste(text, current, canvasId, permission, point, repeat = 0) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('클립보드 데이터가 너무 큽니다.');
  let payload;
  try { payload = JSON.parse(text); } catch { return null; }
  if (payload?.type !== CLIPBOARD_TYPE) return null;
  if (payload.version !== 1 || !payload.items || Array.isArray(payload.items) || typeof payload.items !== 'object') throw new Error('지원하지 않는 객체 클립보드 형식입니다.');
  const entries = Object.entries(payload.items);
  if (!entries.length || entries.length > MAX_ITEMS) throw new Error('클립보드 객체 수가 올바르지 않습니다.');
  const ids = new Map(entries.map(([id]) => [id, createId()])), groups = new Map();
  const anchor = payload.anchor;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) throw new Error('클립보드 좌표가 올바르지 않습니다.');
  const dx = point.x * CANVAS_SPACE.width - anchor.x + 24 * (repeat + 1);
  const dy = point.y * CANVAS_SPACE.height - anchor.y + 24 * (repeat + 1);
  const definitions = {};
  let skipped = 0;
  for (const [id, definition] of entries) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('올바르지 않은 객체입니다.');
    const item = JSON.parse(JSON.stringify(definition));
    item.permission = permission;
    if (item.groupId) {
      if (!groups.has(item.groupId)) groups.set(item.groupId, createId());
      item.groupId = groups.get(item.groupId);
    } else { delete item.groupId; }
    if (item.kind === 'connector') {
      const resolve = endpoint => ids.get(String(endpoint)) || (String(payload.canvasId) === String(canvasId) && current[String(endpoint)] ? String(endpoint) : null);
      item.from = resolve(item.from); item.to = resolve(item.to);
      if (!item.from || !item.to) { skipped++; continue; }
    } else if (item.kind === 'stroke') {
      if (!Array.isArray(item.points)) throw new Error('드로잉 좌표가 올바르지 않습니다.');
      item.points = item.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
    } else { item.x += dx; item.y += dy; }
    definitions[ids.get(id)] = item;
  }
  // Validate the new objects and referenced endpoints without inspecting unrelated connections.
  const endpoints = Object.fromEntries(Object.entries(current).filter(([, item]) => item.kind !== 'connector'));
  const plan = planManifest({ version: 1, mode: 'merge', items: definitions, remove: [] }, endpoints, permission);
  return { creates: plan.creates.sort((a, b) => Number(a.item.kind === 'connector') - Number(b.item.kind === 'connector')), skipped };
}
