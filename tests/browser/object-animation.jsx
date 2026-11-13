import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import AnimatedVector from '../../src/canvas/portfolio/AnimatedVector.jsx';
import {AnimationContext,createAnimationStore,useObjectAnimation} from '../../src/canvas/portfolio/animationStore.js';
import {defaultAnimation} from '../../src/canvas/portfolio/portfolioModel.js';
const world={width:1000,height:700};
function Shape({id,item}){const node=useRef(null);useObjectAnimation(id,node,false);return <div ref={node} data-id={id} style={{position:'absolute',left:item.x*1000,top:item.y*700,width:60,height:40}}><AnimatedVector id={id} item={item} world={world} origin={{x:item.x*1000,y:item.y*700}}/></div>;}
function App(){
 const [items,setItems]=useState(()=>Object.fromEntries(Array.from({length:120},(_,i)=>[String(i),{kind:'shape',shapeType:'rectangle',x:(i%15)*.065,y:Math.floor(i/15)*.08,width:.06,height:.05,fill:'#a799ed',color:'#584a99',shadowEnabled:false,animation:{...defaultAnimation(),effect:'slide-left',easing:'linear'}}])));
 const current=useRef(items);current.current=items;
 const store=useRef(null);if(!store.current)store.current=createAnimationStore(()=>current.current);
 window.animationFixture={play(options={}){const startedAt=Date.now()+(options.future??100),runId=crypto.randomUUID();const next=Object.fromEntries(Object.entries(current.current).map(([id,item])=>[id,{...item,animationPlayback:{runId,action:'play',startedAt,config:{...item.animation,duration:1000,...options.config}}}]));flushSync(()=>{setItems(next);store.current.update(next);});return {startedAt,runId};},move(){setItems(old=>Object.fromEntries(Object.entries(old).map(([id,item])=>[id,{...item,x:item.x+.001}])));},color(){setItems(old=>({...old,'0':{...old['0'],fill:'#ff0000'}}));},stop(){store.current.update(Object.fromEntries(Object.entries(current.current).map(([id,item])=>[id,{...item,animationPlayback:{...item.animationPlayback,runId:crypto.randomUUID(),action:'stop'}}])));}};
 return <AnimationContext.Provider value={store.current}><main style={{position:'relative',width:1000,height:700}}>{Object.entries(items).map(([id,item])=><Shape key={id} id={id} item={item}/>)}</main></AnimationContext.Provider>;
}createRoot(document.getElementById('root')).render(<App/>);
