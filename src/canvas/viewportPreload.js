// Half a viewport in each direction, with a useful minimum on small screens.
// Values are screen pixels; callers convert them to world coordinates at zoom.
export function viewportPreloadPadding(viewport) {
  return {x:Math.max(256,(Number(viewport?.width)||0)*.5),y:Math.max(256,(Number(viewport?.height)||0)*.5)};
}

// Keep only the nearest cache-sized set: no full-array sort or unbounded map.
export class PreloadImageSelector {
  constructor(visible,limit=64){this.visible=visible;this.limit=limit;this.rows=[];this.bySource=new Map();this.cx=(visible.minX+visible.maxX)/2;this.cy=(visible.minY+visible.maxY)/2;this.width=Math.max(1e-9,visible.maxX-visible.minX);this.height=Math.max(1e-9,visible.maxY-visible.minY);}
  compare(a,b){return a.visible-b.visible||a.distance-b.distance;}
  add(entry){
    const item=entry.item,source=item?.kind==='image'?item.src:item?.kind==='pdf'?item.thumbnail:'';
    if(!source||/^(data|blob):/i.test(source)||this.limit<=0)return;
    const b=entry.bounds||entry,v=this.visible;
    const dx=Math.max(b.minX-this.cx,0,this.cx-b.maxX)/this.width,dy=Math.max(b.minY-this.cy,0,this.cy-b.maxY)/this.height;
    const row={source,distance:dx*dx+dy*dy,visible:b.maxX>=v.minX&&b.minX<=v.maxX&&b.maxY>=v.minY&&b.minY<=v.maxY?0:1};
    const old=this.bySource.get(source);
    if(old){if(this.compare(row,old)>=0)return;this.rows.splice(this.rows.indexOf(old),1);}
    else if(this.rows.length>=this.limit&&this.compare(row,this.rows[this.rows.length-1])>=0)return;
    let lo=0,hi=this.rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(this.compare(this.rows[mid],row)<=0)lo=mid+1;else hi=mid;}
    this.rows.splice(lo,0,row);this.bySource.set(source,row);
    if(this.rows.length>this.limit)this.bySource.delete(this.rows.pop().source);
  }
  sources(){return this.rows.map(row=>row.source);}
}
export function preloadImageSources(entries,visible,limit=64){const selector=new PreloadImageSelector(visible,limit);for(const entry of entries)selector.add(entry);return selector.sources();}
