import test from 'node:test';
import assert from 'node:assert/strict';
import {snapPosition,snapNewItem,snappedTranslation,gridInterval} from '../src/canvas/gridPlacement.js';
import {gridProjection,applyGridProjection} from '../src/canvas/gridProjection.js';
import {validNotebookCells,validNotebookResults,importNotebook,exportNotebook,notebookHtml} from '../src/canvas/notebook/notebookData.js';
import {isRuntimeOnlyOperation} from '../src/canvas/runtime/sharedState.js';
test('grid placement uses world pixels, negative coordinates and group-relative movement',()=>{
 assert.deepEqual(snapPosition({x:19/1600,y:-31/1000},20),{x:20/1600,y:-40/1000});
 const a={x:.103,y:.107},b={x:.203,y:.307};const d=snappedTranslation(a,.017,.023,40);
 assert.ok(Math.abs((a.x+d.dx)*1600/40-Math.round((a.x+d.dx)*1600/40))<1e-10);
 assert.ok(Math.abs(((b.x+d.dx)-(a.x+d.dx))-(b.x-a.x))<1e-12);
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

test('wide custom grids use background offsets without scaling or moving the surface', () => {
 const style = {};
 const coarse = gridProjection({ x: 73, y: -64, scale: 16 }, { x: 10000, y: 1 });
 applyGridProjection({ style }, coarse);
 assert.equal(style.transform, 'none');
 assert.equal(style.backgroundSize, '160000px 320px');
 assert.equal(style.backgroundPosition, '-79927px -224px');
 assert.equal(style.width, '100%');

 const regular = gridProjection({ x: 15, y: 0, scale: 1 }, 40);
 applyGridProjection({ style }, regular);
 assert.equal(style.backgroundSize, '40px 40px');
 assert.equal(style.transform, 'translate3d(-5px,-20px,0)');
 assert.equal(style.backgroundPosition, '0px 0px');
 assert.equal(style.width, 'calc(100% + 64px)');

 // The default 1px snap interval displays the original 20px grid, widening as the camera zooms in.
 assert.equal(gridProjection({ x: 0, y: 0, scale: 1 }, { x: 1, y: 1 }).spacingX, 20);
 assert.equal(gridProjection({ x: 0, y: 0, scale: 16 }, { x: 1, y: 1 }).spacingX, 320);
 assert.equal(gridProjection({ x: 0, y: 0, scale: 0.1 }, { x: 1, y: 1 }).spacingX, 16);
});

test('independent horizontal and vertical grid intervals use the same world-space snap',()=>{
 assert.deepEqual(snapPosition({x:71/1600,y:71/1000},{x:40,y:25}),{x:80/1600,y:75/1000});
 const p=gridProjection({x:0,y:0,scale:2},{x:40,y:25});assert.ok(Math.abs(p.spacingX-80)<1e-9);assert.ok(Math.abs(p.spacingY-50)<1e-9);
});

test('notebook HTML uses a bounded numeric font size while keeping its sandbox policy',()=>{
 assert.match(notebookHtml('<table><tr><td>data</td></tr></table>',26),/font:26px system-ui/);
 assert.match(notebookHtml('test',Infinity),/font:13px system-ui/);
 assert.match(notebookHtml('test','13; color:red'),/font:13px system-ui/);
 assert.match(notebookHtml('test',1024),/font:512px system-ui/);
});

test('notebook source limits count UTF-8 bytes and match server aggregate bounds',()=>{
 const cell={id:'unicode',cellType:'code',source:'가'.repeat(21845)};
 assert.equal(validNotebookCells([cell]),true);
 assert.equal(validNotebookCells([{...cell,source:cell.source+'가'}]),false);
 const ascii=Array.from({length:7},(_,i)=>({id:'cell'+i,cellType:'code',source:'x'.repeat(65536)}));
 assert.equal(validNotebookCells(ascii),true);
 assert.equal(validNotebookCells([...ascii,{...ascii[0],id:'cell7'}]),false);
 assert.equal(validNotebookResults({cell:{outputs:[{output_type:'stream',text:'x'.repeat(600000)}],exitCode:0}}),true);
});
