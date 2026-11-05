import readExcelFile from 'read-excel-file/web-worker';
import {parseCsv,sheetTables} from './sheetData.js';
self.onmessage=async({data:{file}})=>{
 try{
  let sheets;
  if(/\.xlsx$/i.test(file.name))sheets=await readExcelFile(file);
  else {
   const bytes=await file.arrayBuffer();let text;
   if(new Uint8Array(bytes)[0]===255&&new Uint8Array(bytes)[1]===254)text=new TextDecoder('utf-16le').decode(bytes);
   else try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('euc-kr').decode(bytes);}
   sheets=parseCsv(text,file.name);
  }
  self.postMessage({tables:sheetTables(sheets,file.name)});
 }catch(error){self.postMessage({error:error.message||'데이터 시트를 읽지 못했습니다.'});}
};
