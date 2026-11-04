import {isRuntimeOnlyOperation} from '../runtime/sharedState.js';
export const OBJECT_LOCK_MESSAGE = '잠긴 객체입니다. 잠금을 해제한 후 수정해주세요.';
export const isObjectLocked = item => item?.locked === true;
export const isLockOnlyOperation = operation => operation?.action === 'patch'
  && Object.keys(operation.patch || {}).length === 1 && typeof operation.patch.locked === 'boolean'
  && !(operation.unset || []).length;
// Walk only touched IDs; never scan a large canvas for each drawing frame.
export function assertObjectOperations(items, operations) {
  const states = new Map();
  for (const operation of operations) {
    const ids = operation.action === 'translate' ? operation.ids : [operation.id];
    for (const id of ids) {
      const locked = states.has(id) ? states.get(id) : isObjectLocked(items[id]);
      if (locked && !isRuntimeOnlyOperation(items[id],operation) && !(isLockOnlyOperation(operation) && operation.patch.locked === false)) throw new Error(OBJECT_LOCK_MESSAGE);
      if (operation.action === 'delete') states.set(id, false);
      else if (operation.patch && Object.hasOwn(operation.patch, 'locked')) states.set(id, operation.patch.locked === true);
    }
  }
}
