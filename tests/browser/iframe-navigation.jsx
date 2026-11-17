import React,{Profiler,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import HtmlObject from '../../src/canvas/content/HtmlObject.jsx';
import SharedMediaContent from '../../src/components/SharedMediaContent.jsx';
import {NotebookOutput} from '../../src/canvas/notebook/NotebookObject.jsx';
import {useCanvasCamera} from '../../src/canvas/useCanvasCamera.js';
const params=new URLSearchParams(location.search),kind=params.get('kind')||'html',count=Number(params.get('count'))||72;
const html='<h2>Research dashboard</h2><p>HTML content preview</p><table>'+Array.from({length:16},(_,i)=>'<tr>'+Array.from({length:6},(_,j)=>`<td>Cell ${i}:${j}</td>`).join('')+'</tr>').join('')+'</table><style>body{background:#f2f7fa;color:#245}td{padding:4px;border:1px solid #ddd}table{border-collapse:collapse}</style><script>window.previewRuns=(window.previewRuns||0)+1</script>';
const objects=Array.from({length:count},(_,i)=>({id:`item-${i}`,x:(i%12)*340,y:Math.floor(i/12)*270}));
const metrics={renders:[],commits:[],iframeCreated:0,maxIframes:0};
const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)metrics.iframeCreated+=(node.matches('iframe')?1:0)+node.querySelectorAll('iframe').length;metrics.maxIframes=Math.max(metrics.maxIframes,document.querySelectorAll('iframe').length);});observer.observe(document.documentElement,{childList:true,subtree:true});
function App(){const stage=useRef(null),scene=useRef(null),[camera,setCamera]=useCanvasCamera(stage,scene),[selected,select]=useState(null),[revision,revise]=useState(0);
 const visible=objects.filter(o=>o.x>-camera.x/camera.scale-700&&o.x<(1280-camera.x)/camera.scale+700&&o.y>-camera.y/camera.scale-540&&o.y<(900-camera.y)/camera.scale+540);
 useLayoutEffect(()=>{window.iframeFixture={kind,count,metrics,setCamera,select,revise,visible:visible.length};});
 return <Profiler id="objects" onRender={(_,phase,duration,base,start,commit)=>{metrics.renders.push(duration);metrics.commits.push(Math.max(0,performance.now()-commit));}}><div ref={stage} className="canvas-stage" style={{position:'relative',width:1280,height:900,overflow:'hidden',background:'#edf1f5'}}><div ref={scene}><div className="canvas-world-layer" style={{position:'absolute',width:6000,height:3000,transform:`translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})`,transformOrigin:'0 0'}}>{visible.map(o=><div key={o.id} data-item-id={o.id} style={{position:'absolute',left:o.x,top:o.y,width:320,height:250,overflow:'hidden',background:'white',border:'1px solid #cdd',pointerEvents:'auto'}} onClick={()=>select(o.id)}>{kind==='html'?<HtmlObject id={o.id} value={html+`<!--${revision}-->`} editing={selected===o.id} onStartEditing={()=>select(o.id)} onStopEditing={()=>select(null)} onChange={()=>{}}/>:kind==='youtube'?<SharedMediaContent playbackKey={o.id} item={{url:'https://youtu.be/dQw4w9WgXcQ',title:'Video tutorial'}} interactive={selected===o.id}/>:<NotebookOutput output={{data:{'text/html':html}}} fontSize={13}/>}</div>)}</div></div></div></Profiler>;
}
createRoot(document.getElementById('root')).render(<App/>);
