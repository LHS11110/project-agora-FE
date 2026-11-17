// Bounded, cancellable work for inert previews; this queue never creates DOM or iframes.
export class StaticPreviewQueue {
 constructor({schedule=fn=>globalThis.requestIdleCallback?requestIdleCallback(fn,{timeout:250}):setTimeout(()=>fn({timeRemaining:()=>2}),16),cancel=handle=>globalThis.cancelIdleCallback?cancelIdleCallback(handle):clearTimeout(handle),limit=64}={}){this.schedule=schedule;this.cancel=cancel;this.limit=limit;this.bytes=0;this.cache=new Map();this.jobs=new Map();this.handle=null;}
 request(key,build,notify){
  if(this.cache.has(key)){const value=this.cache.get(key);this.cache.delete(key);this.cache.set(key,value);notify(value);return()=>{};}
  let job=this.jobs.get(key);if(!job){job={build,listeners:new Set()};this.jobs.set(key,job);}job.listeners.add(notify);this.start();
  return()=>{job.listeners.delete(notify);if(!job.listeners.size)this.jobs.delete(key);if(!this.jobs.size&&this.handle!==null){this.cancel(this.handle);this.handle=null;}};
 }
 start(){if(this.handle===null&&this.jobs.size)this.handle=this.schedule(deadline=>{this.handle=null;const start=performance.now();let count=0;for(const [key,job]of this.jobs){if(count&&(count>=2||performance.now()-start>=2||deadline.timeRemaining()<1))break;this.jobs.delete(key);const value=job.build();this.cache.set(key,value);this.bytes+=key.length*2+2048;while(this.cache.size>this.limit||this.bytes>8*1024*1024){const oldest=this.cache.keys().next().value;this.bytes-=oldest.length*2+2048;this.cache.delete(oldest);}for(const notify of job.listeners)notify(value);count++;}this.start();});}
}
export const staticPreviewQueue=new StaticPreviewQueue();
export function staticMarkupPreview(source){
 const text=String(source||'').slice(0,65536);
 const decode=value=>value.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,entity=>{const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];const n=entity[2]?.toLowerCase()==='x'?parseInt(entity.slice(3),16):parseInt(entity.slice(2),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});
 const plain=value=>decode(value.replace(/<!--[\s\S]*?(?:-->|$)|<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).trim();
 const rows=[...text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].slice(0,3).map(row=>[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].slice(0,4).map(cell=>plain(cell[1]).slice(0,100)));
 const heading=text.match(/<(?:h[1-6]|title)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|title)\s*>/i);
 return {heading:heading?plain(heading[1]).slice(0,120):'',text:plain(text).slice(0,700),rows:rows.filter(row=>row.length),code:text.slice(0,500)};
}
