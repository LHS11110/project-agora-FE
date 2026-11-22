import { changeItems, changedItemIds, itemSnapshot } from './itemSnapshots.js';

// Each depth layer used to mount its own vector renderer. Only a few of them get
// a GPU slot; the rest each run a Canvas2D pass and move a composite canvas on
// every camera event, so a canvas with many reordered objects (one depth each)
// paid that cost hundreds of times per pan frame.
//
// Consecutive depths can share one vector renderer as long as nothing drawn
// above the vector canvas (ink canvases, the DOM world layer) sits between them.
// A group therefore ends at every depth that owns ink or persistent DOM objects,
// and at depth 0, which hosts live drawing drafts. Vectors inside a group are
// painted in depth order, so stacking is unchanged.
//
// Selection/editing DOM does not split groups: a selected vector object keeps its
// vector (with outline) and its DOM node is an interaction surface, so the split
// would only remount a renderer and re-rasterize its objects on every click.

const EMPTY = itemSnapshot({});
const canonicalIndex = (id) => String(Number(id) >>> 0) === id && Number(id) < 4294967295;
const numericIdCache = new WeakMap();

// Snapshot key order puts array-index ids first, which would break depth order
// once depths are merged; such layers stay on their own.
function hasIndexIds(snapshot) {
  if (!snapshot) return false;
  let known = numericIdCache.get(snapshot);
  if (known === undefined) {
    known = Object.keys(snapshot).some(canonicalIndex);
    numericIdCache.set(snapshot, known);
  }
  return known;
}

const isEmpty = (snapshot) => !snapshot || Object.keys(snapshot).length === 0;

/**
 * @param {Array<{depth:number, domObjects:Array, vectors:object, inkItems:object}>} depthLayers sorted by depth
 * @param {(id:string, item:object) => boolean} persistentDom whether a DOM object stays DOM without selection
 * @param {Map} cache merged-snapshot cache owned by the caller (one per scene)
 */
export function buildDepthRenderGroups(depthLayers, persistentDom, cache) {
  const groups = [];
  let run = [];
  const close = (key) => {
    if (!run.length) return;
    groups.push({ key, layers: run });
    run = [];
  };
  for (const layer of depthLayers) {
    const isolated = hasIndexIds(layer.vectors);
    if (isolated) close(`d${run.at(-1)?.depth}`);
    run.push(layer);
    const boundary = isolated || layer.depth === 0 || !isEmpty(layer.inkItems)
      || layer.domObjects.some(([id, item]) => persistentDom(String(id), item));
    if (boundary) close(`d${layer.depth}`);
  }
  close('top');

  const live = new Set();
  const result = groups.map(({ key, layers }) => {
    live.add(key);
    const last = layers.at(-1);
    const domObjects = layers.length === 1 ? last.domObjects : layers.flatMap((layer) => layer.domObjects);
    return {
      key,
      depths: layers.map((layer) => layer.depth),
      hasDepthZero: layers.some((layer) => layer.depth === 0),
      domObjects,
      // Only the closing depth can own ink (any earlier ink would have closed the group).
      inkItems: last.inkItems || EMPTY,
      vectors: layers.length === 1 ? (last.vectors || EMPTY) : mergeVectors(key, layers.map((layer) => layer.vectors || EMPTY), cache),
    };
  });
  for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);
  return result;
}

function mergeVectors(key, sources, cache) {
  const previous = cache.get(key);
  if (previous && previous.sources.length === sources.length && previous.sources.every((source, i) => source === sources[i])) {
    return previous.merged;
  }
  const merged = previous ? patchMerged(previous, sources) : null;
  const next = merged || itemSnapshot(Object.assign({}, ...sources.map((source) => Object.fromEntries(Object.entries(source)))));
  cache.set(key, { sources, merged: next });
  return next;
}

// Reuse the previous merged snapshot when the member depths are the same and
// edits only update, remove, or append at the top depth. A derived snapshot keeps
// changedItemIds() working, so the renderer refreshes only the edited objects.
function patchMerged(previous, sources) {
  if (previous.sources.length !== sources.length) return null;
  const changes = {}, removed = [];
  for (let i = 0; i < sources.length; i++) {
    const before = previous.sources[i], after = sources[i];
    if (before === after) continue;
    const ids = changedItemIds(before, after);
    if (!ids) return null;
    for (const id of ids) {
      const value = after[id];
      if (value == null) {
        if (!(id in previous.merged)) continue;
        // The id may have moved into another member depth in this same update.
        if (sources.some((source, j) => j !== i && source[id] != null)) return null;
        removed.push(id);
      } else {
        const known = id in previous.merged;
        // New ids may only append at the top depth; an id that moved between member
        // depths keeps its old slot in a patch, so rebuild to restore depth order.
        if (known ? before[id] == null : i !== sources.length - 1) return null;
        changes[id] = value;
      }
    }
  }
  return changeItems(previous.merged, changes, removed);
}
