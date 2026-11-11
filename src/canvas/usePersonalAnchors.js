import {useCallback,useEffect,useState} from 'react';
export default function usePersonalAnchors(canvasId,user){
 const identity=user?.user_id??user?.email??`${user?.nickname||''}#${user?.tag_number??''}`,key=`agora_personal_anchors:${encodeURIComponent(identity)}:${encodeURIComponent(canvasId)}`;
 const [state,setState]=useState({key:'',anchors:[]});
 useEffect(()=>{let anchors=[];try{const data=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(data))anchors=data.filter(a=>a&&typeof a.name==='string'&&((a.type==='object'&&typeof a.objectId==='string')||(a.type==='objects'&&Array.isArray(a.objectIds)&&a.objectIds.length>1&&a.objectIds.every(id=>typeof id==='string'))||(a.type==='point'&&Number.isFinite(a.x)&&Number.isFinite(a.y)))).slice(0,10);}catch{}setState({key,anchors});},[key]);
 const save=useCallback(fn=>setState(old=>{if(old.key!==key)return old;const anchors=typeof fn==='function'?fn(old.anchors):fn;try{localStorage.setItem(key,JSON.stringify(anchors));}catch{}return {key,anchors};}),[key]);
 return [state.key===key?state.anchors:[],save];
}
