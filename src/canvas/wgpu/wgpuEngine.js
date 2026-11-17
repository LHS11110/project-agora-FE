import {createDirectWgpuRenderer} from './wgpuBindings.js';
import WorkerGpuRenderer from './WorkerGpuRenderer.js';
export async function createWgpuRenderer(canvas,width,height,preferWebgl=true){
  if(typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap==='function'){
    try{return await WorkerGpuRenderer.create(canvas,width,height,preferWebgl);}catch{
      // A failed worker initialization must leave the original GPU canvas usable.
      canvas.className='';canvas.style.inset='';canvas.style.left='';canvas.style.top='';canvas.style.transformOrigin='';
    }
  }
  return createDirectWgpuRenderer(canvas,width,height,preferWebgl);
}
export {WgpuSceneBatcher} from './WgpuSceneBatcher.js';
