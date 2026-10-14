import { objectShadow } from './objectShadow.js';

// A borderless opaque rectangle needs one white geometry texture, regardless
// of its fill. Tint only that fill; outlines, shadows and sketch work stay baked.
export function flatRectangleTint(item){
  if(item?.kind!=='shape' || item.shapeType!=='rectangle' || !(Number(item.width)>0 && Number(item.height)>0) || item.strokeEnabled!==false || item.visualStyle==='sketch' || item.__selectionOutline || objectShadow(item).enabled)return null;
  if(!/^#[0-9a-f]{6}$/i.test(item.fill || ''))return null;
  return Number.parseInt(item.fill.slice(1),16);
}
export function tintRasterItem(item,tint){
  return tint===null?item:{...item,fill:'#ffffff',color:'#ffffff',strokeWidth:0};
}
