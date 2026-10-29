import { itemSnapshot,changeItems,changedItemIds } from './itemSnapshots.js';
import { itemDepth } from './itemDepth.js';
import { isRasterText } from './plainTextRaster.js';
import { isOverviewProxy,overviewProxy } from './sceneRepresentation.js';
import { needsVectorDom } from './vectorHitTest.js';
import { connectorGeometry } from '../components/connectorGeometry.js';
const kinds=new Set(['image','link','code','note','table','chart','shape','text','math','stroke','connector','pdf','user-group']);

// Scene membership and static vector maps survive text/draft content updates.
// Only affected entries change; edit controls are a separate small DOM list.
export default class SceneViewModel {
  constructor(){this.entries=null;this.items=null;this.layers=new Map();this.byId=new Map();this.hitOrder=new Map();this.sorted=[];this.connectorIds=new Set();this.revision=0;}
  update(entries,items,world,scale,domIds,selected,routingRevision=0,index=null){
    const selectionKey=[...selected].join('|'),domKey=[...domIds].join('|');
    const reset=this.entries!==entries || this.width!==world.width || this.height!==world.height || this.scale!==scale || this.domKey!==domKey || this.selectionKey!==selectionKey;
    const changed=reset?null:changedItemIds(this.items,items);
    if(reset || changed===null){
      this.layers=new Map([[0,{depth:0,objects:[],domObjects:[],vectors:itemSnapshot({}),inkItems:itemSnapshot({})}]]);this.byId=new Map();this.connectorIds=new Set();
      this.sorted=entries.filter(e=>kinds.has((items[e.id]||e.item)?.kind)).sort((a,b)=>a.bounds.minY-b.bounds.minY).map(e=>this.entry(e,items,world));
      const maps=new Map();
      for(const tuple of this.sorted){const [id,item]=tuple,depth=itemDepth(item);if(!this.layers.has(depth))this.layers.set(depth,{depth,objects:[],domObjects:[]});
        if(!maps.has(depth))maps.set(depth,{vectors:{},inkItems:{}});const layer=this.layers.get(depth);layer.objects.push(tuple);this.byId.set(id,{depth,tuple});if(item.kind==='connector')this.connectorIds.add(id);
        const representation=this.representation(id,item,domIds,selected,world,scale);
        if(representation.ink)maps.get(depth).inkItems[id]=item;else if(representation.vector)maps.get(depth).vectors[id]=representation.vector;
        if(needsVectorDom(id,item,domIds,null,null,world,scale))layer.domObjects.push(tuple);
      }
      for(const [depth,layer] of this.layers){layer.vectors=itemSnapshot(maps.get(depth)?.vectors||{});layer.inkItems=itemSnapshot(maps.get(depth)?.inkItems||{});}
      this.hitOrder=new Map(this.sorted.map(([id],i)=>[id,i]));this.revision++;
    }else if(changed.length || this.routingRevision!==routingRevision){
      const dirty=new Set(changed);if(index?.changedIds && this.routingRevision!==routingRevision)for(const id of index.changedIds)dirty.add(id);if(this.routingRevision!==routingRevision)for(const id of this.connectorIds)dirty.add(id);

      for(const id of dirty){
        const old=this.byId.get(id);if(!old)continue;
        const item=items[id];if(!item || itemDepth(item)!==old.depth){this.entries=null;return this.update(entries,items,world,scale,domIds,selected,routingRevision,index);}
        const spatial=index?.entries.get(id) || this.spatial?.get(id);
        const tuple=this.entry(spatial || {id,item,bounds:old.tuple[2]},items,world),layer=this.layers.get(old.depth),representation=this.representation(id,item,domIds,selected,world,scale);
        // Bounds can stay identical while a mutable R-tree entry's item changes.
        const position=layer.objects.indexOf(old.tuple);layer.objects[position]=tuple;
        const at=this.sorted.indexOf(old.tuple);this.sorted[at]=tuple;
        layer.vectors=changeItems(layer.vectors,{[id]:representation.vector || null});
        layer.inkItems=changeItems(layer.inkItems,{[id]:representation.ink?item:null});
        const was=layer.domObjects.indexOf(old.tuple),needs=needsVectorDom(id,item,domIds,null,null,world,scale);
        if(was>=0 || needs){layer.domObjects=layer.domObjects.slice();if(was>=0){if(needs)layer.domObjects[was]=tuple;else layer.domObjects.splice(was,1);}else layer.domObjects.push(tuple);}
        this.byId.set(id,{depth:old.depth,tuple});
      }
      this.revision++;
    }
    if(reset || changed===null){this.spatial=new Map(entries.map(entry=>[entry.id,entry]));}
    this.entries=entries;this.items=items;this.width=world.width;this.height=world.height;this.scale=scale;this.domKey=domKey;this.selectionKey=selectionKey;this.routingRevision=routingRevision;
    this.depthLayers=[...this.layers.values()].sort((a,b)=>a.depth-b.depth);return this;
  }
  entry(entry,items,world){const item=items[entry.id]||entry.item;return [entry.id,item,entry.bounds,item.kind==='connector'?connectorGeometry(item,items,world.width,world.height):null];}
  representation(id,item,domIds,selected,world,scale){
    if(item.kind==='stroke' && item.complete===false)return {ink:true};
    let vector=!item.runtimeRole && ['stroke','shape','connector'].includes(item.kind) || (isRasterText(item)&&!domIds.has(String(id)))?item:null;
    if(!vector && !domIds.has(String(id)) && isOverviewProxy(item,world,scale))vector=overviewProxy(item,world,scale);
    if(vector && selected.has(String(id)) && !domIds.has(String(id)))vector={...vector,__selectionOutline:true};
    return {vector};
  }
}
