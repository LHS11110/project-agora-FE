import test from 'node:test';
import assert from 'node:assert/strict';
import ItemSubset from '../src/canvas/ItemSubset.js';
import {itemSnapshot,changeItems} from '../src/canvas/itemSnapshots.js';
test('unrelated edits only inspect changed items and retain derived entries',()=>{
 let visits=0;const subset=new ItemSubset(item=>{visits++;return item.hidden;});
 let items=itemSnapshot(Object.fromEntries(Array.from({length:100000},(_,i)=>[String(i),{kind:'shape',hidden:i===0}])));
 const first=subset.update(items);assert.equal(visits,100000);
 items=changeItems(items,{'10':{kind:'shape'}});assert.equal(subset.update(items),first);assert.equal(visits,100001);
 items=changeItems(items,{'10':{kind:'shape',hidden:true}});assert.equal(subset.update(items).length,2);
 items=changeItems(items,{},['0']);assert.deepEqual(subset.update(items).map(([id])=>id),['10']);
 assert.deepEqual(subset.update(itemSnapshot({other:{hidden:true}})).map(([id])=>id),['other']);
});
