import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import en from '../src/i18n/en.js';
import { translate } from '../src/i18n/locale.js';
import { DESK_OBJECTS } from '../src/home/deskObjects.js';
import { KNOWLEDGE_SCENES } from '../src/home/knowledgeScenes.js';
import { PROJECT_MAP_NODES } from '../src/home/projectMapData.js';
import { codeLanguageGroups } from '../src/canvas/codeLanguages.js';
const traverse=traverseModule.default;
function files(dir){return fs.readdirSync(dir).flatMap(file=>{const p=path.join(dir,file);return fs.statSync(p).isDirectory()?files(p):[p]});}
test('rendered static UI and accessible labels contain no untranslated Korean literals',()=>{
 const missing=[];
 for(const file of files(fileURLToPath(new URL('../src/',import.meta.url))).filter(p=>p.endsWith('.jsx')&&!p.endsWith('LanguageSwitcher.jsx'))){
  const ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']});
  const report=(node,value)=>missing.push(`${file}:${node.loc.start.line}: ${value}`);
  traverse(ast,{
   JSXText(p){if(/[가-힣]/.test(p.node.value))report(p.node,p.node.value.trim());},
   JSXAttribute(p){if(['aria-label','title','placeholder','alt','label','aria-valuetext'].includes(p.node.name.name)&&p.node.value?.type==='StringLiteral'&&/[가-힣]/.test(p.node.value.value))report(p.node,p.node.value.value);},
   TemplateLiteral(p){if(p.node.quasis.some(q=>/[가-힣]/.test(q.value.cooked)))report(p.node,'Unlocalized dynamic UI template');}
  });
 }
 assert.deepEqual(missing,[]);
});
test('home catalogs and code language groups have complete English labels without mutating source data',()=>{
 const catalogs={DESK_OBJECTS,KNOWLEDGE_SCENES,PROJECT_MAP_NODES,codeLanguageGroups};const before=JSON.stringify(catalogs);
 function check(value){if(typeof value==='string'&&/[가-힣]/.test(value))assert.ok(!/[가-힣]/.test(translate(value,'en')),value);else if(value&&typeof value==='object')Object.values(value).forEach(check);}
 check(catalogs);assert.equal(JSON.stringify(catalogs),before);
});
test('dynamic message translations keep all interpolation parameters',()=>{
 const params=s=>[...s.matchAll(/\{(v\d+|tool|created|updated|deleted|count|message|id|index|label|action)\}/g)].map(m=>m[1]).sort();
 for(const [key,value] of Object.entries(en))assert.deepEqual(params(value),params(key),key);
});
