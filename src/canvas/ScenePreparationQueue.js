import { changedItemIds } from './itemSnapshots.js';
// Enumerate a scene once per immutable item map, then resume its preparation
// cursor across frames. Enumeration time never consumes the per-chunk budget.
export default class ScenePreparationQueue {
  constructor() {
    this.items = null; this.entries = []; this.ids = new Set();
    this.orderKey = ''; this.cursor = 0; this.enumerations = 0; this.positions = new Map();
    this.urgent = new Set(); this.urgentOrder = []; this.urgentHead = 0; this.done = new Set();
  }
  setItems(items) {
    if (items === this.items) return false;
    const changed=changedItemIds(this.items,items);
    if(changed && changed.every(id=>items[id])){
      for(const id of changed){const item=items[id];if(this.positions.has(id))this.entries[this.positions.get(id)]=[id,item];else{this.positions.set(id,this.entries.length);this.entries.push([id,item]);this.ids.add(id);this.orderKey+=(this.orderKey?'\0':'')+id;}}
      this.changedIds=changed;this.items=items;return true;
    }
    this.changedIds=changed && changed.every(id=>this.positions.has(id) && items[id])?changed:null;
    if(this.changedIds){for(const id of changed)this.entries[this.positions.get(id)]=[id,items[id]];this.items=items;return true;}
    this.items = items; this.entries = Object.entries(items || {});
    this.positions=new Map(this.entries.map(([id],i)=>[id,i]));
    this.ids = new Set(this.entries.map(([id]) => id));
    this.orderKey = this.entries.map(([id]) => id).join('\0');
    this.enumerations++; this.restart(); return true;
  }
  advanceCursor() {
    while (this.cursor < this.entries.length && this.done.has(this.cursor)) {
      this.done.delete(this.cursor);
      this.cursor++;
    }
  }
  restart() {
    this.cursor = 0; this.urgent.clear(); this.urgentOrder.length = 0; this.urgentHead = 0; this.done.clear();
  }
  invalidate(ids) {
    for (let i = 0; i < ids.length; i++) {
      const index = this.positions.get(ids[i]);
      if (index !== undefined) {
        this.done.delete(index);
        if (!this.urgent.has(index)) {
          this.urgent.add(index);
          this.urgentOrder.push(index);
        }
      }
    }
  }
  get pending() { return this.urgent.size > 0 || this.cursor < this.entries.length; }
  run(visit, budgetMs = 8, now = () => performance.now()) {
    const start = now(); let visited = 0;
    while (this.pending && (!visited || now() - start < budgetMs)) {
      const urgent = this.urgent.size > 0;
      let index;
      if (urgent) {
        while (this.urgentHead < this.urgentOrder.length && !this.urgent.has(this.urgentOrder[this.urgentHead])) {
          this.urgentHead++;
        }
        index = this.urgentOrder[this.urgentHead];
      } else {
        index = this.cursor;
      }
      const [id, item] = this.entries[index];
      visit(id, item, index);
      if (urgent) {
        this.urgent.delete(index);
        this.urgentHead++;
        if (this.urgentHead >= this.urgentOrder.length) {
          this.urgentOrder.length = 0;
          this.urgentHead = 0;
        } else if (this.urgentHead > 4096 && this.urgentHead * 2 >= this.urgentOrder.length) {
          this.urgentOrder = this.urgentOrder.slice(this.urgentHead);
          this.urgentHead = 0;
        }
        if (index === this.cursor) { this.cursor++; this.advanceCursor(); }
        else if (index > this.cursor) this.done.add(index);
      } else {
        this.cursor++;
        this.advanceCursor();
      }
      visited++;
    }
    return visited;
  }
}
