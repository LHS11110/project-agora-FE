// A borderless rectangle needs one white geometry texture, regardless
// of its fill. Tint only that fill; outlines, shadows and sketch work stay baked.
export function flatRectangleTint(item){
  if(item?.kind!=='shape' || item.shapeType!=='rectangle' || item.__overviewKind || !(Number(item.width)>0 && Number(item.height)>0) || item.strokeEnabled!==false || item.cornerStyle==='rounded' || item.visualStyle==='sketch' || item.__selectionOutline || item.shadowEnabled!==false)return null;
  const fill=item.fill;
  if(!fill || fill.length!==7 || fill.charCodeAt(0)!==35)return null;
  const parsed=Number.parseInt(fill.slice(1),16);
  return /^#[0-9a-f]{6}$/i.test(fill) ? parsed : null;
}
export function tintRasterItem(item,tint){
  return tint===null?item:{...item,fill:'#ffffff',color:'#ffffff',strokeWidth:0};
}
