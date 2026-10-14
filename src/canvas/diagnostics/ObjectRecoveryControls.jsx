import { useRef } from 'react';
import { changedItemIds } from '../itemSnapshots.js';
import { connectorGeometry } from '../../components/connectorGeometry.js';
import { objectBounds } from '../../components/CanvasSpatialBTree.js';
import { CANVAS_SPACE } from '../canvasSpace.js';
import './object-recovery.css';
const kinds = new Set(['image','link','code','note','table','shape','text','math','stroke','connector','pdf','user-group']);
export const finiteBounds = bounds => bounds && Object.values(bounds).every(Number.isFinite) && bounds.maxX >= bounds.minX && bounds.maxY >= bounds.minY;
export default function ObjectRecoveryControls({ items, spatialIndex, onDelete }) {
  const cache=useRef({items:null,reasons:new Map(),geometry:-1,value:[]});
  const changed=changedItemIds(cache.current.items,items),dirty=new Set(changed===null?Object.keys(items):changed);
  if(cache.current.geometry!==spatialIndex?.stats.boundsCalculated)for(const id of spatialIndex?.changedIds||[])dirty.add(id);
  if(changed===null)cache.current.reasons.clear();
  let modified=changed===null;
  for(const id of dirty){const item=items[id];
    if(!item){if(cache.current.reasons.delete(id))modified=true;continue;}
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
    if(reason!==cache.current.reasons.get(id)){modified=true;if(reason)cache.current.reasons.set(id,reason);else cache.current.reasons.delete(id);}
  }
  if(modified)cache.current.value=[...cache.current.reasons].map(([id,reason])=>({id,reason}));
  cache.current.items=items;cache.current.geometry=spatialIndex?.stats.boundsCalculated;
  const problems=cache.current.value;
  if (!problems.length) return null;
  return <section className="inspector-section object-recovery"><strong className="inspector-label">표시 문제 객체 · {problems.length}개</strong><small className="inspector-hint">화면에서 조작할 수 없는 객체를 여기서 정리할 수 있습니다.</small>{problems.map(({ id, reason }) => <div key={id}><span><strong>{reason}</strong><code title={id}>{id}</code></span><button type="button" onClick={() => onDelete(id)} aria-label={`${id} 문제 객체 삭제`}>삭제</button></div>)}</section>;
}
