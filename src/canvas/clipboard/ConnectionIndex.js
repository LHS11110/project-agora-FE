import {changedItemIds} from '../itemSnapshots.js';
/** Endpoint adjacency is maintained with scene changes, never by scanning on copy. */
export default class ConnectionIndex{
 constructor(){this.items=null;this.ends=new Map();this.connections=new Map();this.stats={fullBuilds:0,visited:0};}
 update(items,ids=null,full=false){
  if(items===this.items)return this;
  if(ids===null&&!full)ids=this.items?changedItemIds(this.items,items):null;
  if(full||ids===null){this.ends.clear();this.connections.clear();this.stats.fullBuilds++;ids=ids||Object.keys(items);}
  for(const id of ids){this.stats.visited++;this.set(String(id),items[id]);}
  this.items=items;return this;
 }
 set(id,item){
  const next=item?.kind==='connector'?[...new Set([item.from,item.to].filter(v=>v!=null).map(String))]:[],before=this.ends.get(id)||[];
  for(const endpoint of before)if(!next.includes(endpoint)){const links=this.connections.get(endpoint);links?.delete(id);if(!links?.size)this.connections.delete(endpoint);}
  for(const endpoint of next)if(!before.includes(endpoint)){if(!this.connections.has(endpoint))this.connections.set(endpoint,new Set());this.connections.get(endpoint).add(id);}
  if(next.length)this.ends.set(id,next);else this.ends.delete(id);
 }
 *iterate(ids){for(const id of ids)for(const link of this.connections.get(String(id))||[])yield link;}
 related(ids){return new Set(this.iterate(ids));}
}
