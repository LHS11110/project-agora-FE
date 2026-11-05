import { memo } from 'react';
import CanvasObject from './CanvasObject.jsx';
const NO_EDITORS=[];

// Camera translation does not change object content or hit controls.
export default memo(function CanvasLayerObjects({access,canWriteItem=()=>true,canExecuteItem=()=>true,objects,domSelection,editingId,connectionStartId,world,scale,token,runtimeStore,selected,singleSelection,activeTool,dirtyItems,editorsByItem,actions}) {
  return objects.map(([id,item,bounds,connectorCurve])=>
    <CanvasObject readOnly={!canWriteItem(item)} canExecute={canExecuteItem(item)} key={id} id={id} item={item} bounds={bounds} connectorCurve={connectorCurve} viewSize={world} token={token} runtimeStore={runtimeStore} selected={selected.has(String(id))} allowSingleSelectionControls={singleSelection} activeTool={activeTool} connectionStartId={connectionStartId} editing={editingId===id && !item.locked && canWriteItem(item)} dirty={dirtyItems.has(String(id))} remoteEditors={editorsByItem.get(String(id)) || NO_EDITORS} {...actions} />);
},(before,after)=>Object.keys(before).length===Object.keys(after).length&&Object.keys(after).every(key=>['scale','domSelection'].includes(key)||before[key]===after[key]));
