import test from 'node:test';
import assert from 'node:assert/strict';
import * as Automerge from '@automerge/automerge';
import { applyTextColor, colorPieces, colorRangesFromDoc, textColorRanges } from '../src/canvas/content/textColors.js';
import { makeCollaborativeItem } from '../src/canvas/collaborativeSync.js';
import { itemOperations, loadItemDoc, reduceHostOperations } from '../src/canvas/host/hostOperations.js';
import { canvasObjectPropsEqual } from '../src/canvas/canvasRenderEquality.js';
import { rasterDescriptor, sameRasterInput } from '../src/canvas/rasterObjectCache.js';
import { captureObjects, preparePaste } from '../src/canvas/clipboard/objectClipboard.js';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';
import { drawPlainText } from '../src/canvas/plainTextRaster.js';

test('color ranges follow edits and survive concurrent text changes', () => {
  const base=Automerge.from({content:'한😀 beautiful day'});
  const styled=applyTextColor(Automerge.clone(base),4,13,'#c23456');
  const edit=Automerge.change(Automerge.clone(base),draft=>Automerge.splice(draft,['content'],0,0,'새 '));
  const merged=Automerge.merge(styled,edit),ranges=colorRangesFromDoc(merged);
  assert.equal(merged.content.slice(ranges[0].start,ranges[0].end),'beautiful');
  assert.equal(ranges[0].color,'#c23456');
  assert.deepEqual(colorRangesFromDoc(applyTextColor(merged,ranges[0].start,ranges[0].end,'')),[]);
  assert.deepEqual(colorPieces('abcdef',[{start:1,end:3,color:'#123456'},{start:4,end:6,color:'#abcdef'}]),[{text:'a'},{text:'bc',color:'#123456'},{text:'d'},{text:'ef',color:'#abcdef'}]);
});

test('format-only changes are submitted and render caches notice the new marks', () => {
  const before=makeCollaborativeItem({kind:'text',text:'hello world',x:0,y:0,width:.3,height:.2,permission:'writers'});
  const document=applyTextColor(loadItemDoc(before),0,5,'#c23456');
  const ops=itemOperations({a:before},{a:{...before}},new Map([['a',document]]),['a']);
  assert.equal(ops.length,1);assert.equal(ops[0].action,'patch');assert.ok(ops[0].doc);
  const after=reduceHostOperations({a:before},ops,{groups:['writers']}).items.a;
  assert.deepEqual(textColorRanges(after),[{start:0,end:5,color:'#c23456'}]);
  assert.equal(canvasObjectPropsEqual({item:before},{item:after}),false);
  assert.equal(sameRasterInput(before,after),false);
  assert.notEqual(rasterDescriptor('a',before,{width:1600,height:1000},{}).key,rasterDescriptor('a',after,{width:1600,height:1000},{}).key);
  const draws=[], context={save(){},restore(){},beginPath(){},rect(){},clip(){},measureText(s){return {width:s.length*5}},fillText(text){draws.push([text,this.fillStyle])}};
  drawPlainText(context,rasterDescriptor('a',after,{width:1600,height:1000},{}).local,{width:1600,height:1000},'sans-serif','#333333');
  assert.deepEqual(draws,[['hello','#c23456'],[' world','#333333']]);
});

test('copy and paste preserve character colors without sharing the original CRDT identity', () => {
  const before=makeCollaborativeItem({kind:'text',text:'hello world',x:0,y:0,width:.3,height:.2,permission:'writers'});
  const marked=applyTextColor(loadItemDoc(before),0,5,'#c23456');
  const styled=reduceHostOperations({a:before},itemOperations({a:before},{a:{...before}},new Map([['a',marked]]),['a']),{groups:['writers']}).items.a;
  const copied=captureObjects({a:styled},['a'],'canvas'),plan=preparePaste(copied.text,{},'canvas','writers',{x:0,y:0});
  const pasted=makeCollaborativeItem(plan.creates[0].item);
  assert.deepEqual(textColorRanges(pasted),[{start:0,end:5,color:'#c23456'}]);
  assert.notEqual(pasted.automerge_snapshot,styled.automerge_snapshot);
  assert.equal(pasted.__initialTextColors,undefined);
});

test('canvas code round-trips character colors and adjusts them when text is edited', () => {
  const before=makeCollaborativeItem({kind:'text',text:'hello world',x:0,y:0,width:.3,height:.2,permission:'writers'});
  const marked=applyTextColor(loadItemDoc(before),0,5,'#c23456');
  const styled=reduceHostOperations({a:before},itemOperations({a:before},{a:{...before}},new Map([['a',marked]]),['a']),{groups:['writers']}).items.a;
  const exported=exportManifest({a:styled});
  assert.deepEqual(exported.items.a.textColors,[{start:0,end:5,color:'#c23456'}]);
  const restored=makeCollaborativeItem(planManifest(exported,{},'writers').creates[0].item);
  assert.deepEqual(textColorRanges(restored),textColorRanges(styled));
  const changed=planManifest({version:1,items:{a:{text:'new hello world'}}},{a:styled},'writers');
  assert.deepEqual(changed.updates[0].item.__initialTextColors,[{start:4,end:9,color:'#c23456'}]);
  const cleared=planManifest({version:1,items:{a:{textColors:[]}}},{a:styled},'writers');
  assert.deepEqual(cleared.updates[0].item.__initialTextColors,[]);
  assert.throws(()=>planManifest({version:1,items:{a:{textColors:[{start:0,end:200,color:'red'}]}}},{a:styled},'writers'));
});
