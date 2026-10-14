import { minimapBitmapProjection } from './minimapBitmapProjection.js';
import { useLayoutEffect, useRef } from 'react';

// One bitmap replaces thousands of SVG nodes; the viewport stays in the SVG overlay.
export default function CanvasMinimapObjects({ minimap, colors, selected }) {
  const ref = useRef(null);
  const cache=useRef(null);
  useLayoutEffect(() => {
    const canvas=ref.current;
    const paint=()=>{
      const ratio=Math.min(window.devicePixelRatio||1,2),width=canvas.clientWidth,height=canvas.clientHeight;
      if (!width || !height) return;
      if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);cache.current=null;}
      const ctx=canvas.getContext('2d'),overview=minimap.bounds;
      const previous=cache.current,pad=32;
      const projection=previous?minimapBitmapProjection(previous.bounds,overview,width,height,pad):null;
      const moving=canvas.closest('.canvas-stage')?.classList.contains('camera-moving');
      const sameScale=previous && Math.abs(previous.bounds.width-overview.width)<1e-6 && Math.abs(previous.bounds.height-overview.height)<1e-6;
      if(previous && previous.items===minimap.items && previous.selected===selected && (sameScale || moving) && (projection.covers || previous.complete)){
        ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(previous.canvas,projection.x*ratio,projection.y*ratio,previous.canvas.width*projection.scaleX,previous.canvas.height*projection.scaleY);return;
      }
      const bitmap=previous?.canvas || document.createElement('canvas');
      bitmap.width=Math.round((width+pad*2)*ratio);bitmap.height=Math.round((height+pad*2)*ratio);
      let complete=true;const paint=bitmap.getContext('2d');paint.setTransform(ratio,0,0,ratio,pad*ratio,pad*ratio);
      for(const {id,item,bounds} of minimap.items){
        const w=Math.max(bounds.maxX-bounds.minX,overview.width*.008),h=Math.max(bounds.maxY-bounds.minY,overview.height*.008);
        const x=((bounds.minX+bounds.maxX-w)/2-overview.minX)/overview.width*width;
        const y=((bounds.minY+bounds.maxY-h)/2-overview.minY)/overview.height*height;
        const markerWidth=w/overview.width*width,markerHeight=h/overview.height*height;
        if(x-2 < -pad || y-2 < -pad || x+markerWidth+2 > width+pad || y+markerHeight+2 > height+pad)complete=false;
        const chosen=selected.has(String(id));paint.globalAlpha=chosen?1:.82;
        paint.fillStyle=item.color||colors[item.kind]||'#809084';
        paint.fillRect(x,y,w/overview.width*width,h/overview.height*height);
        if(chosen){paint.globalAlpha=1;paint.strokeStyle='#c28b43';paint.lineWidth=1.5;paint.strokeRect(x,y,w/overview.width*width,h/overview.height*height)}
      }
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,-pad*ratio,-pad*ratio);
      cache.current={canvas:bitmap,bounds:overview,items:minimap.items,selected,complete};
    };
    let frame=requestAnimationFrame(paint);
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint)});
    observer.observe(canvas);
    return()=>{cancelAnimationFrame(frame);observer.disconnect()};
  },[minimap,colors,selected]);
  return <canvas ref={ref} className="canvas-minimap-svg" aria-hidden="true" />;
}
