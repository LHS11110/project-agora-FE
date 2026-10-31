import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {emitThirdPartyNotices} from '../build/thirdPartyNotices.js';
test('distribution includes React, Monaco notices and all installed production dependency licenses',()=>{
 const out=mkdtempSync(join(tmpdir(),'agora-notices-'));
 try{const components=emitThirdPartyNotices(process.cwd(),out);
  for(const name of ['react','react-dom','monaco-editor','pdfjs-dist','perfect-freehand','rbush'])assert.ok(components.find(p=>p.name===name)?.notices.length,name);
  const monaco=components.find(p=>p.name==='monaco-editor');assert.ok(monaco.notices.some(p=>p.endsWith('ThirdPartyNotices.txt')));
  assert.deepEqual(components.filter(p=>!p.notices.length),[]);
  assert.match(readFileSync(join(out,'licenses/LICENSE'),'utf8'),/MIT License/);
 }finally{rmSync(out,{recursive:true,force:true});}
});
