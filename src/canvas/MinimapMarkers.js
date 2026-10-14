import { changedItemIds } from './itemSnapshots.js';
const kinds=new Set(['image','link','code','note','table','shape','text','math','stroke','connector','pdf','user-group']);
export default class MinimapMarkers {
  update(entries,items,width,height,index){
    const changed=changedItemIds(this.items,items),reset=this.entries!==entries||this.width!==width||this.height!==height||changed===null;
    if(reset){
      this.value=entries.filter(e=>kinds.has((items[e.id]||e.item)?.kind)).map(e=>this.marker(e,items,width,height));
      this.positions=new Map(this.value.map((entry,i)=>[entry.id,i]));
    }else{
      const dirty=new Set(changed);if(this.geometry!==index?.stats.boundsCalculated)for(const id of index?.changedIds ||[])dirty.add(id);
      let next=this.value;
      for(const id of dirty){
        const at=this.positions.get(id),entry=index?.entries.get(id);if(at===undefined||!entry)continue;
        const marker=this.marker(entry,items,width,height),old=next[at];
        if(old.item.kind===marker.item.kind&&old.item.color===marker.item.color&&Object.keys(old.bounds).every(key=>old.bounds[key]===marker.bounds[key]))continue;
        if(next===this.value)next=next.slice();next[at]=marker;
      }
      this.value=next;
    }
    this.items=items;this.entries=entries;this.width=width;this.height=height;this.geometry=index?.stats.boundsCalculated;return this.value;
  }
  marker(entry,items,width,height){const item=items[entry.id]||entry.item;return {id:entry.id,item:{kind:item.kind,color:item.color},bounds:{minX:entry.bounds.minX*width,minY:entry.bounds.minY*height,maxX:entry.bounds.maxX*width,maxY:entry.bounds.maxY*height}};}
}
