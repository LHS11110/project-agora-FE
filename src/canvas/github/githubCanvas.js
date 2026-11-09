import {REPOSITORY_FORMAT,splitCanvas,joinCanvas,repositoryPaths,repositoryJSON} from './canvasRepository.js';
const ROOT='https://api.github.com';
export const MAX_CANVAS_BYTES=8*1024*1024;
/** Accept a repository URL/clone URL as well as the separate GitHub names. */
export function normalizeRepositoryIdentity(owner='',repo=''){
 owner=typeof owner==='string'?owner.trim():'';repo=typeof repo==='string'?repo.trim():'';
 const parse=value=>{
  const ssh=value.match(/^git@github\.com:([^/]+)\/([^/]+?)\/?$/i);
  if(ssh)return [ssh[1],ssh[2].replace(/\.git$/i,'')];
  if(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i.test(value)){
   const url=new URL(/^https?:/i.test(value)?value:'https://'+value);
   const segments=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
   if(segments.length>2)throw new Error('저장소의 기본 URL을 입력해주세요. 예: https://github.com/octocat/Hello-World');
   return [segments[0]||'',(segments[1]||'').replace(/\.git$/i,'')];
  }
  if(/^[^/]+\/[^/]+\/?$/.test(value))return value.replace(/\/$/,'').split('/').map((s,i)=>i?s.replace(/\.git$/i,''):s);
  return null;
 };
 const ownerUrl=parse(owner),repoUrl=parse(repo);
 if(ownerUrl){owner=ownerUrl[0];if(!repo)repo=ownerUrl[1];}
 if(repoUrl){owner=repoUrl[0];repo=repoUrl[1];}
 return {owner:owner.replace(/^@/,'').toLowerCase(),repo:repo.toLowerCase()};
}
export function repositoryTarget({owner='',repo='',branch='',path=''}){
 ({owner,repo}=normalizeRepositoryIdentity(owner,repo));branch=branch.trim();path=path.trim();
 if(!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(owner)||! /^[a-z\d_.-]{1,100}$/i.test(repo)||['.','..'].includes(repo))throw new Error('GitHub 계정·조직명과 저장소 이름을 입력해주세요. 예: 소유자 octocat, 저장소 Hello-World');
 if(!path.endsWith('.json')||path.split('/').some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f\\?#]/.test(p)))throw new Error('저장 경로는 상대 경로의 JSON 파일이어야 합니다.');
 if(branch&&(/[\x00-\x20~^:?*\[\\]/.test(branch)||branch.includes('..')||branch.includes('@{')||branch.endsWith('/')||branch.endsWith('.')||branch.startsWith('/')))throw new Error('브랜치 이름을 확인해주세요.');
 return {owner,repo,branch,path};
}
export function encodeContent(text){
 const bytes=new TextEncoder().encode(text);if(bytes.length>MAX_CANVAS_BYTES)throw new Error('캔버스 코드는 8MiB 이하로 저장해주세요.');
 let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
}
export function decodeContent(content){
 const binary=atob(content.replace(/\s/g,''));return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
}
export function canvasSnapshot(manifest){
 if(manifest?.version!==1||!manifest.items||Array.isArray(manifest.items)||typeof manifest.items!=='object')throw new Error('올바른 캔버스 코드가 아닙니다.');
 const source=JSON.stringify({...manifest,mode:'replace',remove:[]},null,2)+'\n';
 if(new TextEncoder().encode(source).length>MAX_CANVAS_BYTES)throw new Error('캔버스 코드는 8MiB 이하로 저장해주세요.');return source;
}
export function githubCanvasClient(token,{signal,fetcher=fetch}={}){
 token=token.trim();if(!token)throw new Error('GitHub 토큰을 입력해주세요.');
 async function request(route,{method='GET',body,raw=false,missing=false}={}){
  const response=await fetcher(ROOT+route,{method,signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2026-03-10',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(missing&&response.status===404)return null;
  if(!response.ok){
   const messages={401:'GitHub 토큰이 만료되었거나 올바르지 않습니다.',403:'저장소 권한·브랜치 보호 규칙 또는 GitHub 요청 제한을 확인해주세요.',404:'저장소·브랜치 또는 파일에 접근할 수 없습니다.',409:'GitHub 파일이 변경되었습니다. 다시 연결해 최신 버전을 확인해주세요.',422:'파일 충돌·브랜치 또는 저장소 쓰기 규칙을 확인하고 다시 연결해주세요.'};
   const error=new Error(messages[response.status]||`GitHub 요청에 실패했습니다. (${response.status})`);error.status=response.status;error.service='github';throw error;
  }
  if(raw){const text=await response.text();if(new TextEncoder().encode(text).length>MAX_CANVAS_BYTES)throw new Error('8MiB 이하의 캔버스 파일만 불러올 수 있습니다.');return text;}
  if(response.status===204)return null;
  return response.json();
 }
 const base=t=>`/repos/${encodeURIComponent(t.owner)}/${encodeURIComponent(t.repo)}`;
 const file=t=>`${base(t)}/contents/${t.path.split('/').map(encodeURIComponent).join('/')}`;
 async function readRawFile(t,ref=t.branch){
  const route=file(t)+'?'+new URLSearchParams({ref});const data=await request(route,{missing:true});if(!data)return null;
  if(data.type!=='file'||data.size>MAX_CANVAS_BYTES)throw new Error('8MiB 이하의 캔버스 JSON 파일을 선택해주세요.');
  return {sha:data.sha,source:data.encoding==='base64'?decodeContent(data.content):await request(route,{raw:true})};
 }
 async function readFile(t,ref=t.branch){
  const root=await readRawFile(t,ref);if(!root)return null;
  const index=JSON.parse(root.source);if(index.format!==REPOSITORY_FORMAT)return root;
  const names=repositoryPaths(index,t.path),files={};let bytes=new TextEncoder().encode(root.source).length,cursor=0;
  await Promise.all(Array.from({length:Math.min(4,names.length)},async()=>{while(cursor<names.length){const name=names[cursor++],part=await readRawFile({...t,path:name},ref);if(!part)throw new Error('캔버스 분할 파일이 누락되었습니다.');bytes+=new TextEncoder().encode(part.source).length;if(bytes>MAX_CANVAS_BYTES)throw new Error('캔버스 코드는 8MiB 이하로 저장해주세요.');files[name]=part.source;}}));
  return {...root,source:canvasSnapshot(JSON.parse(joinCanvas(index,t.path,files))),files:{[t.path]:root.source,...files},split:true};
 }

 return {
  async connect(config){const t=repositoryTarget(config),repo=await request(base(t));if(!t.branch)t.branch=repo.default_branch;
   // A new repository has metadata but no branch until its first Contents commit.
   let revision=t.branch;try{const branch=await request(base(t)+'/branches/'+encodeURIComponent(t.branch));revision=branch.commit?.sha||t.branch;}
   catch(error){
    if(![404,409].includes(error.status))throw error;
    let branches;try{branches=await request(base(t)+'/branches?per_page=1');}catch(e){if(e.status===409&&repo.size===0)branches=[];else throw e;}
    if(branches.length)throw new Error('입력한 브랜치가 없습니다. 브랜치 이름을 확인하거나 기본 브랜치를 사용해주세요.');
    if(t.branch!==repo.default_branch)throw new Error('빈 저장소의 첫 커밋은 기본 브랜치에 생성합니다. 브랜치 입력을 비워주세요.');
    return {target:t,file:null,empty:true};
   }
   return {target:t,file:await readFile(t,revision),empty:false};
  },
  async branches(t){let result=[];for(let page=1;page<=2;page++){const entries=await request(base(t)+'/branches?'+new URLSearchParams({per_page:'100',page:String(page)}));result.push(...entries.map(e=>e.name));if(entries.length<100)break;}return result;},
  async createBranch(t,name){if(!name.trim())throw new Error('새 브랜치 이름을 입력해주세요.');repositoryTarget({...t,branch:name});const ref=await request(base(t)+'/git/ref/heads/'+encodeURIComponent(t.branch));return request(base(t)+'/git/refs',{method:'POST',body:{ref:'refs/heads/'+name,sha:ref.object.sha}});},
  async merge(t,head){repositoryTarget({...t,branch:head});if(head===t.branch)throw new Error('서로 다른 브랜치를 선택해주세요.');try{await request(base(t)+'/merges',{method:'POST',body:{base:t.branch,head,commit_message:`Merge ${head} into ${t.branch} (FreLog canvas)`}});}catch(e){if(e.status===409)throw new Error('병합 충돌이 있습니다. GitHub에서 충돌을 해결한 뒤 최신 커밋을 복구해주세요.');throw e;}return this.connect(t);},
  async pullRequest(t,{base:baseBranch,title,body=''}){repositoryTarget({...t,branch:baseBranch});if(!baseBranch||baseBranch===t.branch||!title.trim())throw new Error('PR의 대상 브랜치와 제목을 확인해주세요.');return request(base(t)+'/pulls',{method:'POST',body:{head:t.branch,base:baseBranch,title:title.trim(),body}});},
  async history(t,page=1){const data=await request(base(t)+'/commits?'+new URLSearchParams({sha:t.branch,path:t.path,per_page:'20',page:String(page)}));return data.map(c=>({sha:c.sha,message:c.commit.message,date:c.commit.author?.date,author:c.commit.author?.name}));},
  async graphHistory(t,page=1,{path}={}){
   const branch=await request(base(t)+'/branches/'+encodeURIComponent(t.branch));
   const data=await request(base(t)+'/commits?'+new URLSearchParams({sha:t.branch,per_page:'20',page:String(page),...(path?{path}:{})}));
   return {entries:data.map(c=>({sha:c.sha,message:c.commit.message,date:c.commit.author?.date,author:c.commit.author?.name,parents:(c.parents||[]).map(p=>p.sha),branches:[t.branch]})),refs:[{name:t.branch,sha:branch.commit?.sha||(page===1?data[0]?.sha:undefined)}],more:data.length===20};
  },
  async read(t,sha){if(!/^[a-f\d]{40,64}$/i.test(sha))throw new Error('올바른 커밋을 선택해주세요.');const result=await readFile(t,sha);if(!result)throw new Error('이 버전에는 캔버스 파일이 없습니다.');return result.source;},
  async commit(t,source,message,sha,{empty=false}={}){if(!message.trim())throw new Error('커밋 메시지를 입력해주세요.');return request(file(t),{method:'PUT',body:{message:message.trim(),content:encodeContent(source),...(!empty?{branch:t.branch}:{}),...(sha?{sha}:{})}});},
  async commitSplit(t,source,message,sha,{empty=false,baseSource}={}){
   if(!message.trim())throw new Error('커밋 메시지를 입력해주세요.');
   canvasSnapshot(JSON.parse(source));const files=splitCanvas(source,t.path);if(Object.values(files).reduce((sum,text)=>sum+new TextEncoder().encode(text).length,0)>MAX_CANVAS_BYTES)throw new Error('캔버스 코드는 8MiB 이하로 저장해주세요.');
   // Git's database API cannot initialize an empty repository. Bootstrap with a
   // complete legacy snapshot so even an interrupted migration remains readable.
   if(empty){const first=await request(file(t),{method:'PUT',body:{message:message.trim()+' (initialize)',content:encodeContent(source)}});sha=first.content.sha;baseSource=source;}
   const refRoute=base(t)+'/git/refs/heads/'+encodeURIComponent(t.branch);
   const ref=await request(base(t)+'/git/ref/heads/'+encodeURIComponent(t.branch)),head=ref.object.sha;
   const current=await readFile(t,head);
   if(current?.split&&baseSource===undefined)throw new Error('분할 파일의 최신 내용을 다시 검토한 뒤 커밋해주세요.');
   if((sha||null)!==(current?.sha||null)||(baseSource!==undefined&&repositoryJSON(JSON.parse(canvasSnapshot(JSON.parse(baseSource))))!==repositoryJSON(JSON.parse(canvasSnapshot(JSON.parse(current?.source||'null'))))))throw new Error('GitHub 파일이 변경되었습니다. 다시 연결해 최신 버전을 확인해주세요.');
   const parent=await request(base(t)+'/git/commits/'+head);
   const oldFiles=current?.files|| (current?{[t.path]:current.source}:{}),tree=[];
   for(const [path,content] of Object.entries(files))if(content!==oldFiles[path])tree.push({path,mode:'100644',type:'blob',content});
   for(const path of Object.keys(oldFiles))if(!Object.hasOwn(files,path))tree.push({path,mode:'100644',type:'blob',sha:null});
   if(!tree.length)return {content:{sha:current.sha},commit:{sha:head},file:current};
   const createdTree=await request(base(t)+'/git/trees',{method:'POST',body:{base_tree:parent.tree.sha,tree}});
   const commit=await request(base(t)+'/git/commits',{method:'POST',body:{message:message.trim(),tree:createdTree.sha,parents:[head]}});
   // Never force a ref: a concurrent update rejects this commit instead of losing it.
   await request(refRoute,{method:'PATCH',body:{sha:commit.sha,force:false}});
   const saved=await readFile(t,commit.sha);return {content:{sha:saved.sha},commit,file:saved};
  }
 };
}
