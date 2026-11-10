import {parseGIF,decompressFrame} from 'gifuct-js';
let gif,frames,starts,duration,canvas,ctx,patch,index=-1,previous=null,restore=null;
function clear(x=0,y=0,w=canvas.width,h=canvas.height){ctx.clearRect(x,y,w,h);if(previous?.transparentIndex===undefined){const c=gif.gct?.[gif.lsd.backgroundColorIndex];if(c){ctx.fillStyle=`rgb(${c.join(',')})`;ctx.fillRect(x,y,w,h);}}}
function draw(n){
 if(previous?.disposalType===2)clear(previous.dims.left,previous.dims.top,previous.dims.width,previous.dims.height);
 else if(previous?.disposalType===3&&restore)ctx.putImageData(restore,0,0);
 const frame=decompressFrame(frames[n],gif.gct,true);
 restore=frame.disposalType===3?ctx.getImageData(0,0,canvas.width,canvas.height):null;
 patch.width=frame.dims.width;patch.height=frame.dims.height;patch.getContext('2d').putImageData(new ImageData(frame.patch,patch.width,patch.height),0,0);
 ctx.drawImage(patch,frame.dims.left,frame.dims.top);previous=frame;index=n;
}
self.onmessage=async({data})=>{try{
 if(data.type==='load'){
  gif=parseGIF(data.buffer);const {width,height}=gif.lsd;if(width<1||height<1||width*height>4194304)throw Error('GIF 해상도는 400만 픽셀 이하여야 합니다.');
  frames=gif.frames.filter(f=>f.image);if(!frames.length||frames.length>5000)throw Error('GIF 프레임은 1~5,000개여야 합니다.');
  duration=0;starts=frames.map(f=>{const d=f.image.descriptor;if(!d.width||!d.height||d.left+d.width>width||d.top+d.height>height)throw Error('GIF 프레임 좌표가 올바르지 않습니다.');const t=duration;duration+=Math.max(20,(f.gce?.delay||10)*10);return t;});
  canvas=new OffscreenCanvas(width,height);ctx=canvas.getContext('2d',{willReadFrequently:true});patch=new OffscreenCanvas(1,1);index=-1;previous=null;restore=null;
  self.postMessage({type:'ready',width,height,duration:duration/1000});
 }else if(data.type==='render'&&frames){
  const t=Math.min(duration-1,Math.max(0,data.time*1000));let target=starts.length-1;for(let n=0;n<starts.length;n++)if(starts[n]>t){target=n-1;break;}
  if(target===index){self.postMessage({type:'unchanged'});return;}
  if(target<index){index=-1;previous=null;restore=null;ctx.clearRect(0,0,canvas.width,canvas.height);}
  for(let n=index+1;n<=target;n++)draw(n);
  // Copy the composited canvas: transferToImageBitmap would clear it and lose disposal history.
  const bitmap=await createImageBitmap(canvas);self.postMessage({type:'frame',bitmap},[bitmap]);
 }
}catch(error){self.postMessage({type:'error',message:error.message||'GIF를 재생하지 못했습니다.'});}};
