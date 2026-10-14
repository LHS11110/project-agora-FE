import { CanvasSource, Rectangle, Texture } from 'pixi.js';

// Shelf packing with recycled slots keeps texture count independent of object count.
export class AtlasPageSlots {
  constructor(size = 1024) { this.size=size; this.x=0; this.y=0; this.rowHeight=0; this.free=[]; }
  allocate(width,height) {
    if (width>this.size || height>this.size) return null;
    const index=this.free.findIndex(slot=>slot.width>=width && slot.height>=height);
    if (index>=0) return this.free.splice(index,1)[0];
    if (this.x+width>this.size) { this.x=0;this.y+=this.rowHeight;this.rowHeight=0; }
    if (this.y+height>this.size) return null;
    const slot={x:this.x,y:this.y,width,height};this.x+=width;this.rowHeight=Math.max(this.rowHeight,height);return slot;
  }
  release(slot) { this.free.push(slot); }
}

export class RasterTextureAtlas {
  constructor(size=1024,maxPages=8) { this.size=size;this.maxPages=maxPages;this.pages=[];this.standalone=new Set(); }
  allocate(canvas) {
    const width=canvas.width+4,height=canvas.height+4;
    let page,slot;
    for (const candidate of this.pages) { slot=candidate.slots.allocate(width,height);if(slot){page=candidate;break;} }
    if (!slot && width<=this.size && height<=this.size && this.pages.length<this.maxPages) {
      const bitmap=document.createElement('canvas');bitmap.width=bitmap.height=this.size;
      page={canvas:bitmap,context:bitmap.getContext('2d'),source:new CanvasSource({resource:bitmap}),slots:new AtlasPageSlots(this.size),dirty:false};
      this.pages.push(page);slot=page.slots.allocate(width,height);
    }
    if (!slot) { const handle={texture:Texture.from(canvas)};this.standalone.add(handle);return handle; }
    page.context.clearRect(slot.x,slot.y,slot.width,slot.height);
    page.context.drawImage(canvas,slot.x+2,slot.y+2);page.dirty=true;
    return {page,slot,texture:new Texture({source:page.source,frame:new Rectangle(slot.x+2,slot.y+2,canvas.width,canvas.height)})};
  }
  release(handle) {
    handle.texture.destroy(!handle.page);
    if(handle.page) handle.page.slots.release(handle.slot);
    else this.standalone.delete(handle);
  }
  flush() { for(const page of this.pages) if(page.dirty){page.source.update();page.dirty=false;} }
  destroy() {
    for(const handle of this.standalone)handle.texture.destroy(true);this.standalone.clear();
    for(const page of this.pages){page.source.destroy();page.canvas.width=page.canvas.height=1;}this.pages=[];
  }
}
