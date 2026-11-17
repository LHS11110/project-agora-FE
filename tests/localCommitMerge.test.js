import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLocalCommit,sameRepository,localCommitBase} from '../src/canvas/github/localCommitMerge.js';
const snapshot=items=>JSON.stringify({version:1,items});
test('successive local commits preserve earlier pushed changes and unrelated remote changes',()=>{
 const base=snapshot({a:{kind:'shape',x:0,y:0}}),first=snapshot({a:{kind:'shape',x:1,y:0}}),second=snapshot({a:{kind:'shape',x:1,y:2}});
 const pushed=mergeLocalCommit(base,first,base);
 assert.equal(JSON.parse(mergeLocalCommit(base,second,pushed)).items.a.y,2);
 const remote=snapshot({a:{kind:'shape',x:1,y:0},b:{kind:'text',text:'remote'}});
 assert.ok(JSON.parse(mergeLocalCommit(base,second,remote)).items.b);
});
test('conflicting edits, deletion conflicts and drafts without known base fail closed',()=>{
 const base=snapshot({a:{x:0}}),draft=snapshot({a:{x:1}}),remote=snapshot({a:{x:2}});
 assert.throws(()=>mergeLocalCommit(base,draft,remote),/충돌/);
 assert.throws(()=>mergeLocalCommit(base,snapshot({}),remote),/충돌/);
 assert.throws(()=>mergeLocalCommit(undefined,draft,remote),/기준/);
 assert.equal(mergeLocalCommit(undefined,draft,undefined),draft);
});
test('repository identity ignores object key ordering and owner casing',()=>{
 assert.ok(sameRepository({owner:'Team',repo:'Repo',branch:'main',path:'a.json'},{path:'a.json',branch:'main',repo:'repo',owner:'team'}));
 assert.equal(sameRepository({owner:'a',repo:'b',branch:'main',path:'a.json'},{owner:'a',repo:'b',branch:'other',path:'a.json'}),false);
});
test('empty-repository drafts can be published successively and retries are idempotent',()=>{
 const base=snapshot({}),first=snapshot({a:{kind:'text',text:'one'}}),second=snapshot({a:{kind:'text',text:'two'},b:{kind:'shape'}});
 const published=mergeLocalCommit(base,first,base);
 const target={owner:'a',repo:'b',branch:'main',path:'a.json'};
 const previous=localCommitBase([{id:'first',createdAt:1,target,source:first}],target,base);
 assert.equal(previous,first);
 const next=mergeLocalCommit(previous,second,published);
 assert.equal(JSON.parse(next).items.a.text,'two');
 assert.ok(JSON.parse(next).items.b);
 assert.equal(mergeLocalCommit(previous,second,next),next);
});
