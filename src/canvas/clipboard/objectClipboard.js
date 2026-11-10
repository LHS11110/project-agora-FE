import {orderProjectCreates} from '../projects/projectModel.js';
import { createId } from '../canvasIds.js';
import { CANVAS_SPACE } from '../canvasSpace.js';
import { exportManifest, planManifest } from '../asCode/manifest.js';
import { objectBounds } from '../../components/CanvasSpatialBTree.js';

export const CLIPBOARD_TYPE = 'frelog.canvas.objects';
export const MAX_COPY_ITEMS=10000,MAX_COPY_BYTES=16*1024*1024;
const MAX_ITEMS=MAX_COPY_ITEMS,MAX_BYTES=MAX_COPY_BYTES;
let localCopy = '',localOnly=false;
export const rememberObjects = (text,internalOnly=false) => { localCopy=text;localOnly=internalOnly; };
export const hasLocalOnlyObjects=()=>localOnly;
export const rememberedObjects = () => localCopy;

export function collectCopyObjects(items,selectedIds,canvasId,cut=false,connectionIndex=null){
 const ids=new Set(selectedIds.map(String).filter(id=>items[id]&&items[id].type!=='chat_room'));
 if(!ids.size)return null;
 if(ids.size>MAX_ITEMS)throw Error('한 번에 최대 10,000개 객체를 복사할 수 있습니다.');
 const candidates=connectionIndex?connectionIndex.update(items).iterate([...ids]):Object.keys(items);
 for(const id of candidates){const item=items[id];if(item?.kind==='connector'&&((ids.has(String(item.from))&&ids.has(String(item.to)))||(cut&&(ids.has(String(item.from))||ids.has(String(item.to)))))){ids.add(id);if(ids.size>MAX_ITEMS)throw Error('한 번에 최대 10,000개 객체를 복사할 수 있습니다.');}}
 if(cut&&[...ids].some(id=>items[id]?.locked===true))throw Error('잠긴 객체는 잘라낼 수 없습니다. 복사를 사용해주세요.');
 if(ids.size>MAX_ITEMS)throw Error('한 번에 최대 10,000개 객체를 복사할 수 있습니다.');
 return {canvasId:String(canvasId),originals:Object.fromEntries([...ids].map(id=>[id,items[id]]))};
}
export function serializeCopyObjects(snapshot,boundsById={}){
 const chosen=snapshot.originals;
 const bounds=Object.entries(chosen).filter(([,item])=>item.kind!=='connector').map(([id,item])=>boundsById[id]||objectBounds(item,chosen,CANVAS_SPACE.width,CANVAS_SPACE.height));
 const anchor=bounds.length?{x:(Math.min(...bounds.map(b=>b.minX))+Math.max(...bounds.map(b=>b.maxX)))/2*CANVAS_SPACE.width,y:(Math.min(...bounds.map(b=>b.minY))+Math.max(...bounds.map(b=>b.maxY)))/2*CANVAS_SPACE.height}:{x:0,y:0};
 const text=JSON.stringify({type:CLIPBOARD_TYPE,version:1,canvasId:snapshot.canvasId,anchor,items:exportManifest(chosen).items});
 if(text.length>MAX_BYTES)throw Error('복사할 데이터가 너무 큽니다. 선택한 객체 수를 줄여주세요.');
 return {...snapshot,text};
}
export function captureObjects(items,selectedIds,canvasId,cut=false,connectionIndex=null){
 const snapshot=collectCopyObjects(items,selectedIds,canvasId,cut,connectionIndex);return snapshot?serializeCopyObjects(snapshot):null;
}

export function preparePaste(text, current, canvasId, permission, point, repeat = 0) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('클립보드 데이터가 너무 큽니다.');
  let payload;
  try { payload = JSON.parse(text); } catch { return null; }
  if (payload?.type !== CLIPBOARD_TYPE) return null;
  if (payload.version !== 1 || !payload.items || Array.isArray(payload.items) || typeof payload.items !== 'object') throw new Error('지원하지 않는 객체 클립보드 형식입니다.');
  return preparePastePayload(payload,current,canvasId,permission,point,repeat);
}

export function preparePastePayload(payload, current, canvasId, permission, point, repeat=0){
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
    delete item.runtimeState;
    delete item.animationPlayback;
    if (item.groupId) {
      if (!groups.has(item.groupId)) groups.set(item.groupId, createId());
      item.groupId = groups.get(item.groupId);
    } else { delete item.groupId; }
    if(item.kind==='project'&&item.projectType==='issue'){
      const same=String(payload.canvasId)===String(canvasId),copiedBoard=ids.has(String(item.projectBoard));
      const resolve=ref=>ids.get(String(ref))||(!copiedBoard&&same&&Object.hasOwn(current,String(ref))?String(ref):'');
      item.projectBoard=ids.get(String(item.projectBoard))||(same&&Object.hasOwn(current,String(item.projectBoard))?String(item.projectBoard):'');
      if(!item.projectBoard){skipped++;continue;}
      item.projectParent=resolve(item.projectParent);item.projectDependencies=item.projectDependencies.map(resolve).filter(Boolean);
      if(item.projectIssueType==='Sub-task'&&!item.projectParent){skipped++;continue;}
      item.projectHistory=[];
    }
    if (item.kind === 'connector') {
      const resolve = endpoint => ids.get(String(endpoint)) || (String(payload.canvasId) === String(canvasId) && Object.hasOwn(current,String(endpoint)) ? String(endpoint) : null);
      item.from = resolve(item.from); item.to = resolve(item.to);
      if (!item.from || !item.to) { skipped++; continue; }
    } else if (item.kind === 'stroke') {
      if (!Array.isArray(item.points)) throw new Error('드로잉 좌표가 올바르지 않습니다.');
      item.points = item.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
    } else { item.x += dx; item.y += dy; }
    definitions[ids.get(id)] = item;
  }
  // Validate the new objects and referenced endpoints without inspecting unrelated connections.
  const references=new Set();for(const item of Object.values(definitions))if(item.kind==='connector')for(const endpoint of [item.from,item.to])if(!Object.hasOwn(definitions,endpoint)&&Object.hasOwn(current,endpoint))references.add(endpoint);
  const endpoints=Object.fromEntries([...references].map(id=>[id,{kind:current[id].kind==='stroke'||current[id].kind==='connector'?current[id].kind:'shape',...(current[id].shapeType?{shapeType:current[id].shapeType}:{})}]));
  // Endpoint markers avoid scanning or serializing unrelated canvas contents.
  const plan = planManifest({ version: 1, mode: 'merge', items: definitions, remove: [] }, endpoints, permission);
  return { creates:orderProjectCreates(plan.creates), skipped };
}
