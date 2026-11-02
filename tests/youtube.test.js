import test from 'node:test';
import assert from 'node:assert/strict';
import {parseYoutube,parseSubtitles} from '../src/media/youtube.js';
test('YouTube links accept exact hosts, shorts, start times and reject lookalikes',()=>{
 for(const url of ['https://youtube.com/watch?v=dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ','https://m.youtube.com/shorts/dQw4w9WgXcQ'])assert.equal(parseYoutube(url).id,'dQw4w9WgXcQ');
 assert.equal(parseYoutube('https://youtu.be/dQw4w9WgXcQ?t=1h2m3s').start,3723);
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://youtube.com/watch?v=invalid'])assert.equal(parseYoutube(url),null);
});
test('SRT and VTT cues preserve multiline plain text and ignore malformed timing',()=>{
 assert.deepEqual(parseSubtitles('WEBVTT\n\n00:01.000 --> 00:03.000 align:center\n<b>Hello</b>\nworld'),[{start:1,end:3,text:'Hello\nworld'}]);
 assert.equal(parseSubtitles('1\n00:00:02,000 --> 00:00:01,000\ninvalid').length,0);
});

test('launcher avoids bottom right canvas panels on desktop and mobile',async()=>{
 const {launcherPosition}=await import('../src/media/playerLayout.js');
 for(const [width,height] of [[1440,900],[390,844]]){
  const obstacle={left:width-220,right:width,top:height-100,bottom:height};
  const p=launcherPosition(width,height,[obstacle]);
  assert.ok(p.left+42<=width&&p.top+42<=height);
  assert.ok(p.left+42<=obstacle.left-10||p.top+42<=obstacle.top-10);
 }
});
