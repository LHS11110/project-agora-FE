import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPlainText } from '../src/canvas/plainTextRaster.js';
import { overviewProxy } from '../src/canvas/sceneRepresentation.js';
import { rasterDescriptor, sameRasterInput } from '../src/canvas/rasterObjectCache.js';

test('text color survives zoom preview and invalidates raster cache', () => {
  const item={kind:'text',text:'Hello',renderMode:'plain',x:0,y:0,width:.2,height:.2,color:'#c23456'};
  const proxy=overviewProxy(item);
  assert.equal(proxy.color,item.color);
  assert.equal(sameRasterInput(item,{...item,color:'#123456'}),false);
  const world={width:1000,height:1000};
  assert.notEqual(rasterDescriptor('t',item,world,{}).key,rasterDescriptor('t',{...item,color:''},world,{}).key);
  const context={save(){},restore(){},beginPath(){},rect(){},clip(){},measureText(s){return {width:s.length*5}},fillText(){}};
  drawPlainText(context,item,world,'sans-serif','#333333');assert.equal(context.fillStyle,'#c23456');
  drawPlainText(context,{...item,color:''},world,'sans-serif','#333333');assert.equal(context.fillStyle,'#333333');
});
