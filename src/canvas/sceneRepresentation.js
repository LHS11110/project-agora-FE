import {isRasterCode,codePreviewHeight} from './codePreviewMetrics.js';
import { contentSource } from './content/contentPresentation.js';
import { normalizeGraphicsQuality } from './graphicsQuality.js';
import { objectFontSize } from './objectSize.js';
const richKinds=new Set(['project','text','code','math','note','table','chart','value','question','image','link','pdf','user-group']);
const colors={project:'#dfe8f3',value:'#e4def7',text:'#e1e9e2',code:'#dce9df',math:'#e7def2',note:'#f3ebce',table:'#dfe6ef',chart:'#e6e1f4',question:'#eae3f8',image:'#eaded4',link:'#eaded4',pdf:'#eeded7','user-group':'#e7def2'};
// Small rich objects use overview rendering. Selecting or zooming restores
// their full renderer; persisted objects are never replaced.
export function isOverviewProxy(item,world,scale,quality='low'){
  const heightValue=Number(item?.height)>0?item.height:isRasterCode(item)?codePreviewHeight(item,world.height)/world.height:0;
  if(!(richKinds.has(item?.kind)||item?.runtimeRole) || !(Number(item.width)>0 && heightValue>0))return false;
  const width=item.width*world.width*scale,height=heightValue*world.height*scale;
  const threshold={low:48,medium:32,high:24}[normalizeGraphicsQuality(quality)];
  return Math.min(width,height)<threshold && width*height<threshold*threshold*2;
}
// Half-octave buckets prevent rebuilding every rich object on each wheel tick.
export function overviewScale(scale) {
  return 2 ** (Math.round(Math.log2(Math.max(.0001, Number(scale) || 1)) * 2) / 2);
}
export function overviewProxy(item, world, scale){
  if(world&&!(Number(item.height)>0)&&isRasterCode(item))item={...item,height:codePreviewHeight(item,world.height)/world.height};
  if(world&&scale&&Math.min(item.width*world.width,item.height*world.height)*scale<3) return {kind:'shape',shapeType:'rectangle',x:item.x,y:item.y,width:item.width,height:item.height,rotation:item.rotation,depth:item.depth,fill:colors[item.kind]||'#dce9df',strokeEnabled:false,shadowEnabled:false};
  if (['text', 'code', 'math'].includes(item.kind)) {
    const text = contentSource(item);
    return { kind: 'text', renderMode: 'plain', x: item.x, y: item.y, width: item.width, height: item.height,
      rotation: item.rotation, depth: item.depth, fontSize: objectFontSize(item),
      text: text || ' ', color: item.kind === 'text' ? item.color : undefined,
      ...(item.kind === 'text' ? { automerge_snapshot: item.automerge_snapshot, automerge_changes: item.automerge_changes } : {}), shadowEnabled: false };
  }
  if (item.kind === 'image' && world && (Math.min(item.width * world.width, item.height * world.height) * scale < 2 || item.width * world.width * item.height * world.height * scale * scale < 16)) return { kind: 'shape', shapeType: 'rectangle', x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, depth: item.depth, cornerStyle: item.cornerStyle, fill: '', color: '#9ca99f', strokeEnabled: true, shadowEnabled: false };
  if (item.kind === 'image') return { kind: 'shape', shapeType: 'rectangle',
    x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, depth: item.depth,
    __imagePreview: item.src, cornerStyle: item.cornerStyle, imageFrameEnabled: false, strokeEnabled: false, shadowEnabled: false };

  return {kind:'shape',shapeType:'rectangle',x:item.x,y:item.y,width:item.width,height:item.height,rotation:item.rotation,
    cornerStyle:item.cornerStyle,fill:colors[item.kind],strokeEnabled:false,shadowEnabled:false,depth:item.depth};
}
