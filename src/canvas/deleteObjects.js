import { OBJECT_LOCK_MESSAGE, isObjectLocked } from './locks/objectLock.js';
import { WRITE_DENIED } from './permissions/access.js';

function addMapSet(map, key, value) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

function collectDeletionIndexes(items, targets) {
  let needsFrames = false;
  let needsProjects = false;
  for (const id of targets) {
    const kind = items[id]?.kind;
    if (kind === 'frame') needsFrames = true;
    else if (kind === 'project') needsProjects = true;
    if (needsFrames && needsProjects) break;
  }

  const connectorsByTarget = new Map();
  const frameMembers = needsFrames ? new Map() : null;
  const issuesByBoard = needsProjects ? new Map() : null;
  const issuesByParent = needsProjects ? new Map() : null;
  const issuesByDep = needsProjects ? new Map() : null;

  for (const [key, item] of Object.entries(items)) {
    if (!item || typeof item !== 'object') continue;
    if (item.kind === 'connector') {
      if (item.from != null) addMapSet(connectorsByTarget, String(item.from), key);
      if (item.to != null) addMapSet(connectorsByTarget, String(item.to), key);
    }
    if (frameMembers && item.frameId != null) {
      addMapSet(frameMembers, String(item.frameId), key);
    }
    if (issuesByBoard && item.kind === 'project' && item.projectType === 'issue') {
      if (item.projectBoard != null) addMapSet(issuesByBoard, String(item.projectBoard), key);
      if (item.projectParent != null) addMapSet(issuesByParent, String(item.projectParent), key);
      for (const dep of item.projectDependencies || []) {
        if (dep != null) addMapSet(issuesByDep, String(dep), key);
      }
    }
  }

  return { connectorsByTarget, frameMembers, issuesByBoard, issuesByParent, issuesByDep };
}

function collectAttachedConnectors(nodeIds, connectorsByTarget, items, removedSet, checkItem) {
  const attached = [];
  const seen = new Set();
  for (const nodeId of nodeIds) {
    for (const connectorId of connectorsByTarget.get(nodeId) || []) {
      if (removedSet.has(connectorId) || seen.has(connectorId)) continue;
      seen.add(connectorId);
      const connector = items[connectorId];
      if (!connector) continue;
      const denial = checkItem(connector);
      if (denial) return { ok: false, connectors: [], message: denial };
      attached.push(connectorId);
    }
  }
  return { ok: true, connectors: attached, message: '' };
}

/**
 * Plan an O(N) atomic batch deletion preserving locks, ACLs, frame memberships,
 * notebook cells, project dependencies, and attached connectors.
 */
export function planBatchDeletion(
  items = {},
  targetIds = [],
  {
    canWriteItem = () => true,
    isLocked = isObjectLocked,
    canAdmin = () => false,
    portfolioId = 'portfolio-settings',
  } = {},
) {
  const targets = [];
  const targetSet = new Set();
  for (const rawId of targetIds || []) {
    if (rawId == null) continue;
    const id = String(rawId);
    if (targetSet.has(id)) continue;
    targetSet.add(id);
    targets.push(id);
  }
  if (!targets.length) {
    return { changes: {}, removed: [], remaining: [], deniedMessage: '' };
  }

  const indexes = collectDeletionIndexes(items, targets);
  const removedSet = new Set();
  const changes = Object.create(null);
  const remaining = [];
  let deniedMessage = '';

  const recordDenied = (message) => {
    if (!deniedMessage && message) deniedMessage = message;
  };
  const denialFor = (item) => {
    if (item && !canWriteItem(item)) return WRITE_DENIED;
    if (isLocked(item)) return OBJECT_LOCK_MESSAGE;
    return '';
  };
  const getCurrent = (id) => (Object.hasOwn(changes, id) ? changes[id] : items[id]);
  const commit = (localRemoved, localChanges = null) => {
    for (const key of localRemoved) {
      removedSet.add(key);
      delete changes[key];
    }
    if (localChanges) {
      for (const [key, value] of Object.entries(localChanges)) {
        if (!removedSet.has(key)) changes[key] = value;
      }
    }
  };

  for (const id of targets) {
    if (removedSet.has(id)) continue;
    if (!Object.hasOwn(items, id) || !items[id]) continue;
    const previous = getCurrent(id);
    if (!previous || previous.type === 'chat_room') continue;

    if (previous.kind === 'frame') {
      const frameDenial = denialFor(previous);
      if (frameDenial) {
        recordDenied(frameDenial);
        remaining.push(id);
        continue;
      }
      const localChanges = {};
      let failed = false;
      for (const memberId of indexes.frameMembers?.get(id) || []) {
        if (removedSet.has(memberId)) continue;
        const member = getCurrent(memberId);
        if (!member) continue;
        if (!canWriteItem(member) || isLocked(member)) {
          recordDenied(WRITE_DENIED);
          failed = true;
          break;
        }
        const next = { ...member };
        delete next.frameId;
        localChanges[memberId] = next;
      }
      if (failed) {
        remaining.push(id);
        continue;
      }
      const connectors = collectAttachedConnectors([id], indexes.connectorsByTarget, items, removedSet, denialFor);
      if (!connectors.ok) {
        recordDenied(WRITE_DENIED);
        remaining.push(id);
        continue;
      }
      const meta = getCurrent(portfolioId);
      if (meta?.portfolioCursor?.frameId === id) {
        const metaDenial = denialFor(meta);
        if (metaDenial) {
          recordDenied(metaDenial);
          remaining.push(id);
          continue;
        }
        const nextMeta = { ...meta };
        delete nextMeta.portfolioCursor;
        localChanges[portfolioId] = nextMeta;
      }
      commit([id, ...connectors.connectors], localChanges);
      continue;
    }

    if (previous.kind === 'project') {
      if (previous.projectType === 'board' && !canAdmin()) {
        remaining.push(id);
        continue;
      }
      const localRemovedSet = new Set([id]);
      const queue = [id];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const currentId = queue[cursor];
        for (const childMap of [indexes.issuesByBoard, indexes.issuesByParent]) {
          for (const childId of childMap?.get(currentId) || []) {
            if (!removedSet.has(childId) && !localRemovedSet.has(childId)) {
              localRemovedSet.add(childId);
              queue.push(childId);
            }
          }
        }
      }
      const localChanges = {};
      for (const removedId of localRemovedSet) {
        for (const holderId of indexes.issuesByDep?.get(removedId) || []) {
          if (removedSet.has(holderId) || localRemovedSet.has(holderId) || Object.hasOwn(localChanges, holderId)) continue;
          const holder = getCurrent(holderId);
          if (!holder?.projectDependencies?.length) continue;
          localChanges[holderId] = {
            ...holder,
            projectDependencies: holder.projectDependencies.filter(
              (dep) => !removedSet.has(String(dep)) && !localRemovedSet.has(String(dep)),
            ),
          };
        }
      }
      const projectMsg = '연결된 작업의 쓰기 권한과 잠금 상태를 확인해주세요.';
      let failed = false;
      for (const key of [...localRemovedSet, ...Object.keys(localChanges)]) {
        const obj = getCurrent(key);
        if (obj && (!canWriteItem(obj) || isLocked(obj))) {
          recordDenied(projectMsg);
          failed = true;
          break;
        }
      }
      if (failed) {
        remaining.push(id);
        continue;
      }
      const connectors = collectAttachedConnectors(
        localRemovedSet,
        indexes.connectorsByTarget,
        items,
        removedSet,
        (conn) => (!canWriteItem(conn) || isLocked(conn) ? projectMsg : ''),
      );
      if (!connectors.ok) {
        recordDenied(connectors.message);
        remaining.push(id);
        continue;
      }
      for (const connId of connectors.connectors) localRemovedSet.add(connId);
      commit(localRemovedSet, localChanges);
      continue;
    }

    if (previous.runtimeRole === 'notebook' || previous.runtimeRole === 'notebook-cell') {
      const rootId = previous.runtimeRole === 'notebook' ? id : String(previous.notebookId);
      const root = getCurrent(rootId);
      const localRemovedSet = new Set([id]);
      const localChanges = {};
      if (previous.runtimeRole === 'notebook') {
        for (const childId of root?.notebookCellIds || []) {
          const childKey = String(childId);
          if (!removedSet.has(childKey)) localRemovedSet.add(childKey);
        }
      } else if (root?.runtimeRole === 'notebook' && !removedSet.has(rootId)) {
        localChanges[rootId] = {
          ...root,
          notebookCellIds: (root.notebookCellIds || []).filter((childId) => String(childId) !== id),
        };
      }
      let failed = false;
      for (const key of [...localRemovedSet, ...Object.keys(localChanges)]) {
        const obj = getCurrent(key);
        if (obj && (!canWriteItem(obj) || isLocked(obj))) {
          recordDenied(WRITE_DENIED);
          failed = true;
          break;
        }
      }
      if (failed) {
        remaining.push(id);
        continue;
      }
      const connectors = collectAttachedConnectors(
        localRemovedSet,
        indexes.connectorsByTarget,
        items,
        removedSet,
        (conn) => (!canWriteItem(conn) || isLocked(conn) ? OBJECT_LOCK_MESSAGE : ''),
      );
      if (!connectors.ok) {
        recordDenied(connectors.message);
        remaining.push(id);
        continue;
      }
      for (const connId of connectors.connectors) localRemovedSet.add(connId);
      commit(localRemovedSet, localChanges);
      continue;
    }

    const itemDenial = denialFor(previous);
    if (itemDenial) {
      recordDenied(itemDenial);
      remaining.push(id);
      continue;
    }
    const connectors = collectAttachedConnectors(
      [id],
      indexes.connectorsByTarget,
      items,
      removedSet,
      (conn) => {
        if (!canWriteItem(conn)) return WRITE_DENIED;
        if (isLocked(conn)) return OBJECT_LOCK_MESSAGE;
        return '';
      },
    );
    if (!connectors.ok) {
      recordDenied(connectors.message);
      remaining.push(id);
      continue;
    }
    commit([id, ...connectors.connectors]);
  }

  return {
    changes: Object.fromEntries(Object.entries(changes)),
    removed: [...removedSet],
    remaining,
    deniedMessage,
  };
}
