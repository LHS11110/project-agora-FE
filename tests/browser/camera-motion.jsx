import React,{useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {useCanvasCamera} from '../../src/canvas/useCanvasCamera.js';
import DepthVectorLayer from '../../src/canvas/DepthVectorLayer.jsx';
import {itemSnapshot} from '../../src/canvas/itemSnapshots.js';
const count=Number(new URLSearchParams(location.search).get('count'))||20000;
const items=itemSnapshot(Object.fromEntries(Array.from({length:count},(_,i)=>[String(i),{kind:'shape',shapeType:'rectangle',x:(i%200)*.02,y:Math.floor(i/200)*.02,width:.018,height:.018,fill:i%2?'#8e9bdf':'#aee0c8',strokeEnabled:false,shadowEnabled:false}])));
const world={width:1600,height:1000};let commits=0;
function App(){const stage=useRef(null),scene=useRef(null);const [camera,setCamera]=useCanvasCamera(stage,scene);commits++;
 window.cameraFixture={setCamera,commits,count};
 return <div ref={stage} className="canvas-stage" style={{position:'relative',width:1200,height:800,overflow:'hidden'}}><div ref={scene}><div className="canvas-world-layer"/></div><DepthVectorLayer items={items} referenceItems={items} worldSize={world} camera={camera} graphicsQuality="low"/></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
