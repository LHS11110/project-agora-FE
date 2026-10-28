import { contentMode } from './content/contentPresentation.js';
import { objectFontSize } from './objectSize.js';
import { colorPieces } from './content/textColors.js';

// Explicit boxes can be painted without a DOM measurement. Rich content and
// auto-height text keep the browser's layout/accessibility and editor behavior.
export const isRasterText = item => item?.kind === 'text' && contentMode(item) === 'plain'
  && Number(item.width)>0 && Number(item.height)>0 && Boolean(item.text);

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
  let sourceOffset = 0;
  layout.lines.forEach((line,i)=>{
    const text = String(item.text || ''), found = text.indexOf(line, sourceOffset), start = found < 0 ? sourceOffset : found;
    const y = layout.paddingY+1+i*layout.lineHeight+layout.fontSize*.12, x = layout.paddingX+1;
    if (!item.__textColorRanges?.length) context.fillText(line,x,y);
    else {
      let prefix = '';
      for (const piece of colorPieces(line,item.__textColorRanges,start)) {
        context.fillStyle = piece.color || (/^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : color);
        context.fillText(piece.text,x+context.measureText(prefix).width,y);prefix += piece.text;
      }
    }
    sourceOffset = start + line.length;
    if (text[sourceOffset] === '\n') sourceOffset++;
  });
  context.restore();
}
