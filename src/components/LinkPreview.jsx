import {useEffect,useState} from 'react';
import {api} from '../api/client.js';
import './link-preview.css';
const cache=new Map(),pending=[];let running=0;
function schedule(task){return new Promise(resolve=>{pending.push({task,resolve});drain();});}
function drain(){while(running<4&&pending.length){const job=pending.shift();running++;Promise.resolve().then(job.task).then(job.resolve,()=>job.resolve({})).finally(()=>{running--;drain();});}}
export function messageLinks(text){return [...new Set((String(text||'').match(/https:\/\/[^\s<>"'`]+/gi)||[]).map(s=>s.replace(/[),.!?;\]}]+$/,'')))];}
function getPreview(url,token){const key=`${token||''}\n${url}`;if(!cache.has(key)){if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,schedule(()=>api('/api/link-preview',{method:'POST',body:{url},token}))); }return cache.get(key);}
export function LinkSummary({url,token}){const [value,setValue]=useState(null);useEffect(()=>{let live=true;setValue(null);if(token)getPreview(url,token).then(v=>{if(live)setValue(v);});return()=>{live=false;};},[url,token]);if(!value?.title&&!value?.description)return null;return <div className="link-preview-summary">{value.title&&<strong>{value.title}</strong>}{value.description&&<span>{value.description}</span>}</div>;}
export function MessageLinkPreviews({text,token}){return <>{messageLinks(text).map(url=><a className="message-link-preview" href={url} target="_blank" rel="noopener noreferrer" key={url}><LinkSummary url={url} token={token}/></a>)}</>;}
