import {createDirectWgpuRenderer} from './wgpuBindings.js';
let renderer,canvas;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      canvas=new OffscreenCanvas(Math.max(1,data.width),Math.max(1,data.height));
      renderer=await createDirectWgpuRenderer(canvas,data.width,data.height,data.preferWebgl);
      const gl=renderer.backend_kind()==='webgl'?canvas.getContext('webgl2'):null;
      canvas.addEventListener('webglcontextlost',()=>self.postMessage({type:'failed',error:'GPU_CONTEXT_LOST'}));
      self.postMessage({type:'ready',backend:renderer.backend_kind(),adapter:renderer.adapter_name(),contextAttributes:gl?.getContextAttributes?.()||null});
    }else if(data.type==='frame'){
      if(!renderer)throw Error('GPU worker not initialized');
      for(const id of data.removed)renderer.remove_texture(id);
      for(const image of data.textures){if(!renderer.upload_canvas_texture(image.id,image.bitmap,image.width,image.height))throw Error('Texture upload failed');}
      if(data.scene)renderer.update_scene(data.scene.words,data.scene.ids,data.scene.starts,data.scene.counts);
      const {camera,viewportWidth,viewportHeight,pixelWidth,pixelHeight,margin}=data;
      renderer.resize(pixelWidth,pixelHeight);
      if(!renderer.render_frame(camera.x+margin,camera.y+margin,camera.scale,viewportWidth+margin*2,viewportHeight+margin*2))throw Error(renderer.last_error()||'GPU surface unavailable');
      for(const image of data.textures)image.bitmap.close();
      const bitmap=canvas.transferToImageBitmap();
      self.postMessage({type:'frame',seq:data.seq,version:data.version,camera,viewportWidth,viewportHeight,margin,bitmap},[bitmap]);
    }else if(data.type==='lose-context'){
      canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }catch(error){for(const image of data.textures||[])try{image.bitmap.close();}catch{}self.postMessage({type:'failed',error:String(error)});}
};
