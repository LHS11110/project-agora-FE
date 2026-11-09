import test from 'node:test';
import assert from 'node:assert/strict';
import {repositoryTarget,encodeContent,decodeContent,canvasSnapshot,githubCanvasClient} from '../src/canvas/github/githubCanvas.js';
const config={owner:'team',repo:'canvas',branch:'feature/canvas',path:'canvases/한글.canvas.json'};
const sha='a'.repeat(40);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('canvas snapshots round-trip UTF-8 with replace semantics and size validation',()=>{
 const source=canvasSnapshot({version:1,mode:'merge',items:{note:{kind:'note',text:'한글 😀'}}});
 assert.equal(decodeContent(encodeContent(source)),source);assert.equal(JSON.parse(source).mode,'replace');
 assert.throws(()=>canvasSnapshot({version:1,items:[]}),/올바른/);assert.throws(()=>encodeContent('a'.repeat(8*1024*1024+1)),/8MiB/);
});
test('repository paths and branch names cannot escape fixed API routes',()=>{
 assert.deepEqual(repositoryTarget(config),config);
 for(const path of ['../secret.json','/a.json','a//b.json','a.json?x=1','a.txt'])assert.throws(()=>repositoryTarget({...config,path}));
 for(const branch of ['../main','main?x','bad name'])assert.throws(()=>repositoryTarget({...config,branch}));
});
test('connect checks branch, creates missing file, and sends token only in authorization',async()=>{
 const calls=[];
 const client=githubCanvasClient('private-token',{fetcher:async(url,options)=>{calls.push({url,options});if(options.method==='PUT')return json({content:{sha},commit:{sha}});if(url.includes('/contents/'))return json({},404);if(url.includes('/branches/'))return json({name:'main'});return json({default_branch:'main'});}});
 const connection=await client.connect({...config,branch:''});assert.equal(connection.target.branch,'main');assert.equal(connection.file,null);
 await client.commit(connection.target,'한글','first');
 const put=calls.at(-1);assert.equal(put.options.headers.Authorization,'Bearer private-token');assert.equal(put.options.credentials,'omit');assert.equal(put.options.redirect,'error');assert.equal(put.url.includes('private-token'),false);
 const body=JSON.parse(put.options.body);assert.equal(body.sha,undefined);assert.equal(body.branch,'main');assert.equal(decodeContent(body.content),'한글');assert.match(put.url,/%ED%95%9C%EA%B8%80/);
});
test('existing file updates use its blob SHA, history is scoped to path and branch',async()=>{
 const calls=[];
 const client=githubCanvasClient('token',{fetcher:async(url,o)=>{calls.push({url,o});if(url.includes('/commits?'))return json([{sha,commit:{message:'message',author:{name:'Author',date:'2026-11-09'}}}]);if(url.includes('/contents/'))return json({type:'file',size:2,sha,encoding:'base64',content:encodeContent('{}')});return json({default_branch:'main'});}});
 const c=await client.connect(config);assert.equal(c.file.sha,sha);
 await client.commit(c.target,'{}','save',sha);assert.equal(JSON.parse(calls.at(-1).o.body).sha,sha);
 assert.equal((await client.history(c.target,2))[0].author,'Author');const url=new URL(calls.at(-1).url);assert.equal(url.searchParams.get('path'),config.path);assert.equal(url.searchParams.get('sha'),config.branch);assert.equal(url.searchParams.get('page'),'2');
});
test('conflicts and authentication errors do not retry or expose API responses',async()=>{
 for(const status of [401,403,409,422]){let count=0;const client=githubCanvasClient('token',{fetcher:async()=>{count++;return json({message:'secret-response'},status);}});await assert.rejects(()=>client.commit(config,'{}','commit',sha),e=>!e.message.includes('secret-response'));assert.equal(count,1);}
});
test('large contents use authenticated API raw response, historical reads require commit IDs',async()=>{
 const calls=[];const client=githubCanvasClient('token',{fetcher:async(url,o)=>{calls.push({url,o});return o.headers.Accept.includes('raw')?new Response('{"text":"한글"}'):json({type:'file',size:100,sha,encoding:'none'});}});
 assert.equal(await client.read(config,sha),'{"text":"한글"}');assert.equal(calls.length,2);assert.equal(calls[1].o.headers.Authorization,'Bearer token');await assert.rejects(()=>client.read(config,'main'),/커밋/);
});
test('branch creation uses a head reference and merge handles 204 without JSON parsing',async()=>{
 const calls=[];const client=githubCanvasClient('token',{fetcher:async(url,o)=>{calls.push({url,o});if(url.endsWith('/merges'))return new Response(null,{status:204});if(url.includes('/git/ref/heads/'))return json({object:{sha}});if(url.includes('/git/refs'))return json({ref:'refs/heads/feature'});if(url.includes('/contents/'))return json({type:'file',sha,size:2,encoding:'base64',content:encodeContent('{}')});return json({default_branch:'main'});}});
 await client.createBranch(config,'feature');assert.equal(JSON.parse(calls.at(-1).o.body).sha,sha);assert.equal(JSON.parse(calls.at(-1).o.body).ref,'refs/heads/feature');
 await client.merge(config,'feature');const merge=calls.find(c=>c.url.endsWith('/merges'));assert.deepEqual(JSON.parse(merge.o.body).base,config.branch);assert.equal(JSON.parse(merge.o.body).head,'feature');
});
test('repository URLs, clone URLs and owner/repo shorthand normalize to the GitHub identity',()=>{
 for(const repo of ['https://github.com/Octocat/Hello-World','https://github.com/Octocat/Hello-World.git/','github.com/Octocat/Hello-World','Octocat/Hello-World','git@github.com:Octocat/Hello-World.git']){
  const target=repositoryTarget({...config,owner:'',repo});assert.equal(target.owner,'octocat');assert.equal(target.repo,'hello-world');
 }
 assert.equal(repositoryTarget({...config,owner:'https://github.com/Octocat',repo:'Hello-World'}).owner,'octocat');
 assert.equal(repositoryTarget({...config,owner:'@Octocat',repo:'Hello-World'}).owner,'octocat');
 assert.equal(repositoryTarget({...config,owner:'https://github.com/Octocat/Hello-World',repo:''}).repo,'hello-world');
 assert.throws(()=>repositoryTarget({...config,owner:'캔버스 소유자 이름',repo:'Hello-World'}),/GitHub 계정/);
 assert.throws(()=>repositoryTarget({...config,repo:'https://other.invalid/a/b'}));
});
test('empty repositories connect without writes and initialize through the first explicit Contents commit',async()=>{
 const calls=[];const client=githubCanvasClient('token',{fetcher:async(url,o)=>{calls.push({url,o});if(o.method==='PUT')return json({content:{sha},commit:{sha}},201);if(url.includes('/branches/'))return json({},404);if(url.includes('/branches?'))return json([]);return json({default_branch:'main',size:0});}});
 const c=await client.connect({...config,branch:''});assert.equal(c.empty,true);assert.equal(c.file,null);assert.equal(c.target.branch,'main');assert.equal(calls.some(c=>c.o.method!=='GET'),false);
 await client.commit(c.target,'{}','first',undefined,{empty:true});const body=JSON.parse(calls.at(-1).o.body);assert.equal(body.branch,undefined);assert.equal(body.sha,undefined);
});
test('a missing branch in a nonempty repository is not mistaken for an empty repository',async()=>{
 const client=githubCanvasClient('token',{fetcher:async url=>url.includes('/branches/')?json({},404):url.includes('/branches?')?json([{name:'main'}]):json({default_branch:'main',size:0})});
 await assert.rejects(()=>client.connect({...config,branch:'typo'}),/브랜치가 없습니다/);
});
test('PR creation uses the configured repository and checks distinct base/head',async()=>{
 let call;const client=githubCanvasClient('token',{fetcher:async(url,o)=>{call={url,o};return json({number:17});}});
 const result=await client.pullRequest(config,{base:'main',title:'Canvas update',body:'Review'});assert.equal(result.number,17);assert.ok(call.url.endsWith('/pulls'));assert.deepEqual(JSON.parse(call.o.body),{head:config.branch,base:'main',title:'Canvas update',body:'Review'});
 await assert.rejects(()=>client.pullRequest(config,{base:config.branch,title:'x'}),/PR/);
});
test('graph history requests only the current branch and retains its merged ancestry',async()=>{
 const calls=[];const client=githubCanvasClient('token',{fetcher:async url=>{const u=new URL(url);calls.push(u);if(u.pathname.includes('/branches/'))return json({name:'main',commit:{sha}});assert.equal(u.searchParams.get('sha'),'main');return json([{sha,parents:[{sha:'c'.repeat(40)},{sha:'d'.repeat(40)}],commit:{message:'merge',author:{date:'2026-01-01',name:'User'}}}]);}});
 const result=await client.graphHistory({...config,branch:'main'},2);assert.deepEqual(result.refs,[{name:'main',sha}]);assert.equal(result.entries.length,1);assert.equal(result.entries[0].parents.length,2);assert.deepEqual(result.entries[0].branches,['main']);assert.equal(result.more,false);
 assert.equal(calls.length,2);assert.equal(calls.some(u=>u.pathname.endsWith('/branches')),false);const request=calls.find(u=>u.pathname.endsWith('/commits'));assert.equal(request.searchParams.has('path'),false);assert.equal(request.searchParams.get('page'),'2');
});

test('graph history file scope passes the selected shard path to GitHub',async()=>{const urls=[];const client=githubCanvasClient('token',{fetcher:async url=>{urls.push(new URL(url));return json(url.includes('/branches/')?{name:'main',commit:{sha}}:[]);}});await client.graphHistory({...config,branch:'main'},1,{path:'canvases/demo.parts/permissions.json'});assert.equal(urls.find(u=>u.pathname.endsWith('/commits')).searchParams.get('path'),'canvases/demo.parts/permissions.json');});

test('current branch pagination and file scope do not fetch independent feature histories',async()=>{const urls=[];const client=githubCanvasClient('token',{fetcher:async url=>{const u=new URL(url);urls.push(u);if(u.pathname.includes('/branches/'))return json({commit:{sha}});if(u.searchParams.get('sha')!=='feature/test2')throw new Error('Unexpected branch');return json(Array.from({length:20},(_,i)=>({sha:String(i),parents:[],commit:{message:'Current '+i}})));}});const result=await client.graphHistory({...config,branch:'feature/test2'},3,{path:'canvas.parts/permissions.json'});assert.equal(result.more,true);assert.deepEqual(result.refs,[{name:'feature/test2',sha}]);assert.ok(result.entries.every(e=>e.branches.length===1&&e.branches[0]==='feature/test2'));assert.equal(urls.length,2);assert.equal(urls[1].searchParams.get('path'),'canvas.parts/permissions.json');assert.equal(urls[1].searchParams.get('page'),'3');});
