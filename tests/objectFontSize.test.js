import test from 'node:test';
import assert from 'node:assert/strict';
import {supportsObjectFontSize,hasIndependentContentSize,objectFontSize,objectBaseFontSize,objectFontStyle,isObjectFontSize} from '../src/canvas/objectSize.js';
import {exportManifest,planManifest} from '../src/canvas/asCode/manifest.js';
import {isCanvasSyncItem,hasItemGeometryChanged} from '../src/canvas/useCanvasPeerGeometry.js';
test('every object kind exposes a saved font size, with font-only scaling for rich cards',()=>{
 for(const kind of ['text','note','code','math','table','shape','connector','stroke','image','link','pdf','chart','user-group','question']){
  const item={kind};assert.equal(supportsObjectFontSize(item),true);assert.equal(objectFontSize(item),objectBaseFontSize(item));
  const enlarged={kind,fontSize:objectBaseFontSize(item)*2};assert.equal(objectFontSize(enlarged),objectBaseFontSize(item)*2);
  assert.equal(objectFontStyle(enlarged)['--object-font-factor'],hasIndependentContentSize(item)?1:2);
 }
 assert.equal(supportsObjectFontSize(null),false);assert.equal(supportsObjectFontSize({kind:'host-tombstone'}),false);
});
test('legacy text scaling remains single and rich geometry notices font changes',()=>{
 assert.equal(objectFontStyle({kind:'link',contentScale:2})['--object-font-factor'],1);assert.equal(objectFontStyle({kind:'link',contentScale:2,fontSize:24})['--object-font-factor'],1.5);
 assert.equal(objectFontSize({kind:'text',contentScale:2}),26);assert.equal(objectFontStyle({kind:'text',fontSize:26})['--object-font-factor'],1);
 for(const kind of ['question','chart','image','pdf','shape','connector']){assert.equal(isCanvasSyncItem({kind}),true);assert.equal(hasItemGeometryChanged({kind,fontSize:12},{kind,fontSize:24}),true);}
 for(const value of [0,-1,257,Infinity,NaN])assert.equal(isObjectFontSize(value),false);assert.equal(isObjectFontSize(24),true);
 const q={kind:'shape',shapeType:'rectangle',fontSize:24,x:0,y:0,width:.2,height:.2};assert.equal(planManifest(exportManifest({q}),{}).creates[0].item.fontSize,24);
});

test('terminal uses its shell base size and scales chrome consistently across the saved range',()=>{
 const terminal={kind:'shape',runtimeRole:'terminal'};
 assert.equal(objectFontSize(terminal),13);
 for(const size of [2,8,26,64,256]){
  const item={...terminal,fontSize:size};
  assert.equal(objectFontSize(item),size);
  assert.equal(objectFontStyle(item)['--object-font-factor'],size/13);
 }
 assert.equal(objectBaseFontSize({kind:'shape',runtimeRole:'notebook'}),12);
});
