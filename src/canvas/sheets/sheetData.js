import Papa from 'papaparse';
import {MAX_TABLE_ROWS,MAX_TABLE_COLUMNS} from '../../components/tableModel.js';
export function parseCsv(text,filename='') {
 const result=Papa.parse(text.replace(/^\uFEFF/,''),{delimiter:/\.tsv$/i.test(filename)?'\t':'',skipEmptyLines:'greedy'});
 if(result.errors.some(e=>e.type==='Quotes'))throw new Error('CSV의 따옴표 형식이 올바르지 않습니다.');
 return [{sheet:filename,data:result.data}];
}
const cell=value=>value instanceof Date?value.toISOString():value==null?'':String(value);
export function sheetTables(sheets,filename) {
 const tables=[];let cells=0,bytes=0;
 for(const {sheet,data} of sheets){
  if(!data?.length)continue;
  const width=data.reduce((max,row)=>Math.max(max,row?.length||0),0);if(!width)continue;
  cells+=width*data.length;
  if(cells>100000)throw new Error('데이터 시트는 한 번에 100,000셀 이하로 가져와주세요.');
  const values=data.map(row=>Array.from({length:width},(_,i)=>cell(row?.[i])));
  for(const row of values)for(const value of row)if(new TextEncoder().encode(value).length>4000)throw new Error('한 셀의 내용은 UTF-8 기준 4,000바이트 이하여야 합니다.');
  // The first row becomes editable column headings; every other row is preserved.
  const headings=values[0],rows=values.slice(1);if(!rows.length)rows.push(Array(width).fill(''));
  for(let y=0;y<rows.length;y+=MAX_TABLE_ROWS)for(let x=0;x<width;x+=MAX_TABLE_COLUMNS){
   const table={kind:'table',filename:`${filename}${sheet&&sheet!==filename?' · '+sheet:''} · ${y+1}–${Math.min(rows.length,y+MAX_TABLE_ROWS)} / ${x+1}–${Math.min(width,x+MAX_TABLE_COLUMNS)}`,columns:headings.slice(x,x+MAX_TABLE_COLUMNS),rows:rows.slice(y,y+MAX_TABLE_ROWS).map(row=>row.slice(x,x+MAX_TABLE_COLUMNS)),width:.55,height:.42};
   const size=new TextEncoder().encode(JSON.stringify(table)).length;
   if(size>240000)throw new Error('표 하나의 내용이 너무 큽니다. 셀의 내용을 줄이거나 파일을 나눠주세요.');
   bytes+=size;if(bytes>2*1024*1024||tables.length>=100)throw new Error('가져올 데이터가 너무 큽니다. 파일을 나눠주세요.');
   tables.push(table);
  }
 }
 if(!tables.length)throw new Error('데이터 시트에 표시할 셀이 없습니다.');
 return tables;
}
