import { useCallback, useEffect, useState } from 'react';
const KEY='agora_canvas_chrome_collapsed';
const defaults={info:false,host:false,minimap:false};
export default function useCanvasChrome(){
  const [collapsed,setCollapsed]=useState(()=>{
    try{const value=JSON.parse(localStorage.getItem(KEY));return Object.fromEntries(Object.keys(defaults).map(key=>[key,value?.[key]===true]));}
    catch{return {...defaults};}
  });
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(collapsed));}catch{/* Local preferences are optional. */}},[collapsed]);
  const toggle=useCallback(key=>{if(Object.hasOwn(defaults,key))setCollapsed(value=>({...value,[key]:!value[key]}));},[]);
  return {collapsed,toggle};
}
