import test from 'node:test';
import assert from 'node:assert/strict';
import MinHeap from '../src/canvas/MinHeap.js';
test('priority queue preserves sorted order with duplicates and interleaved insertion',()=>{
 const heap=new MinHeap((a,b)=>a-b),expected=[];
 let seed=12;
 for(let i=0;i<2000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed%300;heap.push(value);expected.push(value);if(i%3===0){expected.sort((a,b)=>a-b);assert.equal(heap.pop(),expected.shift());}}
 expected.sort((a,b)=>a-b);assert.deepEqual(Array.from({length:heap.length},()=>heap.pop()),expected);assert.equal(heap.length,0);
});
