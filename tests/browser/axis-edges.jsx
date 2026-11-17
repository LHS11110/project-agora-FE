import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import CanvasAxisTicks from '../../src/canvas/CanvasAxisTicks.jsx';
function App(){const boardRef=useRef(null),[camera,setCamera]=useState({x:0,y:0,scale:1});window.axisCamera=setCamera;return <div className="canvas-stage" ref={boardRef} style={{position:'relative',width:800,height:600}}><CanvasAxisTicks boardRef={boardRef} camera={camera} showXAxis showYAxis/></div>;}
createRoot(document.getElementById('root')).render(<App/>);
