import {createDirectWgpuRenderer} from './wgpuBindings.js';
let renderer,canvas;
// Textures each layer uploaded, so releasing a layer frees exactly its own.
const layerTextures=new Map();
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      canvas=new OffscreenCanvas(Math.max(1,data.width),Math.max(1,data.height));
      // wgpu's WebGL backend asks only for antialias:false, so WebGL's defaults add a
      // depth buffer the renderer never uses (one full-surface buffer per worker).
      // A context created first with lean options is the one wgpu then receives.
      if(data.preferWebgl||!self.navigator?.gpu)canvas.getContext('webgl2',{antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,premultipliedAlpha:true,alpha:true});
      renderer=await createDirectWgpuRenderer(canvas,data.width,data.height,data.preferWebgl);
      const gl=renderer.backend_kind()==='webgl'?canvas.getContext('webgl2'):null;
      canvas.addEventListener('webglcontextlost',()=>self.postMessage({type:'failed',error:'GPU_CONTEXT_LOST'}));
      self.postMessage({type:'ready',backend:renderer.backend_kind(),adapter:renderer.adapter_name(),contextAttributes:gl?.getContextAttributes?.()||null});
    }else if(data.type==='frame'){
      if(!renderer)throw Error('GPU worker not initialized');
      const start=performance.now();
      let owned=layerTextures.get(data.layer);if(!owned)layerTextures.set(data.layer,owned=new Set());
      renderer.select_scene(data.layer);
      for(const id of data.removed){renderer.remove_texture(id);owned.delete(id);}
      for(const image of data.textures){const ok=image.region?renderer.upload_canvas_subtexture(image.id,image.bitmap,image.region.size,image.region.size,image.region.x,image.region.y):renderer.upload_canvas_texture(image.id,image.bitmap,image.width,image.height);if(!ok)throw Error('Texture upload failed');owned.add(image.id);}
      if(data.scene)renderer.update_scene(data.scene.words,data.scene.ids,data.scene.starts,data.scene.counts);
      const {camera,viewportWidth,viewportHeight,pixelWidth,pixelHeight,margin}=data;
      renderer.resize(pixelWidth,pixelHeight);
      const prepared=performance.now();
      if(!renderer.render_frame(camera.x+margin,camera.y+margin,camera.scale,viewportWidth+margin*2,viewportHeight+margin*2))throw Error(renderer.last_error()||'GPU surface unavailable');
      const submitted=performance.now();
      for(const image of data.textures)image.bitmap.close();
      const bitmap=canvas.transferToImageBitmap();
      self.postMessage({type:'frame',layer:data.layer,seq:data.seq,version:data.version,camera,viewportWidth,viewportHeight,margin,bitmap,timings:{sceneMs:prepared-start,submitMs:submitted-prepared,exportMs:performance.now()-submitted,workerMs:performance.now()-start}},[bitmap]);
    }else if(data.type==='release'){
      for(const id of layerTextures.get(data.layer)||[])renderer?.remove_texture(id);
      layerTextures.delete(data.layer);renderer?.remove_scene(data.layer);
    }else if(data.type==='lose-context'){
      canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }catch(error){for(const image of data.textures||[])try{image.bitmap.close();}catch{}self.postMessage({type:'failed',layer:data.type==='frame'?data.layer:undefined,error:String(error)});}
};
