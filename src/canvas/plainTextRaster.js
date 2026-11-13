import {mentionRanges} from './comments/mentions.js';
import {isRasterCode} from './codePreviewMetrics.js';
import { contentMode } from './content/contentPresentation.js';
import { objectFontSize } from './objectSize.js';

// Explicit boxes can be painted without a DOM measurement. Rich content and
// auto-height text keep the browser's layout/accessibility and editor behavior.
export const isRasterText = item => item?.kind === 'text' && contentMode(item) === 'plain'
  && Number(item.width)>0 && Number(item.height)>0 && Boolean(item.text);

export const isRasterContent=item=>isRasterText(item)||isRasterCode(item);

export function plainTextLayout(context, item, world, fontFamily) {
  const fontSize=objectFontSize(item),scale=fontSize/13;
  const paddingX=12*scale,paddingY=10*scale,lineHeight=fontSize*1.6;
  const width=Math.max(1,Number(item.width)*world.width-paddingX*2-2);
  const maxLines=Math.ceil(Math.max(0,Number(item.height)*world.height-paddingY*2)/lineHeight);
  context.font=`${fontSize}px ${fontFamily}`;
  const lines=[];
  // Preserve whitespace/newlines. Wrap whole words where possible and break
  // oversized words as CSS overflow-wrap:anywhere does, including CJK text.
  for(const paragraph of String(item.text).split('\n')){
    let line='';
    for(const word of paragraph.match(/\s+|\S+/gu)||[]){
      if(context.measureText(line+word).width<=width){line+=word;continue;}
      if(line){lines.push(line);line='';if(lines.length>maxLines)break;}
      for(const character of word){
        if(line && context.measureText(line+character).width>width){lines.push(line);line='';if(lines.length>maxLines)break;}
        line+=character;
      }
      if(lines.length>maxLines)break;
    }
    if(lines.length>maxLines)break;
    lines.push(line);
    if(lines.length>maxLines)break;
  }
  return {lines,fontSize,paddingX,paddingY,lineHeight};
}

export function drawPlainText(context,item,world,fontFamily,color){
  const layout=plainTextLayout(context,item,world,fontFamily);
  context.save();context.beginPath();
  context.rect(layout.paddingX,layout.paddingY,Math.max(0,item.width*world.width-layout.paddingX*2),Math.max(0,item.height*world.height-layout.paddingY*2));context.clip();
  context.fillStyle=/^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : color;context.textBaseline='top';
  const mentions=mentionRanges(item.text);
  let sourceOffset = 0;
  layout.lines.forEach((line,i)=>{
    const text = String(item.text || ''), found = text.indexOf(line, sourceOffset), start = found < 0 ? sourceOffset : found;
    const y = layout.paddingY+1+i*layout.lineHeight+layout.fontSize*.12, x = layout.paddingX+1;
    if (!item.__textColorRanges?.length&&!mentions.length) context.fillText(line,x,y);
    else {
      const cuts=new Set([0,line.length]);
      for(const r of [...mentions,...(item.__textColorRanges||[])]){if(r.end>start&&r.start<start+line.length){cuts.add(Math.max(0,r.start-start));cuts.add(Math.min(line.length,r.end-start));}}
      const stops=[...cuts].sort((a,b)=>a-b);
      for(let j=0;j<stops.length-1;j++){
        const from=stops[j],to=stops[j+1],position=start+from,piece=line.slice(from,to),left=x+context.measureText(line.slice(0,from)).width;
        const mention=mentions.some(r=>r.start<=position&&r.end>position);
        if(mention){context.fillStyle='#ede7ff';context.fillRect(left,y,context.measureText(piece).width,layout.fontSize*1.25);}
        const range=item.__textColorRanges?.find(r=>r.start<=position&&r.end>position);
        context.fillStyle=mention?'#5939ac':range?.color||(/^#[0-9a-f]{6}$/i.test(item.color||'')?item.color:color);
        context.fillText(piece,left,y);
      }
    }
    sourceOffset = start + line.length;
    if (text[sourceOffset] === '\n') sourceOffset++;
  });
  context.restore();
}
