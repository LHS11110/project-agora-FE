import { contentSource } from './content/contentPresentation.js';
import { objectFontSize } from './objectSize.js';
const richKinds=new Set(['text','code','math','note','table','image','link','pdf','user-group']);
const colors={text:'#e1e9e2',code:'#dce9df',math:'#e7def2',note:'#f3ebce',table:'#dfe6ef',image:'#eaded4',link:'#eaded4',pdf:'#eeded7','user-group':'#e7def2'};
// Small rich objects use overview rendering. Selecting or zooming restores
// their full renderer; persisted objects are never replaced.
export function isOverviewProxy(item,world,scale){
  if(!richKinds.has(item?.kind) || !(Number(item.width)>0 && Number(item.height)>0))return false;
  const width=item.width*world.width*scale,height=item.height*world.height*scale;
  return Math.min(width,height)<24 && width*height<1200;
}
// Half-octave buckets prevent rebuilding every rich object on each wheel tick.
export function overviewScale(scale) {
  return 2 ** (Math.round(Math.log2(Math.max(.0001, Number(scale) || 1)) * 2) / 2);
}
export function overviewProxy(item, world, scale){
  if (['text', 'code', 'math'].includes(item.kind)) {
    const text = contentSource(item);
    return { kind: 'text', renderMode: 'plain', x: item.x, y: item.y, width: item.width, height: item.height,
      rotation: item.rotation, depth: item.depth, fontSize: objectFontSize(item),
      text: text || ' ', shadowEnabled: false };
  }
  if (item.kind === 'image' && world && (Math.min(item.width * world.width, item.height * world.height) * scale < 2 || item.width * world.width * item.height * world.height * scale * scale < 16)) return { kind: 'shape', shapeType: 'rectangle', x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, depth: item.depth, fill: '', color: '#9ca99f', strokeEnabled: true, shadowEnabled: false };
  if (item.kind === 'image') return { kind: 'shape', shapeType: 'rectangle',
    x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, depth: item.depth,
    __imagePreview: item.src, imageFrameEnabled: item.imageFrameEnabled, strokeEnabled: false, shadowEnabled: false };

  return {kind:'shape',shapeType:'rectangle',x:item.x,y:item.y,width:item.width,height:item.height,rotation:item.rotation,
    fill:colors[item.kind],strokeEnabled:false,shadowEnabled:false,depth:item.depth};
}
