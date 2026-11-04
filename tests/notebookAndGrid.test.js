import test from 'node:test';
import assert from 'node:assert/strict';
import {snapPosition,snapNewItem,snappedTranslation,gridInterval} from '../src/canvas/gridPlacement.js';
import {gridProjection} from '../src/canvas/gridProjection.js';
import {validNotebookCells,validNotebookResults,importNotebook,exportNotebook,notebookHtml} from '../src/canvas/notebook/notebookData.js';
import {isRuntimeOnlyOperation} from '../src/canvas/runtime/sharedState.js';
test('grid placement uses world pixels, negative coordinates and group-relative movement',()=>{
 assert.deepEqual(snapPosition({x:19/1600,y:-31/1000},20),{x:20/1600,y:-40/1000});
 const a={x:.103,y:.107},b={x:.203,y:.307};const d=snappedTranslation(a,.017,.023,40);
 assert.ok(Math.abs((a.x+d.dx)*1600/40-Math.round((a.x+d.dx)*1600/40))<1e-10);
 assert.equal((b.x+d.dx)-(a.x+d.dx),b.x-a.x);
 const stroke={kind:'stroke',points:[a,b]};assert.equal(snapNewItem(stroke,20),stroke);
 assert.equal(gridInterval(0),20);
 for(const scale of [.001,.25,1,4,100]){const p=gridProjection({x:0,y:0,scale},40);assert.ok(p.spacing>=12);assert.ok(p.spacing/(40*scale)>=1);assert.ok(Number.isInteger(Math.round(p.spacing/(40*scale))));}
});
test('ipynb source import and output export preserve cell semantics and reject excessive source',()=>{
 const item=importNotebook({nbformat:4,cells:[{cell_type:'code',source:['x = 1\n','x'],outputs:[{output_type:'display_data',data:{'text/html':'<script>bad()</script>'}}]},{cell_type:'markdown',source:'# Notes'}]});
 assert.equal(validNotebookCells(item.notebookCells),true);assert.deepEqual(item.notebookResults,{});assert.equal(item.notebookCells[0].source,'x = 1\nx');
 const id=item.notebookCells[0].id;item.notebookResults={[id]:{outputs:[{output_type:'stream',text:'1\n',name:'stdout'}],executionCount:1,exitCode:0}};
 assert.equal(validNotebookResults(item.notebookResults),true);assert.equal(exportNotebook(item).cells[0].execution_count,1);
 assert.equal(validNotebookCells([{...item.notebookCells[0],source:'x'.repeat(65537)}]),false);
 assert.throws(()=>importNotebook({nbformat:3,cells:[]}));
 assert.ok(notebookHtml('<table></table>').includes("default-src 'none'"));
});
test('execute-only notebook state cannot modify source or bypass content permissions',()=>{
 const item={kind:'shape',runtimeRole:'notebook',locked:true};
 assert.equal(isRuntimeOnlyOperation(item,{action:'patch',patch:{notebookResults:{}}}),true);
 assert.equal(isRuntimeOnlyOperation(item,{action:'patch',patch:{notebookResults:{},notebookCells:[]}}),false);
});
