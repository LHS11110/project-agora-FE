import {renderValueEqual} from './canvasRenderEquality.js';
// Position belongs to the outer frame. Retaining the inner DOM also retains
// editors, media elements, PDF canvases and private terminal sessions.
export const objectContentCacheStats={checks:0,hits:0};
const placement=new Set(['x','y','rotation','depth']);
const contentViews=new WeakMap();
export function objectContentView(item){
 if(!item||typeof item!=='object')return item;
 let view=contentViews.get(item);
 if(!view){view=Object.fromEntries(Object.entries(item).filter(([key])=>!placement.has(key)));contentViews.set(item,view);}
 return view;
}
export function objectContentPropsEqual(before,after){
 objectContentCacheStats.checks++;
 const keys=Object.keys(after);
 const equal= keys.length===Object.keys(before).length&&keys.every(key=>key==='item'?renderValueEqual(objectContentView(before.item),objectContentView(after.item)):typeof after[key]==='function'?before[key]===after[key]:renderValueEqual(before[key],after[key]));
 if(equal)objectContentCacheStats.hits++;return equal;
}
