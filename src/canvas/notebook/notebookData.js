export const NOTEBOOK_LIMIT=32;
export const NOTEBOOK_FILE_LIMIT_BYTES=1024*1024;
const text=value=>Array.isArray(value)?value.join(''):String(value??'');
export const notebookCell=(cellType='code')=>({id:crypto.randomUUID(),cellType,source:''});
export function notebookCellObjectId(notebookId,cellId){
 const prefix=String(notebookId||'notebook').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,38)||'notebook';
 const suffix=String(cellId||crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,76)||crypto.randomUUID();
 return `${prefix}-nc-${suffix}`.slice(0,128);
}
export function notebookCellItem(notebookId,parent,cell,index,result,explicitId){
 const objectId=explicitId||notebookCellObjectId(notebookId,cell.id);
 return {id:objectId,item:{kind:'shape',shapeType:'rectangle',runtimeRole:'notebook-cell',notebookId,notebookCell:cell,...(result?{notebookResult:result}:{}),groupId:notebookId,x:Number(parent.x)||0,y:(Number(parent.y)||0)+(Number(parent.height)||.09)+.025+index*.255,width:Number(parent.width)||.48,height:.235,permission:parent.permission}};
}
export function validNotebookCell(cell){return Boolean(cell&&typeof cell==='object'&&!Array.isArray(cell)&&Object.keys(cell).every(k=>['id','cellType','source'].includes(k))&&/^[a-zA-Z0-9_-]{1,128}$/.test(cell.id||'')&&['code','markdown'].includes(cell.cellType)&&typeof cell.source==='string'&&new TextEncoder().encode(cell.source).length<=65536);}
export function validNotebookCells(cells){return Array.isArray(cells)&&cells.length<=NOTEBOOK_LIMIT&&new Set(cells.map(c=>c?.id)).size===cells.length&&new TextEncoder().encode(JSON.stringify(cells)).length<=524288&&cells.every(c=>c&&Object.keys(c).every(k=>['id','cellType','source'].includes(k))&&/^[a-zA-Z0-9_-]{1,128}$/.test(c.id)&&['code','markdown'].includes(c.cellType)&&typeof c.source==='string'&&new TextEncoder().encode(c.source).length<=65536);}
function validOutput(o){
 if(!o||typeof o!=='object'||Array.isArray(o)||!['stream','display_data','execute_result','error'].includes(o.output_type))return false;
 if(Object.keys(o).some(k=>!['output_type','name','text','data','metadata','execution_count','ename','evalue','traceback'].includes(k)))return false;
 const stringOrLines=v=>typeof v==='string'||Array.isArray(v)&&v.every(line=>typeof line==='string');
 if(o.text!==undefined&&!stringOrLines(o.text)||o.traceback!==undefined&&(!Array.isArray(o.traceback)||!o.traceback.every(line=>typeof line==='string')))return false;
 if(['name','ename','evalue'].some(k=>o[k]!==undefined&&typeof o[k]!=='string'))return false;
 if(o.data!==undefined&&(!o.data||typeof o.data!=='object'||Array.isArray(o.data)||Object.entries(o.data).some(([mime,v])=>!['text/plain','text/html','image/png','image/jpeg','image/svg+xml'].includes(mime)||typeof v!=='string')))return false;
 return o.execution_count==null||Number.isSafeInteger(o.execution_count);
}
export function validNotebookResults(results){return results&&typeof results==='object'&&!Array.isArray(results)&&Object.keys(results).length<=NOTEBOOK_LIMIT&&new TextEncoder().encode(JSON.stringify(results)).length<=1048576&&Object.entries(results).every(([id,r])=>/^[a-zA-Z0-9_-]{1,128}$/.test(id)&&r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>['outputs','executionCount','exitCode','error','truncated'].includes(k))&&Array.isArray(r.outputs)&&r.outputs.length<=128&&r.outputs.every(validOutput)&&(r.executionCount==null||Number.isSafeInteger(r.executionCount))&&(r.exitCode===undefined||Number.isSafeInteger(r.exitCode))&&(r.error===undefined||typeof r.error==='string')&&(r.truncated===undefined||typeof r.truncated==='boolean'));}
export function validNotebookCellResult(result){return Boolean(result&&validNotebookResults({cell:result}));}
export function importNotebook(document){
 if(document?.nbformat!==4||!Array.isArray(document.cells)||document.cells.length>NOTEBOOK_LIMIT)throw Error('최대 32개 셀의 ipynb 파일을 선택하세요.');
 const cells=document.cells.filter(c=>['code','markdown'].includes(c.cell_type)).map(c=>({id:crypto.randomUUID(),cellType:c.cell_type,source:text(c.source)}));
 if(!validNotebookCells(cells))throw Error('셀은 각각 UTF-8 64KiB 이하, 전체 셀 데이터는 512KiB 이하여야 합니다. 노트북 형식도 확인하세요.');
 // Import source only: existing output can contain scripts or excessive binary data.
 return {notebookCells:cells,notebookResults:{}};
}
export function exportNotebook(item,cellItems=[]){
 const cells=Array.isArray(item.notebookCellIds)?cellItems.map(entry=>entry?.item?.notebookCell).filter(Boolean):item.notebookCells||[];
 const results=Array.isArray(item.notebookCellIds)?Object.fromEntries(cellItems.filter(entry=>entry?.item?.notebookCell&&entry.item.notebookResult).map(entry=>[entry.item.notebookCell.id,entry.item.notebookResult])):item.notebookResults||{};
 return {nbformat:4,nbformat_minor:5,metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'},language_info:{name:'python'}},cells:cells.map(c=>({id:c.id,cell_type:c.cellType,metadata:{},source:c.source.split(/(?<=\n)/),...(c.cellType==='code'?{execution_count:results[c.id]?.executionCount??null,outputs:(results[c.id]?.outputs||[]).map(output=>{const clean={...output};if(clean.output_type!=='execute_result')delete clean.execution_count;return clean;})}:{} )}))};
}
export const notebookHtml=(html,fontSize=13)=>`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{font:${Number.isFinite(fontSize)?Math.max(2,Math.min(512,fontSize)):13}px system-ui;color:#283044;margin:8px;overflow:auto}table{border-collapse:collapse;max-width:100%}th,td{padding:6px 9px;border:1px solid #dce1e9}img{max-width:100%}a{color:inherit}</style>${html}`;
