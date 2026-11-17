let workers=0;

/** One transferable snapshot per content revision; camera motion changes only CSS transforms. */
export default class WorkerFrameCompositor {
  constructor(host,fallback,onChange,stats){
    this.host=host;this.fallback=fallback;this.onChange=onChange;this.stats=stats;
    this.version=-1;this.readyVersion=-1;this.targetVersion=-1;
    if(workers>=4 || typeof Worker==='undefined' || typeof createImageBitmap!=='function' || typeof OffscreenCanvas==='undefined')return;
    try{
      this.canvas=document.createElement('canvas');this.canvas.className='vector-worker-surface';this.canvas.style.display='none';host.insertBefore(this.canvas,fallback);
      this.context=this.canvas.getContext('bitmaprenderer');
      if(!this.context)throw Error('Bitmap presentation unavailable');
      this.worker=new Worker(new URL('./frameCompositor.worker.js',import.meta.url),{type:'module'});
      workers++;this.counted=true;
      this.worker.onmessage=event=>{
        const data=event.data;
        if(this.disposed){data.bitmap?.close();return;}
        if(data.type==='initialized'){this.initialized=true;this.onChange();}
        else if(data.type==='painted'){
          if(data.version!==this.targetVersion || !this.targetFrame?.projection || !this.targetFrame?.sourceCrop){data.bitmap?.close();if(data.version===this.version)this.version=-1;return;}
          try{this.context.transferFromImageBitmap(data.bitmap);}catch{data.bitmap?.close();this.fail();return;}
          this.readyVersion=data.version;this.readyCrop=data.crop;this.stats.workerFrames=(this.stats.workerFrames||0)+1;
          this.active=true;this.position();this.canvas.style.display='';this.fallback.style.display='none';this.host.dataset.compositor='worker';
        }else if(data.type==='failed')this.fail();
      };
      this.worker.onerror=()=>this.fail();
      this.worker.postMessage({type:'init'});
    }catch{this.fail();}
  }
  send(frame,buffer){
    if(!this.worker || !this.initialized || this.disposed)return false;
    this.targetVersion=frame.version;this.targetFrame=frame;this.buffer=buffer;
    if(!frame.sourceCrop || !frame.projection){this.canvas.style.display='none';this.active=false;return false;}
    if(this.version!==frame.version && !this.pending)this.snapshot();
    if(this.active && this.readyVersion===frame.version){this.position();this.canvas.style.display='';return true;}
    this.canvas.style.display='none';this.active=false;return false;
  }
  position(){
    const {ratio,projection}=this.targetFrame||{},crop=this.readyCrop;if(!crop||!projection)return;
    this.canvas.style.width=`${crop.width/ratio}px`;this.canvas.style.height=`${crop.height/ratio}px`;
    this.canvas.style.transformOrigin='top left';
    this.canvas.style.transform=`translate3d(${projection.x+crop.x/ratio*projection.scale}px,${projection.y+crop.y/ratio*projection.scale}px,0) scale(${projection.scale})`;
    this.stats.outputPixels=crop.width*crop.height;
  }
  snapshot(){
    const version=this.targetVersion;
    this.pending=true;
    createImageBitmap(this.buffer).then(bitmap=>{
      this.pending=false;
      if(this.disposed || !this.worker){bitmap.close();return;}
      if(version!==this.targetVersion){bitmap.close();this.snapshot();return;}
      if(!this.targetFrame?.sourceCrop || !this.targetFrame?.projection){bitmap.close();this.version=-1;return;}
      this.version=version;
      this.worker.postMessage({type:'bitmap',bitmap,version,crop:this.targetFrame.sourceCrop},[bitmap]);
    }).catch(()=>{this.pending=false;this.fail();});
  }
  fail(){
    this.worker?.terminate();this.worker=null;this.canvas?.remove();this.active=false;
    if(this.counted){workers--;this.counted=false;}
    this.host.dataset.compositor='main';this.fallback.style.display='';
    if(!this.disposed)this.onChange();
  }
  destroy(){this.disposed=true;this.fail();}
}
