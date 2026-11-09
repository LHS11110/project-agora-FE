// Stable, readable files keep content edits separate from object access memberships.
export const REPOSITORY_FORMAT='frelog.canvas.repository';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const repositoryJSON=value=>JSON.stringify(canonical(value),null,2)+'\n';
export function splitCanvas(source,path){
 const manifest=JSON.parse(source);if(manifest.version!==1||!object(manifest.items))throw new Error('올바른 캔버스 코드가 아닙니다.');
 const prefix=path.replace(/\.json$/,'')+'.parts/',groups=new Map(),permissions=Object.create(null);
 for(const [id,item] of Object.entries(manifest.items)){
  if(!object(item)||! /^[a-z][a-z0-9_-]{0,63}$/i.test(item.kind||''))throw new Error('객체 종류를 확인해주세요.');
  const {permission,...content}=item;if(!groups.has(item.kind))groups.set(item.kind,Object.create(null));groups.get(item.kind)[id]=content;
  if(Object.hasOwn(item,'permission'))permissions[id]=permission;
 }
 if(groups.size>127)throw new Error('객체 종류별 파일은 127개 이하로 저장해주세요.');
 const files={},objects={};
 for(const kind of [...groups.keys()].sort()){const name=prefix+'objects/'+kind+'.json';objects[kind]=name;files[name]=repositoryJSON({items:groups.get(kind)});}
 const permissionPath=prefix+'permissions.json';files[permissionPath]=repositoryJSON({permissions});
 const {items,version,mode,remove,...metadata}=manifest;
 files[path]=repositoryJSON({format:REPOSITORY_FORMAT,version:2,metadata,objects,permissions:permissionPath});
 return files;
}
export function repositoryPaths(index,path){
 if(index?.format!==REPOSITORY_FORMAT||index.version!==2||!object(index.objects)||!object(index.metadata)||typeof index.permissions!=='string')throw new Error('지원하지 않는 캔버스 저장 형식입니다.');
 const prefix=path.replace(/\.json$/,'')+'.parts/';
 const paths=[...Object.entries(index.objects).map(([kind,name])=>{if(!/^[a-z][a-z0-9_-]{0,63}$/i.test(kind)||name!==prefix+'objects/'+kind+'.json')throw new Error('캔버스 분할 파일 경로가 올바르지 않습니다.');return name;}),index.permissions];
 if(index.permissions!==prefix+'permissions.json'||new Set(paths).size!==paths.length||paths.length>128)throw new Error('캔버스 분할 파일 경로가 올바르지 않습니다.');return paths;
}
export function joinCanvas(index,path,files){
 repositoryPaths(index,path);const items={};
 for(const [kind,name] of Object.entries(index.objects)){
  const part=JSON.parse(files[name]);if(!object(part.items))throw new Error('객체 파일이 올바르지 않습니다.');
  for(const [id,item] of Object.entries(part.items)){if(Object.hasOwn(items,id)||!object(item)||item.kind!==kind||Object.hasOwn(item,'permission'))throw new Error('객체 파일이 중복되거나 종류가 올바르지 않습니다.');Object.defineProperty(items,id,{value:item,enumerable:true,writable:true,configurable:true});}
 }
 const acl=JSON.parse(files[index.permissions]);if(!object(acl.permissions))throw new Error('권한 파일이 올바르지 않습니다.');
 for(const [id,permission] of Object.entries(acl.permissions)){if(!Object.hasOwn(items,id))throw new Error('권한 파일이 없는 객체를 참조합니다.');items[id]={...items[id],permission};}
 return repositoryJSON({...index.metadata,version:1,mode:'replace',remove:[],items});
}
