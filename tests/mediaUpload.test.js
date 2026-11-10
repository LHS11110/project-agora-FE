import test from 'node:test';import assert from 'node:assert/strict';
import {mediaFileType,mediaPosition} from '../src/canvas/media/mediaModel.js';
import {clipboardFileType,externalClipboardObjects} from '../src/canvas/clipboard/externalClipboard.js';
import {exportManifest,planManifest} from '../src/canvas/asCode/manifest.js';
test('GIF/video files bypass still-image conversion and GIF URLs are controllable objects',()=>{
 assert.equal(mediaFileType({name:'animation.GIF',type:''}),'gif');assert.equal(clipboardFileType({name:'a.gif',type:'image/gif'}),'media');assert.equal(clipboardFileType({name:'a.mp4',type:'video/mp4'}),'media');assert.equal(clipboardFileType({name:'a.png',type:'image/png'}),'image');
 const [gif]=externalClipboardObjects({text:'https://example.com/a.gif?original=1'});assert.equal(gif.kind,'link');assert.equal(gif.mediaType,'gif');assert.equal(gif.mediaLoop,false);
 const original=externalClipboardObjects({files:[{name:'image.png',type:'image/png'}],text:'https://example.com/a.gif'});assert.equal(original[0].mediaType,'gif');
});
test('pause, resume and infinite loop use one shared clock without resetting on reconnect',()=>{
 const state={paused:false,time:1,updatedAt:1000,actor:'test'};assert.equal(mediaPosition(state,3,false,6000),3);assert.equal(mediaPosition(state,3,true,6000),0);assert.equal(mediaPosition({...state,paused:true},3,true,6000),1);
});
test('playback and loop state survive export/import and reject nonboolean loop flags',()=>{
 const item={kind:'link',mediaType:'gif',url:'/api/canvases/1/media/11111111-1111-4111-8111-111111111111.gif',mediaLoop:true,mediaState:{paused:true,time:.4,updatedAt:1,actor:'t'},x:0,y:0,width:.3,height:.3,permission:'default'};
 const plan=planManifest(exportManifest({a:item}),{},'default');assert.deepEqual(plan.creates[0].item,item);assert.throws(()=>planManifest(exportManifest({a:{...item,mediaLoop:'yes'}}),{},'default'));
});
