export default class StableSpatialQuery {
  constructor(){this.entries=[];this.byId=new Map();}
  query(index,bounds){
    const result=index.query(bounds);
    // R-tree traversal order can differ as the window moves. Keep the prior
    // membership/order when all the same records are still present.
    if(result.length===this.entries.length && result.every(entry=>this.byId.get(entry.id)===entry))return this.entries;
    this.entries=result;this.byId=new Map(result.map(entry=>[entry.id,entry]));return result;
  }
}
