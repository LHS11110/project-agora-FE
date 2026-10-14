import { changedItemIds } from './itemSnapshots.js';
// Enumerate a scene once per immutable item map, then resume its preparation
// cursor across frames. Enumeration time never consumes the per-chunk budget.
export default class ScenePreparationQueue {
  constructor() {
    this.items = null; this.entries = []; this.ids = new Set();
    this.orderKey = ''; this.cursor = 0; this.enumerations = 0;this.positions=new Map();this.urgent=new Set();
  }
  setItems(items) {
    if (items === this.items) return false;
    const changed=changedItemIds(this.items,items);
    this.changedIds=changed && changed.every(id=>this.positions.has(id) && items[id])?changed:null;
    if(this.changedIds){for(const id of changed)this.entries[this.positions.get(id)]=[id,items[id]];this.items=items;return true;}
    this.items = items; this.entries = Object.entries(items || {});
    this.positions=new Map(this.entries.map(([id],i)=>[id,i]));
    this.ids = new Set(this.entries.map(([id]) => id));
    this.orderKey = this.entries.map(([id]) => id).join('\0');
    this.enumerations++; this.restart(); return true;
  }
  restart() { this.cursor = 0;this.urgent.clear(); }
  invalidate(ids){for(const id of ids)this.urgent.add(this.positions.get(id));}
  get pending() { return this.urgent.size>0 || this.cursor < this.entries.length; }
  run(visit, budgetMs = 8, now = () => performance.now()) {
    const start = now(); let visited = 0;
    while (this.pending && (!visited || now() - start < budgetMs)) {
      const urgent=this.urgent.size>0,index=urgent?this.urgent.values().next().value:this.cursor,[id,item]=this.entries[index];
      visit(id,item,index);if(urgent)this.urgent.delete(index);else this.cursor++;visited++;
    }
    return visited;
  }
}
