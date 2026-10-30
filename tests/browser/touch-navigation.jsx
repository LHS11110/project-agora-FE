import React, {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useCanvasCamera} from '../../src/canvas/useCanvasCamera.js';
import {useCanvasStageInteractions} from '../../src/canvas/useCanvasStageInteractions.js';
import {useCanvasTouchNavigation} from '../../src/canvas/useCanvasTouchNavigation.js';
import {stagePointerHandlers} from '../../src/canvas/stagePointerHandlers.js';
import BlueprintNode from '../../src/canvas/runtime/BlueprintNode.jsx';
import '../../src/styles.css';

function App(){
 const boardRef=useRef(),sceneRef=useRef();const [camera,setCamera]=useCanvasCamera(boardRef,sceneRef);
 const [tool,setTool]=useState('select');const [selected,setSelected]=useState(false);const refs=useRef(null);
 if(!refs.current)refs.current=Object.fromEntries(['eraserRef','eraserCursorRef','spatialIndexRef','strokeSaveFlushRef','zoomHoldRef','laserDrawingRef','selectionRef','drawingSessionRef','vectorDraftRef'].map(key=>[key,{current:null}]));
 const drawingRef=useRef(false),draftRef=useRef([]),itemsRef=useRef({}),pendingItemChangesRef=useRef([]),panRef=useRef(null),dragRef=useRef(null),spacePressedRef=useRef(false),stageWheelHandlerRef=useRef(null),peerMeshRef=useRef({sendData:()=>true,sendCursor:()=>true});
 const frames=useRef([]),lastCursorSentAtRef=useRef(0),zoomPointerPressRef=useRef(false),canvasSnapshotLoadedRef=useRef(true);
 const noop=()=>{};
 const interactions=useCanvasStageInteractions({...refs.current,boardRef,camera,setCamera,activeTool:tool,itemsRef,boardSize:{width:1600,height:1000},
  addItem:()=>true,setToast:noop,setItems:noop,patchItems:(changed,removed=[])=>{itemsRef.current={...itemsRef.current,...changed};for(const id of removed)delete itemsRef.current[id];},refreshSpatialIndex:noop,
  sendStrokeFrameChanges:batch=>{frames.current.push(...batch);return true;},pendingItemChangesRef,lastCursorSentAtRef,peerMeshRef,panRef,zoomPointerPressRef,zoomSensitivity:2,stageWheelHandlerRef,
  setLaserStrokes:noop,selectedItemIds:[],setSelectionBox:noop,selectItems:noop,canvasSnapshotLoadedRef,finishEditing:noop,setConnectionStartId:noop,spacePressedRef,
  user:{nickname:'test'},tableConfig:{rows:2,columns:2},permission:'default',setSharePosition:noop,shapeType:'rectangle',color:'#333',noteColor:'#fff',setActiveTool:setTool,startEditing:noop,strokeWidth:3,penBrush:'pen',penOpacity:1,drawingRef,draftRef});
 const touchNavigation=useCanvasTouchNavigation({boardRef,setCamera,onStart:point=>{interactions.cancelPanInertia();interactions.cancelStageGesture(point);interactions.hideCursor();}});
 window.touchFixture={camera,frames,itemsRef,drawingRef,setTool,reset:()=>setCamera({x:0,y:0,scale:1})};
 return <div className="canvas-app-page" style={{height:'100vh',minHeight:0}}>
 <style>{`html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}.canvas-stage{width:100%;height:100%;flex:none;border-radius:0}.canvas-scene{position:absolute;inset:0;pointer-events:none}.canvas-world-layer{position:absolute;inset:0;transform-origin:top left;pointer-events:none}.canvas-object.blueprint-object{position:absolute;left:70px;top:70px;width:370px;height:280px;max-width:none;pointer-events:auto}.blueprint-node-body{font-size:13px}`}</style>
 <div ref={boardRef} className={`canvas-stage ${tool==='select'?'select-mode':''}`} {...stagePointerHandlers({touchNavigation,activeTool:tool,dragRef,panRef,spacePressedRef,...interactions,cancelCameraMotion:interactions.cancelPanInertia})}>
  <div className="canvas-grid-surface" />
  <div className="canvas-scene" ref={sceneRef}><div className="canvas-world-layer">
   <div className={`canvas-object blueprint-object${selected?' selected':''}`} onPointerDownCapture={event=>{if(!selected){setSelected(true);event.preventDefault();event.stopPropagation();}}}><BlueprintNode selected={selected} id="out" item={{runtimeRole:'output',runtimeResults:[{runId:'test',codeId:'code',exitCode:0,output:Array.from({length:500},(_,i)=>`Line ${i+1}: execution output`).join('\n')}]}} /></div>
  </div></div>
 </div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
