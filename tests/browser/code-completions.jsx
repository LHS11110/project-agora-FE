import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CanvasCodeEditor from '../../src/canvas/CanvasCodeEditor.jsx';
import '../../src/styles.css';
function App(){
 const [value,setValue]=useState('def prepare_report(values):\n    return sorted(values)\n\npr'),[scale,setScale]=useState(1),[open,setOpen]=useState(true),[language,setLanguage]=useState('python');
 window.completionFixture={setScale,setOpen,setValue,setLanguage,getValue:()=>value};
 return <main className="canvas-app-page" style={{minHeight:'100vh',padding:30,background:'#151c29'}}><h2 style={{color:'#dce6f5',fontSize:18}}>코드 자동완성</h2><p style={{color:'#9aabc4'}}>Python · Canvas editor</p><button onClick={()=>setScale(scale===1 ? 0.5 : 1)}>Zoom</button><button onClick={()=>setOpen(!open)}>Toggle editor</button><div style={{position:'relative',marginTop:25,width:720,height:360,transform:`scale(${scale})`,transformOrigin:'top left',border:'1px solid #40506a',borderRadius:12,overflow:'hidden'}} data-item-id="completion-code">{open&&<CanvasCodeEditor inline value={value} language={language} onChange={setValue} onStopEditing={()=>setOpen(false)}/>}</div></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
