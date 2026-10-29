import { memo } from 'react';
import CanvasObject from './CanvasObject.jsx';
import { needsVectorDom } from './vectorHitTest.js';
const NO_EDITORS=[];

// Camera translation does not change object content or hit controls.
export default memo(function CanvasLayerObjects({objects,domSelection,editingId,connectionStartId,world,scale,token,runtimeStore,selected,singleSelection,activeTool,dirtyItems,editorsByItem,actions}) {
  return objects.filter(([id,item])=>needsVectorDom(id,item,domSelection,editingId,connectionStartId,world,scale)).map(([id,item,bounds,connectorCurve])=>
    <CanvasObject key={id} id={id} item={item} bounds={bounds} connectorCurve={connectorCurve} viewSize={world} token={token} runtimeStore={runtimeStore} selected={selected.has(String(id))} allowSingleSelectionControls={singleSelection} activeTool={activeTool} connectionStartId={connectionStartId} editing={editingId===id} dirty={dirtyItems.has(String(id))} remoteEditors={editorsByItem.get(String(id)) || NO_EDITORS} {...actions} />);
});
