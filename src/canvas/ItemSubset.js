import { changedItemIds } from './itemSnapshots.js';

// A small derived set updated from immutable snapshot deltas. Never retain the
// whole history, and rebuild safely when snapshots are unrelated.
export default class ItemSubset {
  constructor(predicate) { this.predicate=predicate; this.items=null; this.matches=new Map(); this.entries=[]; }
  update(items) {
    if (items===this.items) return this.entries;
    const changed=changedItemIds(this.items,items);
    let dirty=false;
    if (changed===null) { this.matches.clear(); dirty=true; }
    for (const id of changed ?? Object.keys(items || {})) {
      const item=items?.[id];
      if (item && this.predicate(item)) {
        if (this.matches.get(id)!==item) { this.matches.set(id,item); dirty=true; }
      } else if (this.matches.delete(id)) dirty=true;
    }
    this.items=items;
    if (dirty) this.entries=[...this.matches];
    return this.entries;
  }
}
