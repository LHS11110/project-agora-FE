import {useEffect,useRef} from 'react';
import {api} from '../../api/client.js';
import {mediaFileType} from './mediaModel.js';
export function useMediaUpload({canvasId,token,permission,addItem,centeredItemPosition,createId,setActiveTool,selectItems,setToast}){
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[canvasId]);
 return async(event,options={})=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const type=mediaFileType(file);if(!type){setToast('MP4·WebM·OGV 동영상 또는 GIF 파일을 선택해주세요.');return;}
  if(file.size>(type==='gif'?20:100)*1024*1024){setToast('동영상은 100MiB, GIF는 20MiB 이하로 올려주세요.');return;}
  const turn=generation.current,valid=()=>turn===generation.current&&options.canInsert?.()!==false;
  setToast('미디어를 업로드하는 중입니다…');
  try{const body=new FormData();body.append('file',file);const resource=await api(`/api/canvases/${canvasId}/media`,{method:'POST',body,token});if(!valid())return;const id=createId();
   const item={kind:'link',...resource,title:file.name,filename:file.name,mediaLoop:false,mediaState:{paused:true,time:0,updatedAt:Date.now(),actor:'upload'},width:.36,height:.3,permission,...(options.position?{x:options.position.x-.18,y:options.position.y-.15}:centeredItemPosition(.36,.3))};
   if(!addItem(id,item))throw Error('미디어 객체를 추가하지 못했습니다. 연결 상태와 권한을 확인해주세요.');setActiveTool('select');selectItems([id]);setToast('미디어를 추가했습니다. 재생 버튼으로 시작하세요.');return id;
  }catch(error){if(valid())setToast(error.message||'미디어를 업로드하지 못했습니다.');}
 };
}
