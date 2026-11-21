// A collaborator drags one object while the local camera pans. `mode=spread`
// reproduces the old `{ ...items, [id]: item }` peer path; `mode=change` uses
// structurally shared `changeItems`.
import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {useCanvasCamera} from '../../src/canvas/useCanvasCamera.js';
import DepthVectorLayer from '../../src/canvas/DepthVectorLayer.jsx';
import {itemSnapshot,changeItems} from '../../src/canvas/itemSnapshots.js';
const params=new URLSearchParams(location.search);
const count=Number(params.get('count'))||20000,mode=params.get('mode')||'change';
const initial=itemSnapshot(Object.fromEntries(Array.from({length:count},(_,i)=>[String(i),{kind:'shape',shapeType:'rectangle',x:(i%200)*.005,y:Math.floor(i/200)*.005,width:.004,height:.004,fill:i%2?'#8e9bdf':'#aee0c8',strokeEnabled:false,shadowEnabled:false}])));
const world={width:1600,height:1000};
function App(){const stage=useRef(null),scene=useRef(null),itemsRef=useRef(initial);const [items,setItems]=useState(initial);const [camera,setCamera]=useCanvasCamera(stage,scene);
 window.peerFixture={count,mode,setCamera,peerMove(t){
  const key=String(Math.floor(t/50)%count),item={...itemsRef.current[key],x:.5+Math.sin(t/300)*.1,y:.5+Math.cos(t/300)*.1};
  const next=mode==='spread'?{...itemsRef.current,[key]:item}:changeItems(itemsRef.current,{[key]:item});
  itemsRef.current=next;flushSync(()=>setItems(next));
 }};
 return <div ref={stage} className="canvas-stage" style={{position:'relative',width:1200,height:800,overflow:'hidden'}}><div ref={scene}><div className="canvas-world-layer"/></div><DepthVectorLayer items={items} referenceItems={items} worldSize={world} camera={camera} graphicsQuality="low"/></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
