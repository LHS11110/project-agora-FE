import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChartData, formatChartData, chartNumber, newChartData, CHART_TYPES } from '../src/canvas/charts/chartData.js';
import { volumeGeometry, volumeShapeCatalog } from '../src/canvas/volumeGeometry.js';
import { drawVectorItems } from '../src/canvas/drawVectorItems.js';
import { rasterDescriptor, sameRasterInput } from '../src/canvas/rasterObjectCache.js';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';
import { createObjectDiagnostics, updateObjectDiagnostics } from '../src/canvas/diagnostics/objectDiagnostics.js';

test('CSV and spreadsheet data round-trip quoted commas, tabs and newlines', () => {
  const csv = '"Name\t(label)",Value\n"A, B",12\n"two\nlines",-3.5';
  const data = parseChartData(csv);
  assert.deepEqual(data, {columns:['Name\t(label)','Value'],rows:[['A, B','12'],['two\nlines','-3.5']]});
  assert.deepEqual(parseChartData(formatChartData(data.columns,data.rows)),data);
  assert.deepEqual(parseChartData('항목\t값\n가\t42').rows,[['가','42']]);
  assert.equal(chartNumber(''),null);
  assert.equal(chartNumber('-3.5'),-3.5);
  assert.equal(chartNumber('Infinity'),null);
  assert.throws(()=>parseChartData('a,b\n"unclosed'));
  assert.throws(()=>parseChartData('a,b\n'+Array(101).fill('a,1').join('\n')));
});

test('chart data and 3D styles survive manifest export and validation', () => {
  for (const chartType of CHART_TYPES) {
    const chart = {kind:'chart',...newChartData(),chartType,x:0,y:0,width:.3,height:.2};
    const volume = {kind:'shape',shapeType:'volume-cube',volumeStyle:'wireframe',fill:'#abcdef',x:0,y:0,width:.1,height:.1};
    const plan = planManifest(exportManifest({chart,volume}),{},'public');
    assert.equal(plan.creates.find(entry=>entry.id==='chart').item.chartType,chartType);
    assert.equal(plan.creates.find(entry=>entry.id==='volume').item.volumeStyle,'wireframe');
  }
});

test('a valid chart is not reported as an unsupported object', () => {
  const chart={kind:'chart',...newChartData(),x:0,y:0,width:.3,height:.2};
  assert.deepEqual(updateObjectDiagnostics(createObjectDiagnostics(),{chart}),[]);
});

test('all volume geometries paint solid faces and wireframes without stale raster cache', () => {
  const world={width:1000,height:1000};
  function graphics(){const g={fills:0,strokes:0};for(const method of ['clear','moveTo','lineTo','poly','circle'])g[method]=()=>g;g.fill=()=>{g.fills++;return g};g.stroke=()=>{g.strokes++;return g};return g;}
  for (const {id} of volumeShapeCatalog) {
    const geometry=volumeGeometry(id,200,150);
    assert.ok(geometry.faces.length && geometry.paths.length);
    assert.ok([...geometry.faces.map(face=>face.points),...geometry.paths].flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=200&&p.y>=0&&p.y<=150));
    const solid={kind:'shape',shapeType:id,x:0,y:0,width:.2,height:.15,fill:'#aabbcc',color:'#111111'};
    const wire={...solid,volumeStyle:'wireframe'}, a=graphics(), b=graphics();
    drawVectorItems(a,{a:solid},1000,1000);drawVectorItems(b,{b:wire},1000,1000);
    assert.ok(a.fills>0);assert.equal(b.fills,0);assert.ok(b.strokes>0);
    assert.equal(sameRasterInput(solid,wire),false);
    assert.notEqual(rasterDescriptor('a',solid,world,{}).key,rasterDescriptor('a',wire,world,{}).key);
  }
});
