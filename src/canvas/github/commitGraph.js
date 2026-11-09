// Keep branch columns stable even when a branch has no visible commits yet or
// its loaded history ends before another tip. Only real parent SHAs join lines.
export function commitGraph(entries,{refs=[],branch=''}={}){
 const nodes=new Map(entries.map(e=>[e.sha,{...e,parents:e.parents||[]}]));
 const children=new Map([...nodes.keys()].map(sha=>[sha,0]));
 for(const e of nodes.values())for(const p of e.parents)if(nodes.has(p))children.set(p,children.get(p)+1);
 const compare=(a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)||a.sha.localeCompare(b.sha);
 const ready=[...nodes.values()].filter(e=>!children.get(e.sha)).sort(compare),ordered=[];
 while(ready.length){const e=ready.shift();ordered.push(e);for(const p of e.parents)if(nodes.has(p)){children.set(p,children.get(p)-1);if(!children.get(p)){ready.push(nodes.get(p));ready.sort(compare);}}}
 const owners=new Map(),branchLanes=new Map(),heads=new Map(),columns=[];
 const sortedRefs=[...refs].sort((a,b)=>Number(b.name===branch)-Number(a.name===branch)||a.name.localeCompare(b.name));
 for(const ref of sortedRefs){
  const key=ref.sha||ref.name;let lane=heads.get(key)??owners.get(ref.sha);
  if(lane===undefined){lane=columns.length;heads.set(key,lane);columns.push({names:[]});}
  columns[lane].names.push(ref.name);branchLanes.set(ref.name,lane);
  // The current branch owns its first-parent trunk. Other branches stop at
  // that shared ancestor, instead of taking over its column.
  let sha=ref.sha;const visited=new Set();
  while(nodes.has(sha)&&!owners.has(sha)&&!visited.has(sha)){visited.add(sha);owners.set(sha,lane);sha=nodes.get(sha).parents[0];}
 }
 // File-filtered histories may omit the ref's tip. API provenance keeps their
 // visible commits in the right column without inventing parent connections.
 for(const entry of nodes.values())if(!owners.has(entry.sha)){
  const names=[...(entry.branches||[])].sort((a,b)=>Number(b===branch)-Number(a===branch)||a.localeCompare(b));
  const lane=names.map(name=>branchLanes.get(name)).find(value=>value!==undefined);
  if(lane!==undefined)owners.set(entry.sha,lane);
 }
 let lanes=[],width=Math.max(1,columns.length),nextLane=columns.length;
 const allocate=()=>{const lane=nextLane++;width=Math.max(width,lane+1);return lane;};
 const rows=ordered.map(entry=>{
  const before=[...lanes],incoming=[];
  before.forEach((sha,i)=>{if(sha===entry.sha)incoming.push(i);});
  const preferred=owners.get(entry.sha);
  let lane=preferred!==undefined&&(!lanes[preferred]||lanes[preferred]===entry.sha)?preferred:incoming[0];
  if(lane===undefined)lane=allocate();
  const segments=[];
  before.forEach((sha,i)=>{
   if(!sha)return;
   if(sha===entry.sha)segments.push({from:i,to:lane,start:0,end:50});
   else segments.push({from:i,to:i,start:0,end:100,dashed:!nodes.has(sha)});
  });
  for(const i of incoming)lanes[i]=null;
  lanes[lane]=null;
  entry.parents.forEach((sha,index)=>{
   // Carry a first-parent edge in this branch's own column. Shared ancestors
   // may be pending in multiple columns; they join AT their node, not earlier.
   let target=index===0?lane:owners.get(sha);
   if(target===undefined||lanes[target]){const existing=lanes.indexOf(sha);target=existing>=0?existing:allocate();}
   lanes[target]=sha;
   segments.push({from:lane,to:target,start:50,end:100,dashed:!nodes.has(sha)});
  });
  width=Math.max(width,lanes.length,lane+1,before.length);
  return {entry,lane,segments};
 });
 // Count upwards from loaded ancestors, then invert for newest-at-top
 // display. Short branches keep empty space above, rather than stretching
 // their first commit away from the actual branch point.
 const rowsBySha=new Map(rows.map(row=>[row.entry.sha,row]));
 const ranks=new Map(),occupied=new Map(),bands=[];
 let highest=0;
 for(const row of [...rows].reverse()){
  let rank=0;
  for(const parent of row.entry.parents)if(ranks.has(parent))rank=Math.max(rank,ranks.get(parent)+1);
  const used=occupied.get(row.lane)||new Set();while(used.has(rank))rank++;
  used.add(rank);occupied.set(row.lane,used);ranks.set(row.entry.sha,rank);highest=Math.max(highest,rank);
 }
 const levels=new Map([...ranks].map(([sha,rank])=>[sha,highest-rank]));
 for(let level=0;level<=highest&&rows.length;level++)bands.push({commits:[],segments:[]});
 for(const row of rows)bands[levels.get(row.entry.sha)].commits.push(row);
 for(const row of rows){
  const start=levels.get(row.entry.sha);
  row.entry.parents.forEach((parent,index)=>{
   const target=rowsBySha.get(parent),end=target?levels.get(parent):start;
   const carrier=index===0?row.lane:target?.lane??row.segments.filter(s=>s.start===50)[index]?.to??row.lane;
   bands[start].segments.push({from:row.lane,to:carrier,start:8,end:100,dashed:!target});
   if(target){for(let level=start+1;level<end;level++)bands[level].segments.push({from:carrier,to:carrier,start:0,end:100});bands[end].segments.push({from:carrier,to:target.lane,start:0,end:8});}
  });
 }
 for(const band of bands){band.commits.sort((a,b)=>a.lane-b.lane);band.segments=[...new Map(band.segments.map(s=>[JSON.stringify(s),s])).values()];}
 return {rows,width,columns,bands};
}
