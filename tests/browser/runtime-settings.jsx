import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import RuntimeSettingsDialog from '../../src/canvas/runtime/RuntimeSettingsDialog.jsx';
import '../../src/styles.css';
function App(){const [open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Open runtime settings</button>{open&&<RuntimeSettingsDialog canvasId={123} token="test-token" user={{user_id:1}} onClose={()=>setOpen(false)}/>}</>;}
createRoot(document.getElementById('root')).render(<App/>);
