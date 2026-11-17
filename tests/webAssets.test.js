import fs from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';import {createWebAssetStore} from '../src/canvas/content/webAssetStore.js';import {htmlPreviewDocument} from '../src/canvas/content/htmlPreviewDocument.js';import {notebookHtml} from '../src/canvas/notebook/notebookData.js';
const code=(language,text)=>({kind:'text',renderMode:'code',language,text});
test('only incoming CSS/JS connections apply; duplicates and unrelated changes do not replay',()=>{const store=createWebAssetStore();let items={h:code('html','<h1>HTML</h1>'),c:code('css','h1{color:red}'),j:code('javascript','window.test=1'),a:{kind:'connector',from:'c',to:'h'},b:{kind:'connector',from:'j',to:'h'},duplicate:{kind:'connector',from:'j',to:'h'},reverse:{kind:'connector',from:'h',to:'c'}};store.update(items);assert.deepEqual(store.get('h'),{css:['h1{color:red}'],js:['window.test=1']});let calls=0;store.subscribe('h',()=>calls++);const before=store.get('h');items={...items,other:code('python','print(42)')};store.update(items,['other']);assert.equal(store.get('h'),before);assert.equal(calls,0);items={...items,c:code('css','h1{color:blue}')};store.update(items,['c']);assert.equal(calls,1);assert.deepEqual(store.get('h').css,['h1{color:blue}']);items={...items,a:{kind:'connector',from:'h',to:'c'}};store.update(items,['a']);assert.deepEqual(store.get('h').css,[]);delete items.j;store.update({...items},['j']);assert.deepEqual(store.get('h').js,[]);});
test('embedded CSS and JS cannot escape their bootstrap script',()=>{const doc=htmlPreviewDocument('<h1>HTML</h1>',{css:['/* </script><div> */'],js:['console.log("</script>")']});assert.ok(doc.includes('\\u003c/script>'));assert.ok(doc.includes("default-src 'none'"));assert.ok(!doc.includes('allow-same-origin'));});
test('sandbox preview strips external stylesheet links, CSS @imports, self-closing/unclosed scripts while keeping inline code',()=>{
  const source='<!doctype html><head><link rel="stylesheet" href="idea.css"><link href="style.css" rel="stylesheet"><link as="style" href="a.css"><link rel="prefetch" href="b.js"><link type="text/css" href="c.css"></head><body><h1>Title</h1><style>@import url("idea.css");\nbody{margin:0}@import "style.css";h1{color:#735cff}</style><script src="idea.js"/><script defer src="script.js"></script><script src="dangling.js"><script>window.__inline="<script src=\\"x.js\\"></script>";</script></body>';
  const doc=htmlPreviewDocument(source,{css:['@import url("style.css");body{margin:0}'],js:['window.__ok=true']});
  assert.ok(!doc.includes('idea.css'));assert.ok(!doc.includes('style.css'));assert.ok(!doc.includes('a.css'));assert.ok(!doc.includes('b.js'));assert.ok(!doc.includes('c.css'));
  assert.ok(!doc.includes('idea.js'));assert.ok(!doc.includes('script.js'));assert.ok(!doc.includes('dangling.js'));
  assert.ok(doc.includes('h1{color:#735cff}'));assert.ok(doc.includes('window.__inline='));
  const nb=notebookHtml('<link rel="stylesheet" href="idea.css"><style>@import "style.css";td{color:navy}</style><table></table>');
  assert.ok(!nb.includes('idea.css'));assert.ok(!nb.includes('style.css'));assert.ok(nb.includes('td{color:navy}'));
});
test('YouTube embed iframes delegate compute-pressure permission policy',()=>{
  for(const path of ['src/components/SharedMediaContent.jsx','src/components/LinkPreview.jsx','src/media/GlobalYoutubePlayer.jsx']){
    const text=fs.readFileSync(path,'utf8');
    assert.match(text,/allow="[^"]*\bcompute-pressure\b[^"]*"/,`${path} missing compute-pressure in iframe allow`);
  }
});
test('named values flow only through incoming links and update subscribers',()=>{
 const store=createWebAssetStore();let items={h:code('html',''),v:{kind:'value',title:'speed',valueType:'real',valueNumber:3},e:{kind:'connector',from:'v',to:'h'}};store.update(items);assert.equal(store.get('h').values.speed,3);
 items={...items,v:{...items.v,valueNumber:7}};store.update(items,['v']);assert.equal(store.get('h').values.speed,7);
 items={...items,e:{...items.e,from:'h',to:'v'}};store.update(items,['e']);assert.equal(store.get('h').values,undefined);
});
