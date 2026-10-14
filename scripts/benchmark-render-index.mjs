import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';

const world={width:1600,height:1000};
const percentile=(samples,p)=>samples.toSorted((a,b)=>a-b)[Math.floor((samples.length-1)*p)];
for(const count of [12_000,50_000]){
  let items=Object.fromEntries(Array.from({length:count},(_,i)=>['s'+i,{kind:'shape',x:i%200*.1,y:Math.floor(i/200)*.1,width:.06,height:.04,shadowEnabled:false}]));
  const start=performance.now(),index=new CanvasSpatialBTree(items,world),buildMs=performance.now()-start;
  const queries=[],updates=[];
  for(let i=0;i<1000;i++){
    const x=i%20*.1,y=i%10*.1,at=performance.now();
    index.query({minX:x,minY:y,maxX:x+.8,maxY:y+.6});queries.push(performance.now()-at);
  }
  const before=index.stats.boundsCalculated;
  for(let i=0;i<100;i++){
    const at=performance.now();
    items={...items,s0:{...items.s0,x:30+i*.01}};
    index.update(items,world,0,['s0']);updates.push(performance.now()-at);
  }
  assert.equal(index.stats.boundsCalculated,before+100);
  console.log(JSON.stringify({objects:count,buildMs,queryP50Ms:percentile(queries,.5),queryP95Ms:percentile(queries,.95),
    updateIncludingStateCopyP50Ms:percentile(updates,.5),updateIncludingStateCopyP95Ms:percentile(updates,.95),
    boundsCalculatedDuring100Moves:index.stats.boundsCalculated-before}));
}
