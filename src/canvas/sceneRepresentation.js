import { isRasterCode, codePreviewHeight } from './codePreviewMetrics.js';
import { isHtmlContent } from './content/contentPresentation.js';
import { contentSource } from './content/contentPresentation.js';
import { normalizeGraphicsQuality } from './graphicsQuality.js';
import { objectFontSize } from './objectSize.js';
import { richPreviewSignature } from './richPreviewRaster.js';
const richKinds=new Set(['project','text','code','math','note','table','chart','value','question','image','link','pdf','user-group']);
const colors={project:'#dfe8f3',value:'#e4def7',text:'#e1e9e2',code:'#dce9df',math:'#e7def2',note:'#f3ebce',table:'#dfe6ef',chart:'#e6e1f4',question:'#eae3f8',image:'#eaded4',link:'#eaded4',pdf:'#eeded7','user-group':'#e7def2'};
// Small rich objects use overview rendering. Selecting or zooming restores
// their full renderer; persisted objects are never replaced.
export function isOverviewProxy(item,world,scale,quality='low'){
  if(isHtmlContent(item))return false;
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
export function overviewProxyTier(item, world, scale, quality = 'low') {
  if (!isOverviewProxy(item, world, scale, quality)) return 'full';
  return item?.kind === 'image' ? 'img' : 'ov';
}
export function overviewProxy(item, world, scale){
  if(world&&!(Number(item.height)>0)&&isRasterCode(item))item={...item,height:codePreviewHeight(item,world.height)/world.height};
  const shadowProps = {
    shadowEnabled: item.shadowEnabled,
    shadowBlur: item.shadowBlur,
    shadowOpacity: item.shadowOpacity,
    shadowOffsetX: item.shadowOffsetX,
    shadowOffsetY: item.shadowOffsetY,
  };
  if (item.kind === 'image') {
    return { kind: 'shape', shapeType: 'rectangle',
      x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, depth: item.depth,
      __imagePreview: item.src, cornerStyle: item.cornerStyle, imageFrameEnabled: Boolean(item.imageFrameEnabled),
      brush: item.brush, format: item.format, strokeEnabled: false, ...shadowProps };
  }
  if (!item.runtimeRole && ['text', 'code', 'math'].includes(item.kind)) {
    const text = contentSource(item);
    return { kind: 'text', renderMode: 'plain', x: item.x, y: item.y, width: item.width, height: item.height,
      rotation: item.rotation, depth: item.depth, fontSize: objectFontSize(item),
      text: text || ' ', color: item.kind === 'text' ? item.color : undefined,
      ...(item.kind === 'text' ? { automerge_snapshot: item.automerge_snapshot, automerge_changes: item.automerge_changes } : {}),
      ...shadowProps };
  }

  const overviewKind = item.runtimeRole ? `runtime:${item.runtimeRole}` : item.kind;
  const linkThumb = item.kind === 'link' ? (item.thumbnail || item.previewImage) : undefined;
  return {
    kind: 'shape',
    shapeType: 'rectangle',
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    cornerStyle: item.cornerStyle,
    fill: colors[item.kind] || '#f8fafc',
    color: item.color,
    strokeEnabled: false,
    depth: item.depth,
    brush: item.brush,
    format: item.format,
    __overviewKind: overviewKind,
    __previewKey: richPreviewSignature(item),
    __overviewItem: item,
    ...(linkThumb ? { __imagePreview: linkThumb } : {}),
    ...shadowProps,
  };
}
