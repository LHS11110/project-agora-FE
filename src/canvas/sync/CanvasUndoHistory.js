import { captureCollaborativeUndo, undoCollaborativeChanges } from './collaborativeUndo.js';
import { isCollaborativeItem, collaborativeField } from '../collaborativeSync.js';
import { loadItemDoc } from '../host/hostOperations.js';
import { textColorRanges } from '../content/textColors.js';
import { CANVAS_ITEM_FIELDS, sameStable } from '../asCode/manifest.js';
import { changeItems } from '../itemSnapshots.js';
const ignored = new Set(['automerge_snapshot', 'automerge_changes', 'runtimeResults']);
const colors='__undoColors';
const snapshot=item=>item?.kind==='text'?{...item,[colors]:textColorRanges(item)}:item;
const clean=item=>{const result={...item};delete result[colors];return result;};
const fieldsToCheck=[...CANVAS_ITEM_FIELDS].filter(k=>!ignored.has(k));
const same = (a, b) => a === b ? true : (a == null || b == null || (typeof a !== 'object' && typeof b !== 'object' && !Number.isNaN(a) && !Number.isNaN(b))) ? false : sameStable(a, b);

// History has no count limit, so stroke versions that are no longer on the canvas
// (before a move, erase or redraw) would keep every point object alive. Older
// entries store those points as exact Float64 triples and rebuild them on undo.
const PACKED = '__undoPackedPoints', KEEP_RECENT = 8, PACK_MIN_POINTS = 16;
const packedCache = new WeakMap(), unpackedCache = new WeakMap();
export function packStrokeSnapshot(item) {
  if (item?.kind !== 'stroke' || !Array.isArray(item.points) || item.points.length < PACK_MIN_POINTS) return item;
  const cached = packedCache.get(item); if (cached) return cached;
  const points = item.points, data = new Float64Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point || typeof point !== 'object' || Object.getPrototypeOf(point) !== Object.prototype) return item;
    let keys = 0;
    for (const key in point) { keys++; if (key !== 'x' && key !== 'y' && key !== 'pressure') return item; }
    const hasPressure = Object.hasOwn(point, 'pressure');
    if (keys !== (hasPressure ? 3 : 2) || typeof point.x !== 'number' || typeof point.y !== 'number' || (hasPressure && (typeof point.pressure !== 'number' || Number.isNaN(point.pressure)))) return item;
    data[i * 3] = point.x; data[i * 3 + 1] = point.y; data[i * 3 + 2] = hasPressure ? point.pressure : NaN;
  }
  const packed = { ...item, [PACKED]: data }; delete packed.points;
  packedCache.set(item, packed);
  return packed;
}
export function unpackStrokeSnapshot(item) {
  if (!item || !item[PACKED]) return item;
  const cached = unpackedCache.get(item); if (cached) return cached;
  const { [PACKED]: data, ...rest } = item;
  if (!Array.isArray(rest.points)) {
    const points = new Array(data.length / 3);
    for (let i = 0; i < points.length; i++) {
      const pressure = data[i * 3 + 2];
      points[i] = Number.isNaN(pressure) ? { x: data[i * 3], y: data[i * 3 + 1] } : { x: data[i * 3], y: data[i * 3 + 1], pressure };
    }
    rest.points = points;
  }
  unpackedCache.set(item, rest);
  return rest;
}

// Sparse local history: retain touched objects, never entire canvas snapshots.
export class CanvasUndoHistory {
  constructor() { this.entries=[]; this.group=null; this.gesture=false; this.aliases=new Map(); this.compacted=0; this.byId=new Map(); }
  packChange(entry, id, live) {
    const change = entry.changes.get(id);
    const before = change.before && change.before !== live ? packStrokeSnapshot(change.before) : change.before;
    const after = change.after && change.after !== live ? packStrokeSnapshot(change.after) : change.after;
    if (before !== change.before || after !== change.after) entry.changes.set(id, { ...change, before, after });
  }
  // Pack stroke versions in entries older than the most recent few. `current` is
  // the whole working snapshot; versions still shown on the canvas stay shared.
  // When an object changes again, its older (already packed) entries may hold
  // the version that just left the canvas, so revisit those for `touched` ids.
  compact(current, touched = []) {
    while (this.compacted < this.entries.length - KEEP_RECENT) {
      const entry = this.entries[this.compacted];
      if (entry === this.group) break;
      for (const id of entry.changes.keys()) this.packChange(entry, id, current?.[id]);
      entry.packed = true; this.compacted++;
    }
    for (const id of touched) for (const entry of this.byId.get(id) || []) if (entry.packed && entry.changes.has(id)) this.packChange(entry, id, current?.[id]);
  }
  index(entry, id) { let set = this.byId.get(id); if (!set) this.byId.set(id, set = new Set()); set.add(entry); }
  unindex(entry) { for (const id of entry.changes.keys()) { const set = this.byId.get(id); set?.delete(entry); if (set && !set.size) this.byId.delete(id); } }
  begin() { this.group=null;this.gesture=true; }
  seal() { this.group=null;this.gesture=false; }
  record(before, after, ids, now=Date.now()) {
    const changes=[];
    for(const id of ids) {
      const a=snapshot(before[id]), b=snapshot(after[id]);
      const fields=[...fieldsToCheck,colors].filter(key=>!same(a?.[key],b?.[key]));
      if(a?.kind==='text' && b?.kind==='text' && fields.includes('text') && !fields.includes(colors))fields.push(colors);
      if(fields.length){
        const textAction=isCollaborativeItem(a)&&isCollaborativeItem(b)&&(fields.includes(collaborativeField(b))||fields.includes(colors))?captureCollaborativeUndo(before[id],after[id]):null;
        changes.push({id,before:a,after:b,fields,textActions:textAction?[textAction]:[]});
      }
    }
    if(!changes.length)return;
    const key=changes.map(c=>c.id).sort().join('\0');
    let entry=this.group;
    if(!entry || (!this.gesture && (entry.key!==key || now-entry.time>750))) {
      entry={key,time:now,changes:new Map()};this.entries.push(entry);this.group=entry;
    }
    entry.time=now;
    for(const c of changes) {
      const old=entry.changes.get(c.id);
      if(!old){entry.changes.set(c.id,c);this.index(entry,c.id);continue;}
      let before=old.before;
      if(before&&c.before){
        before={...before};
        // A field first touched later in the gesture may already contain a
        // remote edit. Preserve its value immediately before our first touch.
        for(const key of c.fields)if(!old.fields.includes(key)){
          if(c.before[key]===undefined)delete before[key];else before[key]=c.before[key];
        }
      }
      entry.changes.set(c.id,{...c,before,fields:[...new Set([...old.fields,...c.fields])],textActions:[...old.textActions,...c.textActions]});
    }
    this.compact(after,changes.map(c=>c.id));
  }
  restore(current,{itemId=null,textOnly=false}={}) {
    let index=this.entries.length-1;
    if(itemId!==null)while(index>=0){const c=this.entries[index].changes.get(String(itemId));if(c&&(!textOnly||(c.before&&c.after&&c.textActions.length)))break;index--;}
    const entry=this.entries[index];if(!entry)return null;
    const changes=new Map(),textColors=new Map(),documents=new Map(),aliases=new Map(this.aliases);
    for(const {id,before:packedBefore,after:packedAfter,fields,textActions} of entry.changes.values()) {
      const before=unpackStrokeSnapshot(packedBefore),after=unpackStrokeSnapshot(packedAfter);
      const item=snapshot(current[id]);
      if(!before) {
        if(item && [...fieldsToCheck,colors].some(k=>!same(item[k],after?.[k])))throw new Error('다른 사용자가 변경한 객체는 실행 취소할 수 없습니다.');
        if(item)changes.set(id,null);
      } else if(!after) {
        if(item)throw new Error('같은 ID의 객체가 이미 존재하여 복원할 수 없습니다.');
        changes.set(id,clean(before));if(before[colors])textColors.set(id,before[colors]);
      } else {
        const contentField=collaborativeField(after),selective=textActions.length>0;
        const restoreFields=selective?fields.filter(k=>k!==contentField&&k!==colors):fields;
        if(!item || restoreFields.some(k=>!same(item[k],after[k])))throw new Error('다른 사용자가 변경한 객체는 실행 취소할 수 없습니다.');
        const restored={...item};
        for(const key of restoreFields)if(before[key]===undefined)delete restored[key];else restored[key]=before[key];
        if(selective){
          const document=undoCollaborativeChanges(loadItemDoc(current[id]),textActions,aliases);
          restored[contentField]=document.content;documents.set(id,document);
        }
        changes.set(id,clean(restored));if(!selective&&fields.includes(colors))textColors.set(id,before[colors]||[]);
      }
    }
    return {items:changeItems(current,changes),ids:[...changes.keys()],textColors,documents,aliases,index};
  }
  pop(result=null) { const index=result?.index??this.entries.length-1;const [removed]=this.entries.splice(index,1);if(removed)this.unindex(removed);if(index<this.compacted)this.compacted--;if(result?.aliases)this.aliases=result.aliases;this.seal(); }
  clear() { this.entries=[];this.compacted=0;this.byId.clear();this.aliases.clear();this.seal(); }
}
