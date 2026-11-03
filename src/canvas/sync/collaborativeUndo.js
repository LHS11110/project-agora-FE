import * as Automerge from '@automerge/automerge/slim';
import { loadItemDoc } from '../host/hostOperations.js';
import { TEXT_COLOR_MARK } from '../content/textColors.js';
const path=['content'];
const glyphAt=(text,index)=>String.fromCodePoint(text.codePointAt(index));
const colorAt=(doc,index)=>Automerge.marksAt(doc,path,index)[TEXT_COLOR_MARK] || null;
const resolveAlias=(id,aliases)=>{const seen=new Set();while(aliases.has(id)&&!seen.has(id)){seen.add(id);id=aliases.get(id);}return id;};
function visible(doc,id,aliases){
  id=resolveAlias(id,aliases);
  const index=Automerge.getCursorPosition(doc,path,id);
  return index<doc.content.length && Automerge.getCursor(doc,path,index)===id ? index : null;
}

// Operation IDs identify the actual inserted/deleted characters, including
// repeated letters and Unicode. No string search or whole-document rollback.
export function captureCollaborativeUndo(beforeItem,afterItem){
  const before=loadItemDoc(beforeItem),after=loadItemDoc(afterItem);
  const object=Automerge.getObjectId(before,'content');
  if(object!==Automerge.getObjectId(after,'content'))return null;
  const inserted=[],deleted=[],marks=[],seenMarks=new Set();
  for(const bytes of Automerge.getChanges(before,after)){
    const change=Automerge.decodeChange(bytes);
    for(const [offset,op] of change.ops.entries()){
      if(op.obj!==object)continue;
      const operationId=`${change.startOp+offset}@${change.actor}`;
      if(op.action==='set'&&op.insert&&typeof op.value==='string')inserted.push({id:operationId,value:op.value});
      if(op.action==='del'&&op.elemId){
        const index=visible(before,op.elemId,new Map());
        if(index!==null)deleted.push({id:op.elemId,value:glyphAt(before.content,index),index,color:colorAt(before,index),deletionId:operationId});
      }
    }
  }
  for(const patch of Automerge.diff(after,Automerge.getHeads(before),Automerge.getHeads(after))){
    if(patch.action!=='mark'||patch.path.length!==1||patch.path[0]!=='content')continue;
    for(const mark of patch.marks){
      if(mark.name!==TEXT_COLOR_MARK)continue;
      for(let index=mark.start;index<mark.end;){
        const id=Automerge.getCursor(after,path,index),glyph=glyphAt(after.content,index);index+=glyph.length;
        if(seenMarks.has(id))continue;seenMarks.add(id);
        const old=visible(before,id,new Map());if(old===null)continue;
        const previous=colorAt(before,old),next=colorAt(after,index-glyph.length);
        if(previous!==next)marks.push({id,before:previous,after:next});
      }
    }
  }
  return inserted.length||deleted.length||marks.length?{inserted,deleted,marks,heads:Automerge.getHeads(before)}:null;
}

export function undoCollaborativeChanges(document,actions,aliases=new Map()){
  let doc=Automerge.clone(document);
  for(const action of [...actions].reverse()){
    // An independent deletion of the same character must not be resurrected.
    const otherDeletions=new Set(),ourDeletes=new Set(action.deleted.map(d=>d.deletionId));
    if(action.deleted.length){
      const before=Automerge.view(doc,action.heads);
      for(const bytes of Automerge.getChanges(before,doc)){
        const c=Automerge.decodeChange(bytes);
        c.ops.forEach((op,i)=>{if(op.action==='del'&&op.elemId&&!ourDeletes.has(`${c.startOp+i}@${c.actor}`))otherDeletions.add(op.elemId);});
      }
    }
    // Delete only our still-visible character IDs; remote inserts between them survive.
    const positions=action.inserted.map(token=>{const index=visible(doc,token.id,aliases);return index===null?null:{index,length:token.value.length};}).filter(Boolean).sort((a,b)=>b.index-a.index);
    const runs=[];
    for(const position of positions){const last=runs.at(-1);if(last && position.index+position.length===last.index){last.index=position.index;last.length+=position.length;}else runs.push({...position});}
    if(runs.length)doc=Automerge.change(doc,draft=>{for(const {index,length} of runs)Automerge.splice(draft,path,index,length,'');});
    const restores=[];
    for(const token of action.deleted){
      if(visible(doc,token.id,aliases)!==null || otherDeletions.has(token.id))continue;
      restores.push({token,index:Automerge.getCursorPosition(doc,path,resolveAlias(token.id,aliases))});
    }
    restores.sort((a,b)=>b.index-a.index||b.token.index-a.token.index);
    const groups=[];
    for(const entry of restores){const last=groups.at(-1);if(last?.index===entry.index)last.tokens.unshift(entry.token);else groups.push({index:entry.index,tokens:[entry.token]});}
    for(const {index,tokens} of groups){
      doc=Automerge.change(doc,draft=>{
        Automerge.splice(draft,path,index,0,tokens.map(t=>t.value).join(''));
        let offset=index;
        for(const token of tokens){
          const range={start:offset,end:offset+token.value.length,expand:'none'};
          if(token.color)Automerge.mark(draft,path,range,TEXT_COLOR_MARK,token.color);else Automerge.unmark(draft,path,range,TEXT_COLOR_MARK);
          offset=range.end;
        }
      });
      let offset=index;
      for(const token of tokens){aliases.set(token.id,Automerge.getCursor(doc,path,offset));offset+=token.value.length;}
    }
    for(const mark of action.marks){
      const index=visible(doc,mark.id,aliases);if(index===null || colorAt(doc,index)!==mark.after)continue;
      const end=index+glyphAt(doc.content,index).length;
      doc=Automerge.change(doc,draft=>{
        const range={start:index,end,expand:'none'};
        if(mark.before)Automerge.mark(draft,path,range,TEXT_COLOR_MARK,mark.before);
        else Automerge.unmark(draft,path,range,TEXT_COLOR_MARK);
      });
    }
  }
  return doc;
}
