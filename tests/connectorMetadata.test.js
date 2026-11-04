import test from 'node:test';
import assert from 'node:assert/strict';
import {connectorGeometry} from '../src/components/connectorGeometry.js';
import CanvasSpatialBTree from '../src/components/CanvasSpatialBTree.js';
import {isDrawableCanvasItem} from '../src/canvas/drawableItems.js';
const world={width:1600,height:1000};
const fixture=()=>({a:{kind:'shape',shapeType:'rectangle',x:-.3,y:.04,width:.1,height:.04},b:{kind:'shape',shapeType:'rectangle',x:.4,y:.04,width:.1,height:.04},edge:{kind:'connector',from:'a',to:'b'}});
const path=items=>connectorGeometry(items.edge,items,world.width,world.height)?.points;
test('chat/comment metadata at the origin never bends an otherwise clear connection',()=>{
 const items=fixture();const metadata={...items,general:{type:'chat_room',permission:'test',data:[]},'object-comment-deleted':{type:'chat_room',permission:'test',data:[]}};
 assert.deepEqual(path(metadata),path(items));
 const updated={...metadata,general:{...metadata.general,data:[{text:'new message'}]}};assert.deepEqual(path(updated),path(items));
});
test('real visible objects at the origin still obstruct connectors',()=>{
 const items=fixture();assert.notDeepEqual(path({...items,box:{kind:'shape',shapeType:'rectangle',x:0,y:0,width:.2,height:.12}}),path(items));
});
test('nonvisual records and tombstones are excluded from the spatial index and cannot be endpoints',()=>{
 const items={...fixture(),general:{type:'chat_room',kind:'shape'},unknown:{kind:'internal-metadata'},deleted:{kind:'host-tombstone'}};
 const index=new CanvasSpatialBTree(items,world);assert.deepEqual([...index.entries.keys()].sort(),['a','b','edge']);
 assert.equal(connectorGeometry({kind:'connector',from:'a',to:'general'},items,1600,1000),null);
 assert.equal(isDrawableCanvasItem(items.unknown),false);
});
test('a visual object becoming metadata removes its old bounds and routing footprint',()=>{
 const items={...fixture(),box:{kind:'shape',x:0,y:0,width:.2,height:.12}};const index=new CanvasSpatialBTree(items,world);
 const updated={...items,box:{type:'chat_room',data:[]}};index.update(updated,world);
 assert.equal(index.entries.has('box'),false);assert.deepEqual(path(updated),path(fixture()));
 assert.equal(index.query({minX:0,minY:0,maxX:.2,maxY:.12}).some(e=>e.id==='box'),false);
});
