import {objectFontSize} from './objectSize.js';
import {objectCornerRadius} from './objectCorners.js';
import {contentSource} from './content/contentPresentation.js';
import {codeLanguageAppearance} from './content/codeLanguageAppearance.js';
const keywords=new Set('const let var function return class def import from as if else elif for while in try except finally raise async await public private static void int double float char bool auto using namespace include struct template new delete null None True False true false print self this package interface export default'.split(' '));
const tokenPattern=/(\/\/.*|#.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
export function drawCodePreview(ctx,item,world,fontFamily='ui-monospace,monospace'){
 const width=item.width*world.width,height=item.height*world.height,scale=objectFontSize(item)/13,header=53*scale,footer=34*scale,pad=12*scale,font=13*scale,lineHeight=21*scale;
 const appearance=codeLanguageAppearance(item.language||'javascript'),radius=objectCornerRadius(item,width,height);
 ctx.save();ctx.beginPath();ctx.roundRect(0,0,width,height,radius);ctx.clip();ctx.fillStyle='#192233';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#243249';ctx.fillRect(0,0,width,header);ctx.fillStyle=appearance.accent;ctx.fillRect(0,0,width,2*scale);
 ctx.textBaseline='middle';ctx.font=`${11*scale}px ${fontFamily}`;ctx.fillStyle='#e5edf9';ctx.fillText('</>',44*scale,header/2);ctx.save();ctx.beginPath();ctx.rect(72*scale,0,Math.max(1,width-175*scale),header);ctx.clip();ctx.fillText(item.filename||'코드 스니펫',72*scale,header/2);ctx.restore();
 ctx.fillStyle=appearance.accent;ctx.textAlign='right';ctx.font=`${10*scale}px ${fontFamily}`;ctx.fillText(appearance.label,width-12*scale,header/2);ctx.textAlign='left';
 ctx.save();ctx.beginPath();ctx.rect(pad,header,Math.max(1,width-pad*2),Math.max(0,height-header-footer));ctx.clip();ctx.font=`${font}px ${fontFamily}`;ctx.textBaseline='top';
 const maxLines=Math.max(0,Math.ceil((height-header-footer-pad)/lineHeight));
 for(const [index,line] of contentSource(item).split(/\r\n?|\n/).slice(0,maxLines).entries()){
  let cursor=0,x=pad;const y=header+pad+index*lineHeight;
  const paint=(text,color)=>{ctx.fillStyle=color;ctx.fillText(text.replace(/\t/g,'  '),x,y);x+=ctx.measureText(text.replace(/\t/g,'  ')).width;};
  for(const match of line.matchAll(tokenPattern)){if(x>width)break;paint(line.slice(cursor,match.index),'#dce6f5');const token=match[0],color=/^(\/\/|#)/.test(token)?'#8596b0':/^["']/.test(token)?'#a8d99b':/^\d/.test(token)?'#f2bd88':keywords.has(token)?'#c99bff':'#dce6f5';paint(token,color);cursor=match.index+token.length;}
  if(x<=width)paint(line.slice(cursor),'#dce6f5');
 }
 ctx.restore();ctx.fillStyle='#202d42';ctx.fillRect(0,Math.max(header,height-footer),width,footer);ctx.fillStyle='#40536d';ctx.fillRect(0,header,width,scale);ctx.fillRect(0,height-footer,width,scale);ctx.restore();
 const status=item.__codeStatus,color=status==='running'?'#9e91e8':status==='success'?'#52a57b':status==='error'?'#d46272':null;
 ctx.strokeStyle=color||'#3d506c';ctx.lineWidth=color?2:1;ctx.beginPath();ctx.roundRect(.5,.5,Math.max(1,width-1),Math.max(1,height-1),radius);ctx.stroke();
}
