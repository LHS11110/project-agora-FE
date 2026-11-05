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

test('coarse grids keep a bounded surface and constant screen dot size',()=>{
 const style={setProperty(key,value){this[key]=value;}};
 applyGridProjection({style},{x:73,y:-64,scale:100},40);
 assert.equal(style.transform,'translate3d(-48px,-48px,0)');assert.ok(Math.abs(parseFloat(style.backgroundSize)-4000)<1e-8);
 assert.equal(style['--surface-dot-radius'],'1.5px');
 applyGridProjection({style},{x:0,y:0,scale:1},40);
 assert.equal(style.backgroundSize,'24px 24px');assert.ok(Math.abs(parseFloat(style['--surface-dot-radius'])*40/24-1.5)<1e-10);
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
