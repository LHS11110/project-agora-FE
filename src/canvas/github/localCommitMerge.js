import {canvasSnapshot} from './githubCanvas.js';
import {repositoryJSON} from './canvasRepository.js';
export const sameRepository=(a,b)=>!!a&&!!b&&a.owner.toLowerCase()===b.owner.toLowerCase()&&a.repo.toLowerCase()===b.repo.toLowerCase()&&a.branch===b.branch&&a.path===b.path;
export function localCommitBase(drafts,target,fallback){
 return [...drafts].filter(draft=>sameRepository(draft.target,target)).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id))[0]?.source??fallback;
}
// Reapply a draft's changes to the latest snapshot. Preserve unrelated remote
// edits, but never silently overwrite a change to the same field.
export function mergeLocalCommit(base,source,current){
 if(base===undefined){if(current===undefined)return source;throw Error('기준 버전이 없는 로컬 커밋입니다. 최신 캔버스를 다시 검토해주세요.');}
 const parse=text=>JSON.parse(canvasSnapshot(JSON.parse(text)));
 const before=parse(base),draft=parse(source),remote=current===undefined?undefined:parse(current);
 const equal=(a,b)=>a===undefined||b===undefined?a===b:repositoryJSON(a)===repositoryJSON(b);
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function merge(a,b,c,path){
  if(equal(a,b)||equal(b,c))return c;
  if(equal(a,c))return b;
  if(object(a)&&object(b)&&object(c)){
   const result=Object.create(null);
   for(const key of new Set([...Object.keys(a),...Object.keys(b),...Object.keys(c)])){
    const value=merge(a[key],b[key],c[key],`${path}.${key}`);
    if(value!==undefined)result[key]=value;
   }
   return result;
  }
  throw Error(`로컬 커밋과 GitHub 변경이 충돌합니다 (${path}). 최신 버전을 검토해주세요.`);
 }
 return canvasSnapshot(merge(before,draft,remote,'canvas'));
}
