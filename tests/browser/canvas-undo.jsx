import React,{useRef,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as Automerge from '@automerge/automerge/slim';
import wasm from '@automerge/automerge/automerge.wasm?url';
import {useServerCanvas} from '../../src/canvas/sync/useServerCanvas.js';
import {textSpliceBetween} from '../../src/canvas/collaborativeText.js';
import {loadItemDoc,translateItem} from '../../src/canvas/host/hostOperations.js';
import {makeCollaborativeItem} from '../../src/canvas/collaborativeSync.js';
import {applyTextColor,textColorRanges} from '../../src/canvas/content/textColors.js';
import CanvasQuickDock from '../../src/canvas/CanvasQuickDock.jsx';
await Automerge.initializeWasm(wasm);
function App(){
 const refs=useRef({});const itemsRef=useRef({}),docs=useRef(new Map()),bases=useRef(new Map()),accessRef=useRef({is_admin:true});
 const [message,setToast]=useState('');const committed=useRef({}),revision=useRef(0),sent=useRef([]);
 const ws=useRef({readyState:1,bufferedAmount:0,send(raw){
   const data=JSON.parse(raw);if(data.type!=='canvas_ops')return;sent.current.push(data);
   setTimeout(()=>{
     const changes={};for(const o of data.operations){
       if(o.action==='translate'){for(const id of o.ids)changes[id]=translateItem(changes[id]||committed.current[id],o.dx,o.dy);continue;}
       if(o.action==='delete'){changes[o.id]=null;continue;}
       const item={...committed.current[o.id],...o.patch};for(const k of o.unset||[])delete item[k];changes[o.id]=item;
     }
     for(const [id,item] of Object.entries(changes))if(item)committed.current[id]=item;else delete committed.current[id];
     refs.current.receiveServerEvent({type:'canvas_commit',items:changes,revision:++revision.current,client_id:data.client_id,author_id:1,request_count:data.request_count});
   },10);
 }});
 const api=useServerCanvas({accessRef,itemsRef,wsRef:ws,collaborativeDocsRef:docs,collaborativeBaseDocsRef:bases,setToast});refs.current=api;
 const box={kind:'shape',shapeType:'rectangle',permission:'default',x:0,y:0,width:.1,height:.1};
 useEffect(()=>{
  api.receiveServerItems({}, {sync_protocol:2,revision:0,accepted_count:0,sync_user_id:1});
 },[]);
 window.undoFixture={...api,itemsRef,accessRef,sent:sent.current,box,makeCollaborativeItem,
   edit(id,value){const item=itemsRef.current[id];docs.current.set(id,Automerge.change(Automerge.clone(docs.current.get(id)||loadItemDoc(item)),d=>{const c=textSpliceBetween(d.content,value);Automerge.splice(d,['content'],c.index,c.deleteCount,c.insertText);}));api.patchItems({[id]:{...item,[item.kind==='code'?'code':'text']:value}});},
   color(id){docs.current.set(id,applyTextColor(docs.current.get(id)||loadItemDoc(itemsRef.current[id]),0,5,'#ff0000'));api.patchItems({[id]:{...itemsRef.current[id]}});},
   colors:id=>textColorRanges(itemsRef.current[id]),
   remote(id,patch){committed.current[id]={...committed.current[id],...patch};api.receiveServerEvent({type:'canvas_commit',items:{[id]:committed.current[id]},revision:++revision.current,client_id:'remote',author_id:2});},
 };
 return <><CanvasQuickDock canWrite activeTool="select" canUndo={api.status.editable} undoCount={api.undoCount} onUndo={api.undo} onSelectTool={()=>{}} onToggleTools={()=>{}}/><p role="status">{message}</p><pre>{JSON.stringify(api.items)}</pre></>;
}
createRoot(document.getElementById('root')).render(<App/>);
