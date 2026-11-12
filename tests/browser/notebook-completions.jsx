import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import NotebookObject from '../../src/canvas/notebook/NotebookObject.jsx';
import '../../src/styles.css';
function App(){const [item,setItem]=useState({kind:'shape',runtimeRole:'notebook',fontSize:13,notebookCells:[{id:'first',cellType:'code',source:'pr'},{id:'second',cellType:'code',source:'n = 1\nn'}],notebookResults:{}});window.notebookFixture={getValue:()=>item,runs:window.notebookFixture?.runs||[]};
 const store={get:()=>null,subscribe:()=>()=>{},notebook:async(id,request)=>{window.notebookFixture.runs.push(request);return {exitCode:0,outputs:[]};}};
 return <main className="canvas-app-page" data-theme="light" style={{height:'100vh',padding:20}}><div data-item-id="notebook-test" className="notebook-object" style={{height:600,width:700}}><NotebookObject id="notebook-test" item={item} store={store} selected canExecute readOnly={false} onChange={(id,patch)=>setItem(old=>typeof patch==='function'?patch(old):{...old,...patch})}/></div></main>;
}createRoot(document.getElementById('root')).render(<App/>);
