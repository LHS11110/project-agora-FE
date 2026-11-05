import test from 'node:test';import assert from 'node:assert/strict';
import {isRasterCode,codePreviewHeight} from '../src/canvas/codePreviewMetrics.js';
import {isVectorItem,needsVectorDom} from '../src/canvas/vectorHitTest.js';
import {objectBounds} from '../src/components/CanvasSpatialBTree.js';
const item={kind:'text',renderMode:'code',text:'x=1\nprint(x)',width:.3,x:.1,y:.2};
test('inactive code cards use cached pixels while selection and editing retain the real editor',()=>{
 assert.equal(isRasterCode(item),true);assert.equal(isVectorItem(item),true);assert.equal(needsVectorDom('a',item,new Set(),null,null),false);
 assert.equal(needsVectorDom('a',item,new Set(['a']),null,null),true);assert.equal(needsVectorDom('a',item,new Set(),'a',null),true);
 const expected=89+24+2*21;assert.equal(codePreviewHeight(item),expected);
 const bounds=objectBounds(item,{a:item},1600,1000);assert.ok(Math.abs((bounds.maxY-bounds.minY)*1000-expected)<1e-9);
});
