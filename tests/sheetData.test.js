import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,sheetTables} from '../src/canvas/sheets/sheetData.js';
test('CSV preserves quoted commas, line breaks, leading zeros and Korean',()=>{
 const sheets=parseCsv('\ufeff이름,코드,메모\r\n민수,0012,"서울, 부산"\r\n영희,0034,"첫 줄\n둘째 줄"','a.csv');
 const [table]=sheetTables(sheets,'a.csv');assert.deepEqual(table.columns,['이름','코드','메모']);assert.deepEqual(table.rows,[['민수','0012','서울, 부산'],['영희','0034','첫 줄\n둘째 줄']]);
});
test('large worksheets split without dropping rows or columns; sheets and dates preserved',()=>{
 const data=[Array.from({length:31},(_,i)=>'c'+i),...Array.from({length:101},(_,i)=>Array.from({length:31},(_,j)=>`${i}:${j}`))];
 const tables=sheetTables([{sheet:'First',data},{sheet:'Date',data:[['date'],[new Date('2026-01-01T00:00:00Z')]]}],'test.xlsx');
 assert.equal(tables.length,5);assert.equal(tables[0].rows.length,100);assert.equal(tables[3].rows[0][0],'100:30');assert.equal(tables[4].rows[0][0],'2026-01-01T00:00:00.000Z');assert.match(tables[4].filename,/Date/);
});
test('empty, malformed and excessive imports fail explicitly without truncating',()=>{
 assert.throws(()=>sheetTables([],'empty.csv'),/셀/);assert.throws(()=>parseCsv('a,b\n"unfinished'),'따옴표');
 assert.throws(()=>sheetTables([{sheet:'x',data:[['a'],['x'.repeat(4001)]]}],'x'),/4,000/);
});
