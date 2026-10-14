export default class StableSpatialQuery {
  constructor(){this.entries=[];this.byId=new Map();this.positions=new Map();this.bounds=null;this.revision=-1;}
  query(index,bounds){
    const same=this.bounds && ['minX','minY','maxX','maxY'].every(key=>this.bounds[key]===bounds[key]);
    if(same && index.stats && this.revision===index.stats.updates)return this.entries;
    if(same && index.stats && this.revision===index.stats.updates-1 && index.changedIds){
      let result=this.entries;
      for(const id of index.changedIds){
        const entry=index.entries.get(id),position=this.positions.get(id);
        const inside=entry && entry.maxX>=bounds.minX && entry.minX<=bounds.maxX && entry.maxY>=bounds.minY && entry.minY<=bounds.maxY;
        if(inside && position!==undefined){result[position]=entry;this.byId.set(id,entry);}
        else if(inside){if(result===this.entries)result=result.slice();this.positions.set(id,result.length);result.push(entry);this.byId.set(id,entry);}
        else if(position!==undefined){
          if(result===this.entries)result=result.slice();const last=result.pop();this.positions.delete(id);this.byId.delete(id);
          if(position<result.length){result[position]=last;this.positions.set(last.id,position);}
        }
      }
      this.entries=result;this.revision=index.stats?.updates;return result;
    }
    const result=index.query(bounds);
    if(result.length!==this.entries.length || !result.every(entry=>this.byId.get(entry.id)===entry)){
      this.entries=result;this.byId=new Map(result.map(entry=>[entry.id,entry]));this.positions=new Map(result.map((entry,i)=>[entry.id,i]));
    }
    this.bounds={...bounds};this.revision=index.stats?.updates;return this.entries;
  }
}
