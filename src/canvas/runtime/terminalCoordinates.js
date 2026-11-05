// xterm 6 measures cells before CSS transforms. Canvas objects may be scaled
// and rotated by several ancestors, so convert screen points back to local CSS.
export function terminalMousePoint(event,element){
 let matrix=new DOMMatrix();
 for(let node=element;node;node=node.parentElement){const transform=getComputedStyle(node).transform;if(transform&&transform!=='none')matrix=new DOMMatrix(transform).multiply(matrix);}
 const linear=new DOMMatrix([matrix.a,matrix.b,matrix.c,matrix.d,0,0]);
 if(Math.abs(linear.a*linear.d-linear.b*linear.c)<1e-10)return event;
 const rect=element.getBoundingClientRect(),width=element.offsetWidth,height=element.offsetHeight;
 const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>linear.transformPoint({x,y}));
 const point=linear.inverse().transformPoint({x:event.clientX-rect.left+Math.min(...corners.map(p=>p.x)),y:event.clientY-rect.top+Math.min(...corners.map(p=>p.y))});
 return {clientX:rect.left+point.x,clientY:rect.top+point.y};
}
export function correctTerminalCoordinates(term){
 // Isolate the pinned xterm version's internal hook; both selection and mouse
 // reporting share it. No DOM event fields or global listeners are modified.
 const service=term._core?._mouseService;if(!service)return ()=>{};
 const originals=new Map();
 for(const name of ['getCoords','getMouseReportCoords'])if(typeof service[name]==='function'){
  const original=service[name];originals.set(name,original);
  service[name]=function(event,element,...args){return original.call(this,terminalMousePoint(event,element),element,...args);};
 }
 return ()=>{for(const [name,original] of originals)service[name]=original;};
}
