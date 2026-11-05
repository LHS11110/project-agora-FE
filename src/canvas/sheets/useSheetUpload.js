import {useEffect,useRef} from 'react';
export function useSheetUpload(options){
 const latest=useRef(options),generation=useRef(0),worker=useRef(null),busy=useRef(false),cancel=useRef(null);latest.current=options;
 useEffect(()=>{generation.current++;return()=>{generation.current++;cancel.current?.();cancel.current=null;worker.current?.terminate();worker.current=null;busy.current=false;};},[options.canvasId]);
 return async(event,extra={})=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const c=latest.current;
  if(busy.current){c.setToast('데이터 시트를 가져오는 중입니다. 완료 후 다시 선택해주세요.');return;}
  if(!/\.(csv|tsv|xlsx)$/i.test(file.name)){c.setToast('CSV, TSV 또는 XLSX 파일을 선택해주세요.');return;}
  if(file.size>5*1024*1024){c.setToast('데이터 시트는 5MB 이하로 가져와주세요.');return;}
  const current=generation.current,valid=()=>generation.current===current&&extra.canInsert?.()!==false;
  busy.current=true;c.setToast('데이터 시트를 읽는 중입니다…');
  let timer,instance;
  try{
   const tables=await new Promise((resolve,reject)=>{
    instance=new Worker(new URL('./sheetWorker.js',import.meta.url),{type:'module'});worker.current=instance;cancel.current=()=>reject(new Error('취소되었습니다.'));
    timer=setTimeout(()=>reject(new Error('파일 읽기 시간이 초과됐습니다. 파일을 나눠 다시 시도해주세요.')),60000);
    instance.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data.tables);
    instance.onerror=()=>reject(new Error('데이터 시트를 읽지 못했습니다. 파일 형식을 확인해주세요.'));
    instance.postMessage({file});
   });
   if(!valid())return;
   const start=extra.position?{x:extra.position.x-.275,y:extra.position.y-.21}:c.centeredItemPosition(.55,.42),ids=[];
   for(const [index,item] of tables.entries()){
    if(!valid())break;
    const id=c.createId();
    if(!c.addItem(id,{...item,x:start.x+(index%3)*.6,y:start.y+Math.floor(index/3)*.48,permission:latest.current.permission}))throw new Error('표를 추가하지 못했습니다. 연결 상태와 권한을 확인해주세요.');
    ids.push(id);await new Promise(resolve=>setTimeout(resolve,32));
   }
   if(valid()){c.setActiveTool('select');c.selectItems(ids);c.setToast(`데이터 시트를 표 ${ids.length}개로 가져왔습니다. 첫 행은 열 이름으로 사용합니다.`);}
   return ids[0];
  }catch(error){if(valid())c.setToast(error.message);}
  finally{clearTimeout(timer);instance?.terminate();if(worker.current===instance){worker.current=null;cancel.current=null;}if(generation.current===current)busy.current=false;}
 };
}
