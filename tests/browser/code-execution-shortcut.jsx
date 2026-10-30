import React,{useRef,useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import CanvasCodeEditor from '../../src/canvas/CanvasCodeEditor.jsx';
import useCodeExecutionShortcut from '../../src/canvas/runtime/useCodeExecutionShortcut.js';
import {createBlueprintStore} from '../../src/canvas/runtime/blueprintStore.js';
function App(){
 const [text,setText]=useState('print(1)'),[selected,setSelected]=useState(['a']),[editing,setEditing]=useState('a'),[output,setOutput]=useState(''),[message,setMessage]=useState('');
 const items=useRef({});items.current={a:{kind:'text',renderMode:'code',language:'python',text},b:{kind:'code',language:'python',code:'other'},plain:{kind:'text',text:'plain'},out:{kind:'shape',runtimeRole:'output'},e:{kind:'connector',from:'a',to:'out'}};
 const selectedIdsRef=useRef(['a']);
 const select=ids=>{selectedIdsRef.current=ids;setSelected(ids);};
 const session=useRef({editable:true}),drag=useRef(null),calls=useRef([]),store=useRef(null);
 if(!store.current)store.current=createBlueprintStore({getItems:()=>items.current,execute:async request=>{calls.current.push(request);await new Promise(resolve=>setTimeout(resolve,100));return {exitCode:0,output:request.code};},saveOutput:(id,records)=>{setOutput(records.at(-1).output);return true;}});
 useCodeExecutionShortcut({selectedIds:selected,selectedIdsRef,itemsRef:items,editingId:editing,sessionRef:session,dragRef:drag,store:store.current,onMessage:setMessage});
 useEffect(()=>{window.shortcutFixture={calls:calls.current,items,select,syncSelection:ids=>{selectedIdsRef.current=ids;},edit:setEditing,store:store.current};},[]);
 return <><div className="canvas-object" data-item-id="a" style={{width:650,height:280}}>{editing==='a'?<CanvasCodeEditor inline value={text} language="python" onChange={setText} onStopEditing={()=>setEditing(null)}/>:<pre>{text}</pre>}</div><div className="background" tabIndex={0}>Canvas background</div><textarea aria-label="Chat"/><div role="dialog" tabIndex={0}>Settings</div><pre className="output">{output}</pre><p role="status">{message}</p></>;
}
createRoot(document.getElementById('root')).render(<App/>);
