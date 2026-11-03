export const MAX_CANVAS_GROUPS=64;
export const GROUP_READ=1,GROUP_WRITE=2,GROUP_EXECUTE=4;
const indexes=new WeakMap(),userMasks=new WeakMap(),groupLayouts=new WeakMap();
export function registerGroupLayout(groups,layout){if(Array.isArray(groups)&&layout)groupLayouts.set(groups,layout);}
export function groupCapabilityBits(policy){
 if(Number.isInteger(policy))return policy>=0&&policy<=7&&(policy&GROUP_READ)?policy:0;
 return policy?.read===true?GROUP_READ|(policy.write===true?GROUP_WRITE:0)|(policy.execute===true?GROUP_EXECUTE:0):0;
}
export function compileGroupBits(layout){
 if(!layout||typeof layout!=='object'||Array.isArray(layout))return null;
 if(indexes.has(layout))return indexes.get(layout);
 const entries=Object.entries(layout),bits=new Map();let used=0n;
 if(!entries.length||entries.length>64){indexes.set(layout,null);return null;}
 for(const [name,index] of entries){
  if(!Number.isInteger(index)||index<0||index>=64){indexes.set(layout,null);return null;}
  const bit=1n<<BigInt(index);if(used&bit){indexes.set(layout,null);return null;}bits.set(name,bit);used|=bit;
 }
 const index={bits,objects:new WeakMap(),permissions:new WeakMap()};indexes.set(layout,index);return index;
}
export function groupMask(permission,index){
 if(!index)return 0n;
 if(typeof permission==='string')return index.bits.get(permission)||0n;
 if(!permission||typeof permission!=='object')return 0n;
 if(index.permissions.has(permission))return index.permissions.get(permission);
 const names=Array.isArray(permission)?permission:Object.entries(permission).filter(([,level])=>Number(level)>0).map(([name])=>name);
 let mask=0n;for(const name of names)mask|=index.bits.get(name)||0n;
 index.permissions.set(permission,mask);return mask;
}
export function groupMaskHex(permission,index){return groupMask(permission,index).toString(16).padStart(16,'0');}
export function canAccessGroupBits(item,identity,capability='read'){
 if(identity?.is_admin===true)return true;
 const groups=identity?.[capability==='write'?'write_groups':capability==='execute'?'execute_groups':'groups']||[];
 const index=compileGroupBits(identity?.group_bits||groupLayouts.get(groups));if(!index)return null;
 let userMask;
 if(groups&&typeof groups==='object'){
  let cache=userMasks.get(groups);if(!cache){cache=new WeakMap();userMasks.set(groups,cache);}
  if(cache.has(index))userMask=cache.get(index);else{userMask=groupMask(groups,index);cache.set(index,userMask);}
 }else userMask=0n;
 let objectMask;
 if(item&&typeof item==='object'){
  const cached=index.objects.get(item);
  if(cached?.permission===item.permission)objectMask=cached.mask;
  else{objectMask=groupMask(item.permission,index);index.objects.set(item,{permission:item.permission,mask:objectMask});}
 }else objectMask=0n;
 return (userMask&objectMask)!==0n;
}
