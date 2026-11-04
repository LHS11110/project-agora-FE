import {isRuntimeOnlyOperation} from '../runtime/sharedState.js';
import {canPeerAccessItem} from '../collaborativeSync.js';
export const WRITE_DENIED='이 그룹에는 쓰기 권한이 없습니다.';
export const EXECUTE_DENIED='이 그룹에는 실행 권한이 없습니다.';
export function canUseItem(item,identity,capability='write'){
 if(!identity)return true; // Isolated/legacy callers; live connections always install explicit capabilities.
 const groups=identity[capability==='write'?'write_groups':capability==='execute'?'execute_groups':'groups']||[];
 return canPeerAccessItem(item,{groups,is_admin:identity.is_admin===true,group_bits:identity.group_bits});
}
export function canUseCanvas(identity,capability='write'){
 return !identity||identity.is_admin===true||(identity[capability==='write'?'write_groups':capability==='execute'?'execute_groups':'groups']||[]).length>0;
}
export function assertAccessOperations(items,operations,identity){
 if(!identity)return;
 for(const operation of operations){
  const ids=operation.action==='translate'?operation.ids:[operation.id];
  for(const id of ids){
   const previous=items[id];
   const output=isRuntimeOnlyOperation(previous,operation);
   const capability=output?'execute':'write';
   if(previous&&!canUseItem(previous,identity,capability))throw new Error(output?EXECUTE_DENIED:WRITE_DENIED);
   if(operation.action==='create'&&!canUseItem(operation.patch,identity))throw new Error(WRITE_DENIED);
   if(operation.patch?.permission!==undefined&&!canUseItem({...previous,...operation.patch},identity))throw new Error(WRITE_DENIED);
  }
 }
}
