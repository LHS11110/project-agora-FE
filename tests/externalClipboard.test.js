import test from 'node:test';
import assert from 'node:assert/strict';
import {externalClipboardObjects,clipboardFileType,clipboardTextObject} from '../src/canvas/clipboard/externalClipboard.js';
test('clipboard files take priority over duplicate text and HTML',()=>{
 const file={type:'image/png',name:'clip.png'};
 assert.deepEqual(externalClipboardObjects({files:[file],text:'https://example.com',html:'<img>'}),[{file,fileType:'image'}]);
 assert.equal(clipboardFileType({type:'',name:'document.pdf'}),'pdf');
 for(const name of ['table.csv','table.tsv','table.xlsx'])assert.equal(clipboardFileType({type:'application/octet-stream',name}),'sheet');
 assert.equal(clipboardFileType({type:'application/octet-stream',name:'main.py'}),'text');
 assert.equal(clipboardFileType({type:'application/octet-stream',name:'app.exe'}),null);
});
test('URLs become typed media without converting prose or unsafe schemes',()=>{
 const result=externalClipboardObjects({text:'https://youtu.be/dQw4w9WgXcQ\nhttps://example.com'});
 assert.equal(result.length,2);assert.equal(result[0].mediaType,'youtube');assert.equal(result[1].mediaType,'link');
 assert.equal(externalClipboardObjects({text:'https://example.com/image.png?version=1'})[0].kind,'image');
 for(const text of ['설명 https://example.com','javascript:alert(1)','file:///etc/passwd','https://user:pass@example.com'])assert.equal(externalClipboardObjects({text})[0].kind,'text');
 assert.equal(externalClipboardObjects({text:'www.example.com'})[0].url,'https://www.example.com/');
 assert.equal(externalClipboardObjects({uriList:'# comment\r\nhttps://example.com'})[0].kind,'link');
});
test('plain text preserves whitespace; code and Markdown files preserve their content',()=>{
 assert.equal(clipboardTextObject('  hello\n\tworld  ').text,'  hello\n\tworld  ');
 assert.equal(clipboardTextObject('print(1)','hello.py').language,'python');
 assert.equal(clipboardTextObject('# Heading','README.md').renderMode,'markdown');
 assert.throws(()=>clipboardTextObject('가'.repeat(22000)),/64KiB/);
 assert.deepEqual(externalClipboardObjects({text:' \n '}),[]);
});

test('notebooks are recognized without filenames and from file-only transfer items',async()=>{
 const {resolveExternalClipboardObjects,clipboardDataContent,readClipboardEntries}=await import('../src/canvas/clipboard/externalClipboard.js');
 const source=JSON.stringify({nbformat:4,cells:[{cell_type:'code',source:['print(42)']}]});
 const file=new File([source],'clipboard.json',{type:'application/json'});
 assert.equal((await resolveExternalClipboardObjects({files:[file]}))[0].fileType,'notebook');
 const transfer=clipboardDataContent({files:[],items:[{kind:'file',getAsFile:()=>file}],getData:()=>''});
 assert.equal(transfer.files[0],file);
 const rich=await readClipboardEntries([{types:['application/json'],getType:async()=>new Blob([source],{type:'application/json'})}]);
 assert.equal((await resolveExternalClipboardObjects(rich))[0].notebookDocument.nbformat,4);
 assert.equal((await resolveExternalClipboardObjects({files:[new File(['{"hello":1}'],'ordinary.json',{type:'application/json'})]}))[0].fileType,'text');
 assert.equal((await resolveExternalClipboardObjects({files:[new File([source],'notebook.bin',{type:'application/octet-stream'})]}))[0].fileType,'notebook');
});
