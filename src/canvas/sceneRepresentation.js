const richKinds=new Set(['text','code','math','note','table','image','link','pdf','user-group']);
const colors={text:'#e1e9e2',code:'#dce9df',math:'#e7def2',note:'#f3ebce',table:'#dfe6ef',image:'#eaded4',link:'#eaded4',pdf:'#eeded7','user-group':'#e7def2'};
// Only unreadably small boxes use an overview representation. Selecting or
// zooming restores their real content; persisted objects are never replaced.
export function isOverviewProxy(item,world,scale){
  if(!richKinds.has(item?.kind) || !(Number(item.width)>0 && Number(item.height)>0))return false;
  const width=item.width*world.width*scale,height=item.height*world.height*scale;
  return Math.min(width,height)<24 && width*height<1200;
}
export function overviewProxy(item){
  return {kind:'shape',shapeType:'rectangle',x:item.x,y:item.y,width:item.width,height:item.height,rotation:item.rotation,
    fill:colors[item.kind],strokeEnabled:false,shadowEnabled:false,depth:item.depth};
}
