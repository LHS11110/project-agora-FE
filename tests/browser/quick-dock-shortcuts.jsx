import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CanvasQuickDock from '../../src/canvas/CanvasQuickDock.jsx';
function App(){
 const [active,setActive]=useState('select'),[write,setWrite]=useState(true),[allowed,setAllowed]=useState(true),[count,setCount]=useState(0);
 window.toolFixture={setWrite,setAllowed,active,count,allowed,write};
 return <><div className="background" tabIndex={0}>Canvas</div><CanvasQuickDock shortcutGuard={()=>allowed} canWrite={write} activeTool={active} onSelectTool={tool=>{setActive(tool);setCount(n=>n+1);}} onToggleTools={()=>{}} onUploadImage={()=>{}}/><input aria-label="Chat"/><div role="dialog" tabIndex={0}>Settings</div><div className="monaco-editor" tabIndex={0}>Code</div></>;
}
createRoot(document.getElementById('root')).render(<App/>);
