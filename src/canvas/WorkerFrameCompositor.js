let workers=0;

/** One transferable snapshot per content revision; camera motion changes only CSS transforms. */
export default class WorkerFrameCompositor {
  constructor(host,fallback,onChange,stats){
    this.host=host;this.fallback=fallback;this.onChange=onChange;this.stats=stats;
    this.version=-1;this.readyVersion=-1;this.targetVersion=-1;
    if(workers>=4 || typeof Worker==='undefined' || typeof createImageBitmap!=='function' || typeof HTMLCanvasElement.prototype.transferControlToOffscreen!=='function')return;
    try{
      this.canvas=document.createElement('canvas');this.canvas.className='vector-worker-surface';this.canvas.style.display='none';host.insertBefore(this.canvas,fallback);
      this.worker=new Worker(new URL('./frameCompositor.worker.js',import.meta.url),{type:'module'});
      workers++;this.counted=true;
      this.worker.onmessage=event=>{
        const data=event.data;
        if(this.disposed)return;
        if(data.type==='initialized'){this.initialized=true;this.onChange();}
        else if(data.type==='painted'){
          this.readyVersion=data.version;this.readyCrop=data.crop;this.stats.workerFrames=(this.stats.workerFrames||0)+1;
          if(data.version===this.targetVersion){this.active=true;this.position();this.canvas.style.display='';this.fallback.style.display='none';this.host.dataset.compositor='worker';}
        }else if(data.type==='failed')this.fail();
      };
      this.worker.onerror=()=>this.fail();
      const offscreen=this.canvas.transferControlToOffscreen();
      this.worker.postMessage({type:'init',canvas:offscreen},[offscreen]);
    }catch{this.fail();}
  }
  send(frame,buffer){
    if(!this.worker || !this.initialized || this.disposed)return false;
    this.targetVersion=frame.version;this.targetFrame=frame;this.buffer=buffer;
    if(!frame.sourceCrop){this.canvas.style.display='none';this.active=false;return false;}
    if(this.version!==frame.version && !this.pending)this.snapshot();
    if(this.active && this.readyVersion===frame.version){this.position();this.canvas.style.display='';return true;}
    this.canvas.style.display='none';this.active=false;return false;
  }
  position(){
    const {ratio,projection}=this.targetFrame,crop=this.readyCrop;if(!crop)return;
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
