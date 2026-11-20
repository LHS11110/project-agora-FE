import {hasRenderedAnimation} from './portfolio/portfolioModel.js';
import { isDrawableCanvasItem } from './drawableItems.js';
import { itemSnapshot,changeItems,changedItemIds } from './itemSnapshots.js';
import { itemDepth } from './itemDepth.js';
import { isRasterContent as isRasterText } from './plainTextRaster.js';
import { overviewProxy, overviewProxyTier } from './sceneRepresentation.js';
import { needsVectorDom } from './vectorHitTest.js';
import { connectorGeometry } from '../components/connectorGeometry.js';

function sameTuples(before,after){
 if(before===after)return true;
 if(!before||!after||before.length!==after.length)return false;
 for(let i=0;i<before.length;i++)if(before[i]!==after[i])return false;
 return true;
}
function retainSnapshot(previous,next){
 if(!previous)return itemSnapshot(next);
 const changes={};for(const [id,item] of Object.entries(next))if(previous[id]!==item)changes[id]=item;
 for(const id of Object.keys(previous))if(!Object.hasOwn(next,id))changes[id]=null;
 return Object.keys(changes).length?changeItems(previous,changes):previous;
}
function mergeTuples(existing,added){
 added.sort((a,b)=>a[2].minY-b[2].minY);
 if(existing.some((entry,i)=>i&&existing[i-1][2].minY>entry[2].minY))existing.sort((a,b)=>a[2].minY-b[2].minY);
 const result=[];let a=0,b=0;
 while(a<existing.length&&b<added.length)result.push(existing[a][2].minY<=added[b][2].minY?existing[a++]:added[b++]);
 return result.concat(existing.slice(a),added.slice(b));
}
// Scene membership and static vector maps survive text/draft content updates.
// Only affected entries change; edit controls are a separate small DOM list.
export default class SceneViewModel {
  constructor(){this.entries=null;this.items=null;this.layers=new Map();this.byId=new Map();this.hitOrder=new Map();this.sorted=[];this.connectorIds=new Set();this.revision=0;this.representations=new Map();this.stats={resets:0,appends:0,updates:0,reasons:{}};}
  update(entries,items,world,scale,domIds,selected,routingRevision=0,index=null,quality='high'){
    const qualityChanged=this.quality!==quality;this.quality=quality;
    const selectionKey=[...selected].join('|'),domKey=[...domIds].join('|');
    const sameDisplay=!qualityChanged&&this.width===world.width&&this.height===world.height&&this.scale===scale;
    const appearanceDirty=new Set();for(const [before,after] of [[this.selected||new Set(),selected],[this.domIds||new Set(),domIds]]){for(const id of before)if(!after.has(id))appearanceDirty.add(id);for(const id of after)if(!before.has(id))appearanceDirty.add(id);}
    const delta=entries.sceneDelta,append=this.entries!==entries&&delta&&delta.previous.deref()===this.entries&&sameDisplay&&!delta.removed.length&&delta.updated.every(entry=>this.byId.has(entry.id)&&itemDepth(items[entry.id]||entry.item)===this.byId.get(entry.id).depth)&&appearanceDirty.size===0;
    const reset=this.entries!==entries || !sameDisplay;
    const changed=reset?null:changedItemIds(this.items,items);
    if(append){
      this.stats.appends++;
      const patches=new Map();
      for(const entry of [...delta.updated,...delta.added]){
        const tuple=this.entry(entry,items,world,index),[id,item]=tuple,depth=itemDepth(item);if(!isDrawableCanvasItem(item))continue;
        if(!this.layers.has(depth))this.layers.set(depth,{depth,objects:[],domObjects:[],vectors:itemSnapshot({}),inkItems:itemSnapshot({})});
        const layer=this.layers.get(depth),old=this.byId.get(id),sortIndex=old?.sortIndex??this.sorted.length,objectIndex=old?.objectIndex??layer.objects.length;
        this.sorted[sortIndex]=tuple;layer.objects[objectIndex]=tuple;this.byId.set(id,{depth,tuple,sortIndex,objectIndex});this.hitOrder.set(id,sortIndex);this.spatial.set(id,entry);
        if(item.kind==='connector')this.connectorIds.add(id);
        const representation=this.representation(id,item,domIds,selected,world,scale);
        if(!patches.has(depth))patches.set(depth,{vectors:{},inkItems:{}});
        patches.get(depth).vectors[id]=representation.vector||null;patches.get(depth).inkItems[id]=representation.ink?(representation.ink===true?item:representation.ink):null;
        const domAt=old?layer.domObjects.indexOf(old.tuple):-1,needs=needsVectorDom(id,item,domIds,null,null,world,scale,this.quality);
        if(domAt>=0||needs){layer.domObjects=layer.domObjects.slice();if(domAt>=0){if(needs)layer.domObjects[domAt]=tuple;else layer.domObjects.splice(domAt,1);}else layer.domObjects.push(tuple);}
      }
      for(const [depth,changes] of patches){const layer=this.layers.get(depth);layer.vectors=changeItems(layer.vectors,changes.vectors);layer.inkItems=changeItems(layer.inkItems,changes.inkItems);}
      this.revision++;
    }else if(reset || changed===null){
      this.stats.resets++;const reason=[this.entries===entries?'same':'entries',sameDisplay?'display':'lod',delta?'delta':'no-delta',delta?.previous.deref()===this.entries?'parent':'no-parent',delta?.updated.length||0,appearanceDirty.size,changed===null?'all':'diff'].join(':');this.stats.reasons[reason]=(this.stats.reasons[reason]||0)+1;
      const oldLayers=this.layers,oldById=this.byId,oldSorted=this.sorted;
      const sameGeometry=this.entries===entries&&this.items===items&&this.width===world.width&&this.height===world.height&&this.routingRevision===routingRevision;
      let sorted=oldSorted;
      if(!sameGeometry){
        const retained=new Map(),added=[];
        for(const entry of entries){const item=items[entry.id]||entry.item;if(!isDrawableCanvasItem(item))continue;const old=oldById.get(entry.id)?.tuple;
          if(old&&old[1]===item&&old[2]===entry.bounds&&(item.kind!=='connector'||this.routingRevision===routingRevision)&&this.width===world.width&&this.height===world.height)retained.set(entry.id,old);
          else added.push(this.entry(entry,items,world,index));
        }
        sorted=mergeTuples(oldSorted.filter(tuple=>retained.has(tuple[0])),added);
      }
      this.layers=new Map([[0,{depth:0,objects:[],domObjects:[],vectors:itemSnapshot({}),inkItems:itemSnapshot({})}]]);this.byId=new Map();this.connectorIds=new Set();
      this.sorted=sorted;
      const present=new Set();for(let i=0;i<sorted.length;i++)present.add(sorted[i][0]);for(const id of this.representations.keys())if(!present.has(id))this.representations.delete(id);
      const maps=new Map();
      for(const [sortIndex,tuple] of this.sorted.entries()){const [id,item]=tuple,depth=itemDepth(item);if(!this.layers.has(depth))this.layers.set(depth,{depth,objects:[],domObjects:[]});
        if(!maps.has(depth))maps.set(depth,{vectors:{},inkItems:{}});const layer=this.layers.get(depth),objectIndex=layer.objects.length;layer.objects.push(tuple);this.byId.set(id,{depth,tuple,sortIndex,objectIndex});if(item.kind==='connector')this.connectorIds.add(id);
        const representation=this.representation(id,item,domIds,selected,world,scale);
        if(representation.ink)maps.get(depth).inkItems[id]=representation.ink===true?item:representation.ink;else if(representation.vector)maps.get(depth).vectors[id]=representation.vector;
        if(needsVectorDom(id,item,domIds,null,null,world,scale,this.quality))layer.domObjects.push(tuple);
      }
      for(const [depth,layer] of this.layers){const prevLayer=oldLayers.get(depth);layer.vectors=retainSnapshot(prevLayer?.vectors,maps.get(depth)?.vectors||{});layer.inkItems=retainSnapshot(prevLayer?.inkItems,maps.get(depth)?.inkItems||{});if(prevLayer&&sameTuples(prevLayer.domObjects,layer.domObjects))layer.domObjects=prevLayer.domObjects;}
      const hitOrder=new Map();for(let i=0;i<this.sorted.length;i++)hitOrder.set(this.sorted[i][0],i);
      this.hitOrder=hitOrder;this.revision++;
    }else if(changed.length || appearanceDirty.size || this.routingRevision!==routingRevision){
      const layerChanges=new Map();this.stats.updates++;const dirty=new Set([...changed,...appearanceDirty]);if(index?.changedIds && this.routingRevision!==routingRevision)for(const id of index.changedIds)dirty.add(id);if(this.routingRevision!==routingRevision)for(const id of this.connectorIds)dirty.add(id);

      for(const id of dirty){
        const old=this.byId.get(id);if(!old)continue;
        const item=items[id];if(!item || itemDepth(item)!==old.depth){this.entries=null;return this.update(entries,items,world,scale,domIds,selected,routingRevision,index);}
        const spatial=index?.entries.get(id) || this.spatial?.get(id);
        const tuple=this.entry(spatial || {id,item,bounds:old.tuple[2]},items,world,index),layer=this.layers.get(old.depth),representation=this.representation(id,item,domIds,selected,world,scale);
        // Bounds can stay identical while a mutable R-tree entry's item changes.
        const position=old.objectIndex??layer.objects.indexOf(old.tuple);layer.objects[position]=tuple;
        const at=old.sortIndex??this.sorted.indexOf(old.tuple);this.sorted[at]=tuple;
        if(!layerChanges.has(old.depth))layerChanges.set(old.depth,{vectors:{},inkItems:{}});
        layerChanges.get(old.depth).vectors[id]=representation.vector||null;layerChanges.get(old.depth).inkItems[id]=representation.ink?(representation.ink===true?item:representation.ink):null;
        const was=layer.domObjects.indexOf(old.tuple),needs=needsVectorDom(id,item,domIds,null,null,world,scale,this.quality);
        if(was>=0 || needs){layer.domObjects=layer.domObjects.slice();if(was>=0){if(needs)layer.domObjects[was]=tuple;else layer.domObjects.splice(was,1);}else layer.domObjects.push(tuple);}
        this.byId.set(id,{...old,tuple});
      }
      for(const [depth,changes] of layerChanges){const layer=this.layers.get(depth);layer.vectors=changeItems(layer.vectors,changes.vectors);layer.inkItems=changeItems(layer.inkItems,changes.inkItems);}
      this.revision++;
    }
    if(!append&&(this.entries!==entries || changed===null)){this.spatial=new Map(entries.map(entry=>[entry.id,entry]));}
    this.selected=selected;this.domIds=domIds;this.entries=entries;this.items=items;this.width=world.width;this.height=world.height;this.scale=scale;this.domKey=domKey;this.selectionKey=selectionKey;this.routingRevision=routingRevision;
    this.depthLayers=[...this.layers.values()].sort((a,b)=>a.depth-b.depth);return this;
  }
  entry(entry,items,world,index=null){const item=items[entry.id]||entry.item;return [entry.id,item,entry.bounds,item.kind==='connector'?connectorGeometry(item,items,world.width,world.height,index):null];}
  representation(id,item,domIds,selected,world,scale){
    const proxyTier=overviewProxyTier(item,world,scale,this.quality),worldKey=world.width+':'+world.height,dom=domIds.has(String(id)),selection=selected.has(String(id)),old=this.representations.get(id);
    if(old&&old.item===item&&old.proxyTier===proxyTier&&old.worldKey===worldKey&&old.dom===dom&&old.selection===selection)return old.result;
    if(hasRenderedAnimation(item)){const result={vector:null};this.representations.set(id,{item,proxyTier,worldKey,dom,selection,result});return result;}
    if(item.kind==='stroke'){
      const result={ink:selection && !dom ? {...item,__selectionOutline:true} : item};
      this.representations.set(id,{item,proxyTier,worldKey,dom,selection,result});
      return result;
    }
    let vector=!item.runtimeRole && ['shape','connector'].includes(item.kind) || (isRasterText(item)&&!dom)?item:null;
    if(!dom && proxyTier!=='full')vector=overviewProxy(item,world,scale);
    if(vector && selection && !dom)vector={...vector,__selectionOutline:true};
    const result={vector};this.representations.set(id,{item,proxyTier,worldKey,dom,selection,result});return result;
  }
}
