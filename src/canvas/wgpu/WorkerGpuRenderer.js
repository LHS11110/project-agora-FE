const MARGIN=192,INTERACTIVE_FRAME_MS=120,MAX_UPLOADS_PER_FRAME=8;
/** Bounded GPU command worker. Main-thread presentation reprojects cached pixels
 * immediately, keeping editable DOM and the asynchronous GPU frame aligned. */
export default class WorkerGpuRenderer {
  static create(canvas,width,height,preferWebgl){
    const app=new WorkerGpuRenderer(canvas,width,height);
    return GpuWorkerHost.acquire(app,preferWebgl).then(host=>{
      try{
        app.context=canvas.getContext('bitmaprenderer');
        if(!app.context)throw Error('Bitmap presentation unavailable');
        Object.assign(app,{host,backend:host.backend,adapter:host.adapter,contextAttributes:host.contextAttributes});
        return app;
      }catch(error){app.destroy();throw error;}
    },error=>{app.destroy();throw error;});
  }
  constructor(canvas,width,height){
    Object.assign(this,{canvas,layer:++GpuWorkerHost.nextLayer,pixelWidth:Math.max(1,Math.round(width)),pixelHeight:Math.max(1,Math.round(height)),threaded:true,hasFrame:false,version:0,seq:0,inFlight:false,preparing:false,needsFrame:false,disposed:false});
    this.telemetry={submitted:0,completed:0,presented:0,discarded:0,maxPending:0,samples:[]};
    this.uploads=new Map();this.removed=new Set();this.dragOffset={dx:0,dy:0};
    canvas.className='vector-gpu-worker-surface';
    Object.assign(canvas.style,{inset:'auto',left:'0',top:'0',transformOrigin:'0 0'});
  }
  backend_kind(){return this.backend;}
  adapter_name(){return this.adapter;}
  width(){return this.pixelWidth;}
  height(){return this.pixelHeight;}
  resize(width,height){this.pixelWidth=Math.max(1,Math.round(width));this.pixelHeight=Math.max(1,Math.round(height));}
  upload_canvas_texture(id,canvas,width,height){if(this.disposed)return false;this.removed.delete(id);this.uploads.set(id,{id,canvas,width,height});return true;}
  remove_texture(id){this.uploads.delete(id);for(const [key,upload] of this.uploads)if(upload.id===id)this.uploads.delete(key);this.removed.add(id);}
  /** Upload `canvas` (plus a 2px transparent gutter) into texture `id` at (x,y). */
  upload_canvas_region(id,canvas,size,x,y){if(this.disposed)return false;this.removed.delete(id);this.uploads.set(`${id}@${x},${y}`,{id,canvas,region:{size,x,y},release:true});return true;}
  /** Free a source canvas once its pixels have been captured for upload. */
  release_after_upload(canvas){for(const upload of this.uploads.values())if(upload.canvas===canvas){upload.release=true;return;}if(canvas)canvas.width=canvas.height=1;}
  set_drag_offset(dx,dy){
    const nx=Number.isFinite(dx)?dx:0,ny=Number.isFinite(dy)?dy:0;
    if(this.dragOffset.dx===nx&&this.dragOffset.dy===ny)return;
    this.dragOffset={dx:nx,dy:ny};
  }
  update_scene(words,ids,starts,counts){
    this.scene={words:words.slice(),ids:ids.slice(),starts:starts.slice(),counts:counts.slice()};this.version++;
  }
  render_frame(x,y,scale,viewportWidth,viewportHeight){
    if(this.disposed)return false;
    this.target={camera:{x,y,scale},viewportWidth,viewportHeight};
    this.project();this.needsFrame=true;this.pump();return true;
  }
  reprojectionCovers(){
    const presented=this.presented,target=this.target;
    if(!presented||!target)return false;
    const k=target.camera.scale/presented.camera.scale;
    const x=target.camera.x-(presented.camera.x+presented.margin)*k,y=target.camera.y-(presented.camera.y+presented.margin)*k;
    return x<=0&&y<=0&&x+(presented.viewportWidth+presented.margin*2)*k>=target.viewportWidth&&y+(presented.viewportHeight+presented.margin*2)*k>=target.viewportHeight;
  }
  project(){
    if(!this.hasFrame||!this.target)return;
    const current=this.target.camera,previous=this.presented.camera,scale=current.scale/previous.scale;
    const x=current.x-(previous.x+this.presented.margin)*scale,y=current.y-(previous.y+this.presented.margin)*scale;
    const transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
    if(this.canvas.style.transform!==transform)this.canvas.style.transform=transform;
  }
  async pump(){
    if(this.disposed||this.inFlight||this.preparing||!this.needsFrame||!this.target)return;
    // A camera gesture is presented by reprojecting the last frame (project()). While
    // that still covers the viewport no new worker frame is rendered: each one is a
    // full-surface GPU render and bitmap transfer competing with the compositor.
    // Frames resume (paced) once zooming out exposes an edge, and on settle.
    const dragChanged=Boolean(this.presented&&((this.presented.dragOffset?.dx||0)!==this.dragOffset.dx||(this.presented.dragOffset?.dy||0)!==this.dragOffset.dy));
    if(this.interactive&&this.hasFrame&&!dragChanged&&!this.scene&&!this.uploads.size&&!this.removed.size){
      if(this.reprojectionCovers()){return;}
      const wait=INTERACTIVE_FRAME_MS-(performance.now()-(this.sentAt||0));
      if(wait>0){if(!this.paceTimer)this.paceTimer=setTimeout(()=>{this.paceTimer=null;this.pump();},wait);return;}
    }
    this.preparing=true;this.needsFrame=false;this.timeout=setTimeout(()=>this.fail('GPU worker frame timed out'),12000);
    const uploads=[];
    if(this.uploads.size<=MAX_UPLOADS_PER_FRAME){
      for(const u of this.uploads.values())uploads.push(u);
      this.uploads.clear();
    }else{
      for(const [k,u] of this.uploads){
        uploads.push(u);this.uploads.delete(k);
        if(uploads.length>=MAX_UPLOADS_PER_FRAME)break;
      }
      this.needsFrame=true;
    }
    const scene=this.uploads.size?null:this.scene;if(!this.uploads.size)this.scene=null;
    const version=this.version,removed=[...this.removed];this.removed.clear();
    let textures=[];const captureStart=performance.now();
    try{
      // Snapshot atlas pixels once per submitted frame, not once per input event.
      const capture=async image=>{
        const bitmap=image.region?await createImageBitmap(image.canvas,-2,-2,image.canvas.width+4,image.canvas.height+4,{premultiplyAlpha:'premultiply'}):await createImageBitmap(image.canvas,{premultiplyAlpha:'premultiply'});
        if(image.release&&image.canvas)image.canvas.width=image.canvas.height=1;
        return {...image,canvas:undefined,bitmap};
      };
      const captured=uploads.length?await Promise.allSettled(uploads.map(capture)):[];
      textures=captured.filter(result=>result.status==='fulfilled').map(result=>result.value);
      const rejected=captured.find(result=>result.status==='rejected');if(rejected)throw rejected.reason;
      if(this.disposed){for(const image of textures)image.bitmap.close();return;}
      const target=this.target,ratio=this.pixelWidth/Math.max(1,target.viewportWidth);
      const dragOffset={dx:this.dragOffset.dx,dy:this.dragOffset.dy};
      const packet={type:'frame',layer:this.layer,seq:++this.seq,version,scene,textures,removed,dragOffset,...target,margin:MARGIN,pixelWidth:Math.round((target.viewportWidth+MARGIN*2)*ratio),pixelHeight:Math.round((target.viewportHeight+MARGIN*2)*ratio)};
      const transfer=textures.map(image=>image.bitmap);
      if(scene)transfer.push(scene.words.buffer,scene.ids.buffer,scene.starts.buffer,scene.counts.buffer);
      this.captureMs=performance.now()-captureStart;this.sentAt=performance.now();
      this.telemetry.submitted++;this.telemetry.maxPending=Math.max(this.telemetry.maxPending,1);
      this.preparing=false;this.inFlight=true;
      (this.host||=GpuWorkerHost.attach(this)).post(packet,transfer);
    }catch(error){for(const image of textures)try{image.bitmap.close();}catch{}this.fail(error);}
  }
  receive(frame){
    if(this.disposed){frame.bitmap.close();return;}
    const receivedAt=performance.now();this.telemetry.completed++;
    clearTimeout(this.timeout);this.inFlight=false;
    if(frame.version===this.version){
      try{
        if(this.canvas.width!==frame.bitmap.width)this.canvas.width=frame.bitmap.width;
        if(this.canvas.height!==frame.bitmap.height)this.canvas.height=frame.bitmap.height;
        this.context.transferFromImageBitmap(frame.bitmap);
        this.telemetry.presented++;
        this.presented=frame;this.hasFrame=true;
        const width=`${frame.viewportWidth+frame.margin*2}px`,height=`${frame.viewportHeight+frame.margin*2}px`;
        if(this.canvas.style.width!==width)this.canvas.style.width=width;
        if(this.canvas.style.height!==height)this.canvas.style.height=height;
        this.project();this.onFrame?.(frame);
      }catch(error){frame.bitmap.close();this.fail(error);return;}
    }else{this.telemetry.discarded++;frame.bitmap.close();}
    const sentAt = this.sentAt || receivedAt;
    this.telemetry.samples.push({sentAt,receivedAt,roundTripMs:Math.max(0,receivedAt-sentAt),captureMs:this.captureMs||0,presentationMs:performance.now()-receivedAt,...frame.timings});
    if(this.telemetry.samples.length>240)this.telemetry.samples.shift();
    this.pump();
  }
  lose_context(){this.host?.post({type:'lose-context'});}
  fail(error){if(this.disposed)return;this.destroy();this.onError?.(String(error));}
  destroy(){clearTimeout(this.paceTimer);this.paceTimer=null;if(this.disposed)return;this.disposed=true;clearTimeout(this.timeout);
    GpuWorkerHost.release(this);this.host=null;
    // Drop the presented frame bitmap now; a removed canvas otherwise holds it until GC.
    // transferFromImageBitmap(null) allocates a cleared bitmap at the canvas size,
    // which took 15-40ms on a HiDPI viewport during layer unmount; shrink first.
    try{const canvas=this.context?.canvas;if(canvas){canvas.width=1;canvas.height=1;}this.context?.transferFromImageBitmap(null);}catch{}this.uploads.clear();this.removed.clear();this.scene=null;this.presented=null;}
  free(){}
  /** Terminates the shared worker (tests, or a full GPU reset). */
  static resetSharedWorker(){GpuWorkerHost.reset();}
}

/** One GPU worker (one WebGL context, surface and texture store) shared by every
 * depth layer: each layer is a scene in the same renderer, rendered in turn and
 * returned as its own bitmap. A worker per layer cost a full set of surfaces and
 * a WebGL device each. */
class GpuWorkerHost {
  static nextLayer=0;
  static current=null;
  static attach(app,preferWebgl=true){
    let host=GpuWorkerHost.current;
    if(!host||host.dead){host=GpuWorkerHost.current=new GpuWorkerHost(app.pixelWidth,app.pixelHeight,preferWebgl);}
    clearTimeout(host.idleTimer);host.idleTimer=null;
    host.layers.set(app.layer,app);
    return host;
  }
  static acquire(app,preferWebgl){return GpuWorkerHost.attach(app,preferWebgl).ready;}
  static reset(){GpuWorkerHost.current?.terminate();}
  static release(app){
    const host=app.host||GpuWorkerHost.current;
    if(!host||!host.layers.delete(app.layer))return;
    if(!host.dead)host.post({type:'release',layer:app.layer});
    if(!host.layers.size&&!host.dead){host.idleTimer=setTimeout(()=>{if(!host.layers.size)host.terminate();},5000);host.idleTimer?.unref?.();}
  }
  constructor(width,height,preferWebgl){
    this.layers=new Map();this.dead=false;this.idleTimer=null;
    this.worker=new Worker(new URL('./gpuRenderer.worker.js',import.meta.url),{type:'module',name:'agora-gpu-renderer'});
    this.ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.failAll('GPU worker init timed out');reject(Error('GPU worker init timed out'));},12000);timer?.unref?.();
      this.initTimer=timer;
      this.worker.onmessage=({data})=>{
        if(data.type==='ready'){clearTimeout(timer);Object.assign(this,{backend:data.backend,adapter:data.adapter,contextAttributes:data.contextAttributes});resolve(this);}
        else if(data.type==='frame')this.layers.get(data.layer)?.receive(data);
        else if(data.type==='failed'){
          clearTimeout(timer);
          if(data.layer!=null&&this.layers.has(data.layer))this.layers.get(data.layer).fail(data.error);
          else{this.failAll(data.error);reject(Error(data.error));}
        }
      };
      this.worker.onerror=event=>{clearTimeout(timer);this.failAll(event.message);reject(Error(event.message));};
    });
    this.ready.catch(()=>{});
    this.worker.postMessage({type:'init',width,height,preferWebgl});
  }
  post(message,transfer){if(!this.dead)this.worker.postMessage(message,transfer||[]);}
  failAll(error){
    if(this.dead)return;this.terminate();
    for(const app of [...this.layers.values()])app.fail(error);
    this.layers.clear();
  }
  terminate(){this.dead=true;clearTimeout(this.idleTimer);clearTimeout(this.initTimer);this.worker?.terminate();this.worker=null;if(GpuWorkerHost.current===this)GpuWorkerHost.current=null;}
}
