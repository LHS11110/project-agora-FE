export const NOTEBOOK_LIMIT=32;
const text=value=>Array.isArray(value)?value.join(''):String(value??'');
export const notebookCell=(cellType='code')=>({id:crypto.randomUUID(),cellType,source:''});
export function validNotebookCells(cells){return Array.isArray(cells)&&cells.length<=NOTEBOOK_LIMIT&&new Set(cells.map(c=>c?.id)).size===cells.length&&JSON.stringify(cells).length<=262144&&cells.every(c=>c&&Object.keys(c).every(k=>['id','cellType','source'].includes(k))&&/^[a-zA-Z0-9_-]{1,128}$/.test(c.id)&&['code','markdown'].includes(c.cellType)&&typeof c.source==='string'&&new TextEncoder().encode(c.source).length<=65536);}
export function validNotebookResults(results){return results&&typeof results==='object'&&!Array.isArray(results)&&Object.keys(results).length<=NOTEBOOK_LIMIT&&JSON.stringify(results).length<=524288&&Object.entries(results).every(([id,r])=>/^[a-zA-Z0-9_-]{1,128}$/.test(id)&&r&&typeof r==='object'&&!Array.isArray(r)&&Array.isArray(r.outputs)&&r.outputs.length<=128&&r.outputs.every(o=>o&&['stream','display_data','execute_result','error'].includes(o.output_type))&&(r.executionCount==null||Number.isSafeInteger(r.executionCount)));}
export function importNotebook(document){
 if(document?.nbformat!==4||!Array.isArray(document.cells)||document.cells.length>NOTEBOOK_LIMIT)throw Error('최대 32개 셀의 ipynb 파일을 선택하세요.');
 const cells=document.cells.filter(c=>['code','markdown'].includes(c.cell_type)).map(c=>({id:crypto.randomUUID(),cellType:c.cell_type,source:text(c.source)}));
 if(!validNotebookCells(cells))throw Error('노트북의 셀 크기 또는 형식을 확인하세요.');
 // Import source only: existing output can contain scripts or excessive binary data.
 return {notebookCells:cells,notebookResults:{}};
}
export function exportNotebook(item){return {nbformat:4,nbformat_minor:5,metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'},language_info:{name:'python'}},cells:(item.notebookCells||[]).map(c=>({id:c.id,cell_type:c.cellType,metadata:{},source:c.source.split(/(?<=\n)/),...(c.cellType==='code'?{execution_count:item.notebookResults?.[c.id]?.executionCount??null,outputs:item.notebookResults?.[c.id]?.outputs||[]}:{} )}))};}
export const notebookHtml=html=>`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{font:13px system-ui;color:#283044;margin:8px;overflow:auto}table{border-collapse:collapse;max-width:100%}th,td{padding:6px 9px;border:1px solid #dce1e9}img{max-width:100%}a{color:inherit}</style>${html}`;
