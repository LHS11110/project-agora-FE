const MARGIN=256;
/** Bounded GPU command worker. Main-thread presentation reprojects cached pixels
 * immediately, keeping editable DOM and the asynchronous GPU frame aligned. */
export default class WorkerGpuRenderer {
  static create(canvas,width,height,preferWebgl){
    return new Promise((resolve,reject)=>{
      const app=new WorkerGpuRenderer(canvas,width,height);
      const timer=setTimeout(()=>{app.destroy();reject(Error('GPU worker init timed out'));},12000);
      app.worker.onmessage=({data})=>{
        if(data.type==='ready'){
          clearTimeout(timer);
          try{
            app.context=canvas.getContext('bitmaprenderer');
            if(!app.context)throw Error('Bitmap presentation unavailable');
            Object.assign(app,{backend:data.backend,adapter:data.adapter,contextAttributes:data.contextAttributes});
            resolve(app);
          }catch(error){app.destroy();reject(error);}
        }else if(data.type==='failed'){
          clearTimeout(timer);if(!app.context){app.destroy();reject(Error(data.error));}else app.fail(data.error);
        }else if(data.type==='frame')app.receive(data);
      };
      app.worker.onerror=event=>{clearTimeout(timer);if(!app.context){app.destroy();reject(Error(event.message));}else app.fail(event.message);};
      app.worker.postMessage({type:'init',width:app.pixelWidth,height:app.pixelHeight,preferWebgl});
    });
  }
  constructor(canvas,width,height){
    Object.assign(this,{canvas,pixelWidth:Math.max(1,Math.round(width)),pixelHeight:Math.max(1,Math.round(height)),threaded:true,hasFrame:false,version:0,seq:0,inFlight:false,preparing:false,needsFrame:false,disposed:false});
    this.uploads=new Map();this.removed=new Set();
    this.worker=new Worker(new URL('./gpuRenderer.worker.js',import.meta.url),{type:'module',name:'agora-gpu-renderer'});
    canvas.className='vector-gpu-worker-surface';
    Object.assign(canvas.style,{inset:'auto',left:'0',top:'0',transformOrigin:'0 0'});
  }
  backend_kind(){return this.backend;}
  adapter_name(){return this.adapter;}
  width(){return this.pixelWidth;}
  height(){return this.pixelHeight;}
  resize(width,height){this.pixelWidth=Math.max(1,Math.round(width));this.pixelHeight=Math.max(1,Math.round(height));}
  upload_canvas_texture(id,canvas,width,height){if(this.disposed)return false;this.removed.delete(id);this.uploads.set(id,{id,canvas,width,height});return true;}
  remove_texture(id){this.uploads.delete(id);this.removed.add(id);}
  update_scene(words,ids,starts,counts){
    this.scene={words:words.slice(),ids:ids.slice(),starts:starts.slice(),counts:counts.slice()};this.version++;
  }
  render_frame(x,y,scale,viewportWidth,viewportHeight){
    if(this.disposed)return false;
    this.target={camera:{x,y,scale},viewportWidth,viewportHeight};
    this.project();this.needsFrame=true;this.pump();return true;
  }
  project(){
    if(!this.hasFrame||!this.target)return;
    const current=this.target.camera,previous=this.presented.camera,scale=current.scale/previous.scale;
    const x=current.x-(previous.x+this.presented.margin)*scale,y=current.y-(previous.y+this.presented.margin)*scale;
    this.canvas.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
  }
  async pump(){
    if(this.disposed||this.inFlight||this.preparing||!this.needsFrame||!this.target)return;
    this.preparing=true;this.needsFrame=false;this.timeout=setTimeout(()=>this.fail('GPU worker frame timed out'),12000);const uploads=[...this.uploads.values()];this.uploads.clear();
    const scene=this.scene;this.scene=null;const version=this.version,removed=[...this.removed];this.removed.clear();
    let textures=[];
    try{
      // Snapshot atlas pixels once per submitted frame, not once per input event.
      const captured=await Promise.allSettled(uploads.map(async image=>({...image,canvas:undefined,bitmap:await createImageBitmap(image.canvas,{premultiplyAlpha:'premultiply'})})));
      textures=captured.filter(result=>result.status==='fulfilled').map(result=>result.value);
      const rejected=captured.find(result=>result.status==='rejected');if(rejected)throw rejected.reason;
      if(this.disposed){for(const image of textures)image.bitmap.close();return;}
      const target=this.target,ratio=this.pixelWidth/Math.max(1,target.viewportWidth);
      const packet={type:'frame',seq:++this.seq,version,scene,textures,removed,...target,margin:MARGIN,pixelWidth:Math.round((target.viewportWidth+MARGIN*2)*ratio),pixelHeight:Math.round((target.viewportHeight+MARGIN*2)*ratio)};
      const transfer=textures.map(image=>image.bitmap);
      if(scene)transfer.push(scene.words.buffer,scene.ids.buffer,scene.starts.buffer,scene.counts.buffer);
      this.preparing=false;this.inFlight=true;
      this.worker.postMessage(packet,transfer);
    }catch(error){for(const image of textures)try{image.bitmap.close();}catch{}this.fail(error);}
  }
  receive(frame){
    if(this.disposed){frame.bitmap.close();return;}
    clearTimeout(this.timeout);this.inFlight=false;
    if(frame.version===this.version){
      try{
        if(this.canvas.width!==frame.bitmap.width)this.canvas.width=frame.bitmap.width;
        if(this.canvas.height!==frame.bitmap.height)this.canvas.height=frame.bitmap.height;
        this.context.transferFromImageBitmap(frame.bitmap);
        this.presented=frame;this.hasFrame=true;
        this.canvas.style.width=`${frame.viewportWidth+frame.margin*2}px`;this.canvas.style.height=`${frame.viewportHeight+frame.margin*2}px`;
        this.project();this.onFrame?.(frame);
      }catch(error){frame.bitmap.close();this.fail(error);return;}
    }else frame.bitmap.close();
    this.pump();
  }
  lose_context(){this.worker?.postMessage({type:'lose-context'});}
  fail(error){if(this.disposed)return;this.destroy();this.onError?.(String(error));}
  destroy(){if(this.disposed)return;this.disposed=true;clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;this.uploads.clear();this.removed.clear();this.scene=null;this.presented=null;}
  free(){}
}
