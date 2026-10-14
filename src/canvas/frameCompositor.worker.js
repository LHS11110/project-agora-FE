let canvas,context,version=-1;
self.onmessage=event=>{
  const data=event.data;
  try{
    if(data.type==='init'){
      canvas=data.canvas;context=canvas.getContext('2d',{alpha:true,desynchronized:true});
      if(!context)throw Error('Worker canvas unavailable');
      self.postMessage({type:'initialized'});
    }else if(data.type==='bitmap'){
      try{
        if(data.version<version)return;
        const crop=data.crop;
        canvas.width=Math.max(1,crop.width);canvas.height=Math.max(1,crop.height);
        context.drawImage(data.bitmap,crop.x,crop.y,crop.width,crop.height,0,0,crop.width,crop.height);
        version=data.version;
        self.postMessage({type:'painted',version,crop});
      }finally{data.bitmap.close();}
    }
  }catch{self.postMessage({type:'failed'});}
};
