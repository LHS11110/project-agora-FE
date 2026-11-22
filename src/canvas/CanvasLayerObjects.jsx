import {canUseItem} from './permissions/access.js';
import { memo } from 'react';
import CanvasObject from './CanvasObject.jsx';
import { isAgentCanvasObject } from './agents/agentCanvasModel.js';
const NO_EDITORS=[];
const EMPTY_CELLS=[];

function visibleNotebookReferencesChanged(before,after){
  const oldItems=before.allItems||{},newItems=after.allItems||{};
  for(const [id,item] of after.objects||[]){
    if(item?.runtimeRole==='notebook'){
      for(const childId of item.notebookCellIds||[]){
        if(oldItems[childId]!==newItems[childId])return true;
      }
    }else if(item?.runtimeRole==='notebook-cell'){
      const parentId=String(item.notebookId||'');
      if(oldItems[parentId]!==newItems[parentId])return true;
    }
  }
  return false;
}

function visibleAgentGraphReferencesChanged(before,after){
  if(before.allItems===after.allItems)return false;
  const visibleAgents=new Set();
  for(const [id,item] of after.objects||[]){
    if(isAgentCanvasObject(item))visibleAgents.add(String(id));
  }
  if(!visibleAgents.size)return false;
  const oldItems=before.allItems||{},newItems=after.allItems||{};
  for(const [key,edge] of Object.entries(oldItems)){
    if(edge?.kind==='connector'&&(visibleAgents.has(String(edge.from))||visibleAgents.has(String(edge.to)))){
      if(newItems[key]!==edge)return true;
    }
  }
  for(const [key,edge] of Object.entries(newItems)){
    if(edge?.kind==='connector'&&(visibleAgents.has(String(edge.from))||visibleAgents.has(String(edge.to)))){
      if(oldItems[key]!==edge)return true;
      const from=String(edge.from),to=String(edge.to);
      if(oldItems[from]!==newItems[from]||oldItems[to]!==newItems[to])return true;
    }
  }
  return false;
}

// Camera translation does not change object content or hit controls.
export default memo(function CanvasLayerObjects({presentation=false,pendingEntrance,access,canWriteItem=()=>true,canExecuteItem=()=>true,objects,allItems,domSelection,editingId,connectionStartId,world,scale,token,runtimeStore,multiAgentStore,selected,singleSelection,activeTool,dirtyItems,editorsByItem,actions}) {
  return objects.map(([id,item,bounds,connectorCurve])=>{
    const notebookCells=item.runtimeRole==='notebook'?((item.notebookCellIds||[]).map(cellId=>({id:cellId,item:allItems?.[cellId]})).filter(entry=>entry.item?.runtimeRole==='notebook-cell')):EMPTY_CELLS;
    const notebookParent=item.runtimeRole==='notebook-cell'?allItems?.[item.notebookId]:null;
    const notebookSiblingCells=notebookParent?.notebookCellIds?.map(cellId=>({id:cellId,item:allItems?.[cellId]})).filter(entry=>entry.item?.runtimeRole==='notebook-cell')||EMPTY_CELLS;
    const notebookOrder=notebookParent?.notebookCellIds?.indexOf(id)+1||0;
    const isAgent=isAgentCanvasObject(item);
    return <CanvasObject presentationHidden={Boolean(pendingEntrance?.has(id))} mediaWritable={!item.locked&&canUseItem(item,access,'write')} readOnly={presentation||!canWriteItem(item)} canExecute={!presentation&&canExecuteItem(item)} key={id} id={id} item={item} allItems={isAgent?allItems:null} multiAgentStore={isAgent?multiAgentStore:null} notebookCells={notebookCells} notebookSiblingCells={notebookSiblingCells} notebookParent={notebookParent} notebookOrder={notebookOrder} notebookCellCount={notebookParent?.notebookCellIds?.length||0} bounds={bounds} connectorCurve={connectorCurve} viewSize={world} token={token} runtimeStore={runtimeStore} selected={selected.has(String(id))} allowSingleSelectionControls={singleSelection} activeTool={activeTool} connectionStartId={connectionStartId} editing={editingId===id && !item.locked && canWriteItem(item)} dirty={dirtyItems.has(String(id))} remoteEditors={editorsByItem.get(String(id)) || NO_EDITORS} {...actions} />;
  });
},(before,after)=>Object.keys(before).length===Object.keys(after).length&&Object.keys(after).every(key=>['scale','domSelection','allItems'].includes(key)||before[key]===after[key])&&!visibleNotebookReferencesChanged(before,after)&&!visibleAgentGraphReferencesChanged(before,after));
