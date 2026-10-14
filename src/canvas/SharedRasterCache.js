// Retain bounded, unreferenced bitmaps so a quick pan back doesn't rasterize again.
// Live resources are owned by records; eviction never invalidates a visible sprite.
export default class SharedRasterCache {
  constructor(dispose, maxIdlePixels = 8_000_000, maxIdleEntries = 512) {
    this.dispose=dispose;this.maxIdlePixels=maxIdlePixels;this.maxIdleEntries=maxIdleEntries;
    this.live=new Map();this.idle=new Map();this.idlePixels=0;
  }
  acquire(key, create) {
    let resource=this.live.get(key) || this.idle.get(key);
    if(resource && !resource.refs){this.idle.delete(key);this.idlePixels-=resource.pixels;}
    if(!resource){const raster=create();resource={key,raster,refs:0,pixels:raster.canvas.width*raster.canvas.height};}
    resource.refs++;this.live.set(key,resource);return resource;
  }
  release(resource) {
    if(--resource.refs) return;
    this.live.delete(resource.key);this.idle.set(resource.key,resource);this.idlePixels+=resource.pixels;
    while(this.idlePixels>this.maxIdlePixels || this.idle.size>this.maxIdleEntries){
      const [key,old]=this.idle.entries().next().value;
      this.idle.delete(key);this.idlePixels-=old.pixels;this.dispose(old);
    }
  }
  destroy(){for(const resource of [...this.live.values(),...this.idle.values()])this.dispose(resource);this.live.clear();this.idle.clear();this.idlePixels=0;}
}
