import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useObjectClipboard} from '../../src/canvas/clipboard/useObjectClipboard.js';
import NotebookObject from '../../src/canvas/notebook/NotebookObject.jsx';
import '../../src/styles.css';
import {installCanvasTransport} from '../../src/api/canvasTransport.js';
import {uploadNotebookFile} from '../../src/canvas/notebook/notebookFile.js';
const canvasId='1', uploads=[];
let staging;
installCanvasTransport({
 canvasId, origin:location.origin, request:async request=>{
  if(request.operation==='upload_begin'){
   staging={size:request.files[0].size, parts:0, bytes:0};
   return {uploadId:'notebook',chunkSize:96*1024};
  }
  if(request.operation==='upload_chunk'){
   if(request.offset!==staging.bytes)throw Error('Unexpected chunk offset');
   staging.bytes+=atob(request.data).length;staging.parts++;
   return {offset:staging.bytes};
  }
  if(request.operation==='upload_finish'){
   if(staging.bytes!==staging.size)throw Error('Incomplete notebook');
   uploads.push(staging);
   return {src:'/api/canvases/1/notebooks/11111111-1111-4111-8111-111111111111.ipynb'};
  }
  return {};
 },
});
function App(){
 const boardRef=useRef(null),itemsRef=useRef({}),ready=useRef(true),[items,setItems]=useState({}),[toast,setToast]=useState('');
 const addItems=entries=>{for(const {id,item} of entries)itemsRef.current[id]=item;setItems({...itemsRef.current});return true;};
 const clipboard=useObjectClipboard({canvasId,uploadNotebookFile:(file,options)=>uploadNotebookFile(file,{canvasId,...options}),boardRef,itemsRef,canvasSnapshotLoadedRef:ready,selectedIds:[],permission:['default'],canPaste:true,blocked:false,pointerPosition:()=>({x:.5,y:.5}),addItems,addItem:(id,item)=>addItems([{id,item}]),selectItems:()=>{},setActiveTool:()=>{},setConnectionStartId:()=>{},setToast});
 window.pasteFixture={items:()=>itemsRef.current,uploads};
 return <main className="canvas-app-page"><div ref={boardRef} className="canvas-stage" tabIndex={0} style={{height:700,width:900}}><button onClick={clipboard.paste}>Paste</button><p role="status">{toast}</p>{Object.entries(items).map(([id,item])=><div key={id} data-item-id={id} style={{width:600,height:500}}>{item.runtimeRole==='notebook'&&<NotebookObject id={id} item={item} selected={false} readOnly onChange={()=>{}}/>}</div>)}</div></main>;
}createRoot(document.getElementById('root')).render(<App/>);
