import { captureCollaborativeUndo, undoCollaborativeChanges } from './collaborativeUndo.js';
import { isCollaborativeItem, collaborativeField } from '../collaborativeSync.js';
import { loadItemDoc } from '../host/hostOperations.js';
import { textColorRanges } from '../content/textColors.js';
import { CANVAS_ITEM_FIELDS, stable } from '../asCode/manifest.js';
import { changeItems } from '../itemSnapshots.js';
const ignored = new Set(['automerge_snapshot', 'automerge_changes', 'runtimeResults']);
const colors='__undoColors';
const snapshot=item=>item?.kind==='text'?{...item,[colors]:textColorRanges(item)}:item;
const clean=item=>{const result={...item};delete result[colors];return result;};
const fieldsToCheck=[...CANVAS_ITEM_FIELDS].filter(k=>!ignored.has(k));
const same = (a,b) => a === b || stable(a) === stable(b);

// Sparse local history: retain touched objects, never entire canvas snapshots.
export class CanvasUndoHistory {
  constructor() { this.entries=[]; this.group=null; this.gesture=false; this.aliases=new Map(); }
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
      if(!old){entry.changes.set(c.id,c);continue;}
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
  }
  restore(current,{itemId=null,textOnly=false}={}) {
    let index=this.entries.length-1;
    if(itemId!==null)while(index>=0){const c=this.entries[index].changes.get(String(itemId));if(c&&(!textOnly||(c.before&&c.after&&c.textActions.length)))break;index--;}
    const entry=this.entries[index];if(!entry)return null;
    const changes=new Map(),textColors=new Map(),documents=new Map(),aliases=new Map(this.aliases);
    for(const {id,before,after,fields,textActions} of entry.changes.values()) {
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
  pop(result=null) { this.entries.splice(result?.index??this.entries.length-1,1);if(result?.aliases)this.aliases=result.aliases;this.seal(); }
  clear() { this.entries=[];this.aliases.clear();this.seal(); }
}
