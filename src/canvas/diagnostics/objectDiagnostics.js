import { changedItemIds } from '../itemSnapshots.js';
import { connectorGeometry } from '../../components/connectorGeometry.js';
import { objectBounds } from '../../components/CanvasSpatialBTree.js';
import { CANVAS_SPACE } from '../canvasSpace.js';
const kinds = new Set(['image','link','code','note','table','chart','shape','text','math','stroke','connector','pdf','user-group']);
export const finiteBounds = bounds => bounds && Object.values(bounds).every(Number.isFinite) && bounds.maxX >= bounds.minX && bounds.maxY >= bounds.minY;
export function createObjectDiagnostics() { return {items:null,reasons:new Map(),geometry:-1,value:[]}; }
export function updateObjectDiagnostics(current, items, spatialIndex) {
  const changed=changedItemIds(current.items,items),dirty=new Set(changed===null?Object.keys(items):changed);
  if(current.geometry!==spatialIndex?.stats.boundsCalculated) {
    // null denotes a full spatial rebuild, not an empty change set. Recheck
    // geometry-dependent warnings even when no item object changed.
    for(const id of spatialIndex?.changedIds ?? Object.keys(items))dirty.add(id);
  }
  if(changed===null)current.reasons.clear();
  let modified=changed===null;
  for(const id of dirty){const item=items[id];
    if(!item){if(current.reasons.delete(id))modified=true;continue;}
    if (item?.type === 'chat_room') continue;
    let reason;
    if (!item || !kinds.has(item.kind)) reason = '지원하지 않는 객체 형식';
    else if (item.kind === 'connector' && (!items[item.from] || !items[item.to] || String(item.from) === String(item.to))) reason = '연결 대상이 없거나 잘못된 화살표';
    else if (item.kind === 'connector') {
      try { if (!connectorGeometry(item, items, CANVAS_SPACE.width, CANVAS_SPACE.height)) reason = '객체가 겹치거나 경로를 계산할 수 없는 화살표'; }
      catch { reason = '계산할 수 없는 화살표 정보'; }
    }
    else if (item.kind === 'stroke' && !item.points?.length) reason = '좌표가 없는 드로잉';
    else {
      try { if (!finiteBounds(spatialIndex ? spatialIndex.entries.get(id)?.bounds : objectBounds(item, items, CANVAS_SPACE.width, CANVAS_SPACE.height))) reason = '비정상 좌표 또는 크기'; }
      catch { reason = '계산할 수 없는 객체 정보'; }
    }
    if(reason!==current.reasons.get(id)){modified=true;if(reason)current.reasons.set(id,reason);else current.reasons.delete(id);}
  }
  if(modified)current.value=[...current.reasons].map(([id,reason])=>({id,reason}));
  current.items=items;current.geometry=spatialIndex?.stats.boundsCalculated;
  return current.value;
}
