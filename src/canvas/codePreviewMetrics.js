import {contentMode,contentSource} from './content/contentPresentation.js';
import {objectFontSize} from './objectSize.js';
export const isRasterCode=item=>['text','code'].includes(item?.kind)&&contentMode(item)==='code'&&Number(item.width)>0;
export function codePreviewHeight(item,worldHeight=1000){
 if(Number(item.height)>0)return item.height*worldHeight;
 const source=contentSource(item),lines=Math.max(1,source.split(/\r\n?|\n/).length-(source.endsWith('\n')||source.endsWith('\r')?1:0));
 return (89+Math.max(45,24+lines*21))*objectFontSize(item)/13;
}
