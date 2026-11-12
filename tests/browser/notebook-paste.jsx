import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useObjectClipboard} from '../../src/canvas/clipboard/useObjectClipboard.js';
import NotebookObject from '../../src/canvas/notebook/NotebookObject.jsx';
import '../../src/styles.css';
function App(){
 const boardRef=useRef(null),itemsRef=useRef({}),ready=useRef(true),[items,setItems]=useState({}),[toast,setToast]=useState('');
 const addItems=entries=>{for(const {id,item} of entries)itemsRef.current[id]=item;setItems({...itemsRef.current});return true;};
 const clipboard=useObjectClipboard({canvasId:'paste-test',boardRef,itemsRef,canvasSnapshotLoadedRef:ready,selectedIds:[],permission:['default'],canPaste:true,blocked:false,pointerPosition:()=>({x:.5,y:.5}),addItems,addItem:(id,item)=>addItems([{id,item}]),selectItems:()=>{},setActiveTool:()=>{},setConnectionStartId:()=>{},setToast});
 window.pasteFixture={items:()=>itemsRef.current};
 return <main className="canvas-app-page"><div ref={boardRef} className="canvas-stage" tabIndex={0} style={{height:700,width:900}}><button onClick={clipboard.paste}>Paste</button><p role="status">{toast}</p>{Object.entries(items).map(([id,item])=><div key={id} data-item-id={id} style={{width:600,height:500}}>{item.runtimeRole==='notebook'&&<NotebookObject id={id} item={item} selected={false} readOnly onChange={()=>{}}/>}</div>)}</div></main>;
}createRoot(document.getElementById('root')).render(<App/>);
