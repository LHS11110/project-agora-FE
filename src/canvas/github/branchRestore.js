import * as Automerge from '@automerge/automerge/slim';
import {CANVAS_ITEM_FIELDS,exportManifest,planManifest,stable} from '../asCode/manifest.js';
import {loadItemDoc} from '../host/hostOperations.js';
import {collaborativeField,isCollaborativeItem,encodeBase64} from '../collaborativeSync.js';
import {TEXT_COLOR_MARK} from '../content/textColors.js';

export function restoreOperations(manifest,items){
 const wanted=Object.fromEntries(planManifest({...manifest,mode:'replace',remove:[]},{},'default').creates.map(e=>[e.id,e.item]));
 const operations=[],removed=[];
 for(const [id,old] of Object.entries(items))if(old?.type!=='chat_room'&&!wanted[id]){if(old.locked)throw new Error('잠긴 객체를 삭제하는 복원은 적용할 수 없습니다.');removed.push({id,action:'delete',connector:old.kind==='connector'});}
 for(const [id,item] of Object.entries(wanted).sort((a,b)=>Number(a[1].kind==='connector')-Number(b[1].kind==='connector'))){
  const old=items[id];if(old&&stable(exportManifest({[id]:old}).items[id])===stable(exportManifest({[id]:item}).items[id]))continue;
  if(old?.locked)throw new Error('잠긴 객체를 변경하는 복원은 적용할 수 없습니다.');
  if(old&&old.kind!==item.kind)throw new Error('같은 ID의 객체 종류가 다릅니다. 종류가 바뀐 객체는 새 ID를 사용해주세요.');
  const {__initialTextColors,...patch}=item;
  if(isCollaborativeItem(item)){
   const field=collaborativeField(item),base=old?Automerge.clone(loadItemDoc(old)):Automerge.from({content:''});
   const doc=Automerge.change(base,draft=>{
    if(draft.content.length)Automerge.unmark(draft,['content'],{start:0,end:draft.content.length,expand:'none'},TEXT_COLOR_MARK);
    Automerge.splice(draft,['content'],0,draft.content.length,item[field]||'');
    for(const range of __initialTextColors||[])Automerge.mark(draft,['content'],{start:range.start,end:range.end,expand:'none'},TEXT_COLOR_MARK,range.color);
   });
   patch.automerge_snapshot=old?(old.automerge_snapshot||encodeBase64(Automerge.save(base))):encodeBase64(Automerge.save(doc));
   patch.automerge_changes=old?[...(old.automerge_changes||[]),...Automerge.getChanges(base,doc).map(change=>({field,change:encodeBase64(change)}))]:[];
  }
  const unset=old?[...CANVAS_ITEM_FIELDS].filter(key=>Object.hasOwn(old,key)&&!Object.hasOwn(patch,key)):[];
  operations.push({id,action:old?'patch':'create',patch,unset});
 }
 // Existing connectors must disappear before their endpoints; new endpoints precede new wires.
 return [...removed.filter(o=>o.connector).map(({connector,...o})=>o),...operations,...removed.filter(o=>!o.connector).map(({connector,...o})=>o)];
}

