import test from 'node:test';
import assert from 'node:assert/strict';
import { sketchPath, arrowheadStrokeParts, sketchHatchPaths } from '../src/canvas/vectorStyle.js';
import { makeArrowHead, ARROW_HEAD_OPTIONS } from '../src/components/arrowheads/headShapes.js';
import { drawVectorItems } from '../src/canvas/drawVectorItems.js';
import { shapeCreationSize } from '../src/canvas/shapeCatalog.js';
import { exportManifest, planManifest } from '../src/canvas/asCode/manifest.js';

test('hand drawn paths are stable and keep connector endpoints anchored', () => {
  const points = [{x:0,y:0},{x:150,y:50},{x:200,y:0}];
  const path = sketchPath(points, 'connector-1');
  assert.deepEqual(path, sketchPath(points, 'connector-1'));
  assert.deepEqual(path[0], points[0]);
  assert.deepEqual(path.at(-1), points.at(-1));
  assert.notDeepEqual(path, sketchPath(points, 'connector-2'));
  assert.ok(path.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test('A-series rectangles use the physical millimetre ratios in a non-square world', () => {
  for (const [name,w,h] of [['a1',594,841],['a2',420,594],['a3',297,420],['a4',210,297]]) {
    const size = shapeCreationSize('paper-'+name,{width:1600,height:900});
    assert.ok(Math.abs(size.width*1600/(size.height*900)-w/h)<1e-12);
  }
});

function graphics() {
  const g={fills:0,strokes:[]};
  for (const method of ['clear','moveTo','lineTo','poly','circle']) g[method]=()=>g;
  g.fill=()=>{g.fills++;return g};g.stroke=style=>{g.strokes.push(style);return g};return g;
}
test('transparent shapes emit no paint; fill and border can be toggled independently', () => {
  const base={kind:'shape',shapeType:'rectangle',x:0,y:0,width:.2,height:.2,color:'#123456',fill:'',strokeEnabled:false};
  const invisible=graphics();drawVectorItems(invisible,{a:base},1000,1000);
  assert.equal(invisible.fills,0);assert.equal(invisible.strokes.length,0);
  const filled=graphics();drawVectorItems(filled,{a:{...base,fill:'#ff0000'}},1000,1000);
  assert.equal(filled.fills,1);assert.equal(filled.strokes.length,0);
  const legacy=graphics();drawVectorItems(legacy,{a:{...base,strokeEnabled:undefined}},1000,1000);
  assert.equal(legacy.strokes.length,1);
  const sketch=graphics();drawVectorItems(sketch,{a:{...base,strokeEnabled:true,visualStyle:'sketch'}},1000,1000);
  assert.equal(sketch.strokes.length,2);
});

test('styles and transparency survive canvas code export and import', () => {
  const original={a:{kind:'shape',shapeType:'paper-a4',x:0,y:0,fill:'',strokeEnabled:false,visualStyle:'sketch',width:.14,height:.2}};
  const plan=planManifest(exportManifest(original),{},'public');
  assert.equal(plan.creates[0].item.strokeEnabled,false);
  assert.equal(plan.creates[0].item.visualStyle,'sketch');
  assert.throws(()=>planManifest({version:1,items:{a:{kind:'shape',visualStyle:'invalid'}}},{},'public'));
});

test('connector shafts use the selected style while retaining existing arrow geometry', () => {
  const refs={a:{kind:'shape',x:.1,y:.1,width:.1,height:.1,strokeEnabled:false},b:{kind:'shape',x:.6,y:.4,width:.1,height:.1,strokeEnabled:false}};
  const connector={kind:'connector',from:'a',to:'b',color:'#123456',strokeWidth:2};
  const standard=graphics();drawVectorItems(standard,{...refs,c:connector},1000,1000);
  const sketch=graphics();drawVectorItems(sketch,{...refs,c:{...connector,visualStyle:'sketch'}},1000,1000);
  assert.ok(standard.strokes.length>0);
  assert.ok(sketch.strokes.length>standard.strokes.length);
  assert.ok(sketch.strokes.some(s=>s.alpha===.85));
});

test('sketch drift stays smooth, bounded and anchored at rectangle corners', () => {
  const points = [{x:0,y:0},{x:160,y:0},{x:160,y:100},{x:0,y:100},{x:0,y:0}];
  const path = sketchPath(points, 'rectangle');
  for (const corner of points) assert.ok(path.some(point => point.x === corner.x && point.y === corner.y));
  for (let i=1;i<path.length;i++) assert.ok(Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y)<4);
  assert.ok(path.every(point => point.x >= -2.5 && point.x <= 162.5 && point.y >= -2.5 && point.y <= 102.5));
  assert.deepEqual(sketchPath([{x:1,y:2},{x:1,y:2}], 'zero'), [{x:1,y:2},{x:1,y:2}]);
});

test('every arrowhead shape including circles uses the same seeded sketch strokes', () => {
  for (const {value} of ARROW_HEAD_OPTIONS.filter(option => option.value !== 'none')) {
    const head = makeArrowHead(value, {x:40,y:30}, {x:1,y:0}, 18, 2);
    const parts = arrowheadStrokeParts(head, 'sketch', 'arrow');
    assert.deepEqual(parts, arrowheadStrokeParts(head, 'sketch', 'arrow'));
    for (const [index, part] of parts.entries()) {
      assert.equal(part.strokes.length, 2);
      const outline = part.closed ? [...head.parts[index].points, head.parts[index].points[0]] : head.parts[index].points;
      // At the 3px sampling resolution, tiny ERD stems contain only anchored endpoints.
      if (outline.length === 2 && Math.hypot(outline[1].x-outline[0].x, outline[1].y-outline[0].y) <= 3) {
        assert.deepEqual(part.strokes[0].points, outline);
        assert.deepEqual(part.strokes[1].points, outline);
      } else {
        assert.notDeepEqual(part.strokes[0].points, part.strokes[1].points);
        assert.notDeepEqual(part.strokes[0].points, outline);
      }
      assert.deepEqual(part.strokes[0].points[0], outline[0]);
      assert.deepEqual(part.strokes[0].points.at(-1), outline.at(-1));
      assert.ok(part.strokes[1].alpha < part.strokes[0].alpha);
    }
  }
});

test('Pixi paints hand drawn circular heads as sketch paths rather than perfect circles', () => {
  const refs={a:{kind:'shape',x:.1,y:.1,width:.1,height:.1,strokeEnabled:false},b:{kind:'shape',x:.6,y:.4,width:.1,height:.1,strokeEnabled:false}};
  const item={kind:'connector',from:'a',to:'b',startHead:'circle',endHead:'circle-outline',visualStyle:'sketch'};
  const g=graphics();let circles=0,polygons=0;
  g.circle=()=>{circles++;return g};g.poly=()=>{polygons++;return g};
  drawVectorItems(g,{...refs,c:item},1000,1000);
  assert.equal(circles,0);assert.equal(polygons,4);assert.equal(g.fills,0);
  assert.ok(g.strokes.length > 4, 'Filled sketch head uses sparse diagonal strokes');
});


test('layered hatch lines are deterministic, diagonal and clipped to concave boundaries', () => {
  const polygon = [{x:0,y:0},{x:100,y:0},{x:100,y:30},{x:30,y:30},{x:30,y:100},{x:0,y:100}];
  const strokes = sketchHatchPaths(polygon, 'L-shape');
  assert.ok(strokes.length > 20);
  assert.deepEqual(strokes, sketchHatchPaths(polygon, 'L-shape'));
  assert.notDeepEqual(strokes, sketchHatchPaths(polygon, 'other'));
  assert.ok(strokes.some(s => s.widthScale === .7));
  assert.ok(strokes.some(s => s.widthScale === 1));
  for (const {points:[a,b]} of strokes) {
    assert.ok((b.x-a.x)*(b.y-a.y) < 0, 'Fill runs diagonally');
    for (let i=0;i<=20;i++) {
      const x=a.x+(b.x-a.x)*i/20, y=a.y+(b.y-a.y)*i/20;
      assert.ok(x >= -1e-8 && x <= 100+1e-8 && y >= -1e-8 && y <= 100+1e-8);
      assert.ok(x <= 30+1e-8 || y <= 30+1e-8, 'No line crosses the concave cutout');
    }
  }
  assert.deepEqual(sketchHatchPaths([], 'empty'), []);
});

test('only filled sketch arrowhead parts use hatching; normal heads retain solid fill', () => {
  for (const {value} of ARROW_HEAD_OPTIONS.filter(option => option.value !== 'none')) {
    const head=makeArrowHead(value,{x:40,y:30},{x:1,y:0},18,2);
    for (const part of arrowheadStrokeParts(head,'sketch',value)) {
      assert.equal(part.hatches.length > 0, part.filled);
    }
    assert.ok(arrowheadStrokeParts(head,'standard',value).every(part => !part.hatches.length));
  }
  const shape={kind:'shape',shapeType:'star',x:.1,y:.1,width:.3,height:.3,fill:'#ff5522',strokeEnabled:false,visualStyle:'sketch'};
  const sketch=graphics();drawVectorItems(sketch,{s:shape},1000,600);
  assert.equal(sketch.fills,0);assert.ok(sketch.strokes.length>20);
  const normal=graphics();drawVectorItems(normal,{s:{...shape,visualStyle:'standard'}},1000,600);
  assert.equal(normal.fills,1);assert.equal(normal.strokes.length,0);
});
