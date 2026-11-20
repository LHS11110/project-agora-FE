const metrics = new WeakMap();
const elementMetrics = new WeakMap();
const observedStates = new WeakMap();
let sharedResizeObserver = null;
let revision = 0, frame = null;
let dirtyIds=new Set(),unknown=false;
export const CONNECTOR_METRICS_EVENT = 'frelog:connector-metrics';
export const connectorMetricsRevision = () => revision;
// Which objects were remeasured after a revision, so a connector reroutes only
// when an endpoint or obstacle changed size. null: unknown (reroute).
const changeLog = []; let changeLogStart = 0;
export function connectorMetricsChangedIds(sinceRevision) {
  if (sinceRevision === revision) return [];
  if (sinceRevision < changeLogStart) return null;
  const ids = new Set();
  for (let i = changeLog.length - 1; i >= 0 && changeLog[i].revision > sinceRevision; i--) {
    if (changeLog[i].id == null) return null;
    ids.add(changeLog[i].id);
  }
  return [...ids];
}
export const connectorObjectSize = item => item && metrics.get(item);
export function inheritConnectorObjectSize(previous,next){
  const measured=previous && metrics.get(previous);
  if(measured && next && ['kind','imageFrameEnabled','width','height','fontSize','contentScale','contentScaleX','contentScaleY','text','code','formula'].every(key=>previous[key]===next[key]))metrics.set(next,measured);
}
export function measureConnectorObject(item, element, resizeEntry = null) {
  if (!element || !item || ['stroke', 'connector'].includes(item.kind)) return;
  const box = resizeEntry?.borderBoxSize?.[0];
  const width = box ? Math.round(box.inlineSize) : element.offsetWidth;
  const height = box ? Math.round(box.blockSize) : element.offsetHeight;
  if (!(width > 0 && height > 0)) return;
  const previous = metrics.get(item);
  if (previous?.width === width && previous?.height === height) return;
  metrics.set(item, { width, height });
  const measured=elementMetrics.get(element);
  // Moving creates a new immutable item, but doesn't change the DOM size.
  // Avoid invalidating the entire routing/index pipeline on every drag frame.
  if(measured?.width===width && measured?.height===height && Number(item.width)>0 && Number(item.height)>0)return;
  elementMetrics.set(element,{width,height});revision++;
  changeLog.push({ revision, id: element.dataset?.itemId ?? null });
  if (changeLog.length > 8192) { changeLog.splice(0, 4096); changeLogStart = changeLog[0].revision - 1; }
  if(element.dataset?.itemId)dirtyIds.add(element.dataset.itemId);else unknown=true;
  if (frame === null) frame = requestAnimationFrame(() => {
    frame=null;const event=new Event(CONNECTOR_METRICS_EVENT);event.changedItemIds=unknown?null:[...dirtyIds];
    dirtyIds=new Set();unknown=false;window.dispatchEvent(event);
  });
}

function ensureSharedResizeObserver() {
  if (sharedResizeObserver || typeof ResizeObserver !== 'function') return sharedResizeObserver;
  sharedResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const state = observedStates.get(entry.target);
      if (!state?.item) continue;
      measureConnectorObject(state.item, entry.target, entry);
    }
  });
  return sharedResizeObserver;
}

export function observeConnectorObject(element, item) {
  if (!element || !item || ['stroke', 'connector'].includes(item.kind)) return;
  const cached = elementMetrics.get(element);
  if (cached) metrics.set(item, cached);
  observedStates.set(element, { item });
  const observer = ensureSharedResizeObserver();
  if (observer) observer.observe(element);
  else measureConnectorObject(item, element);
}

export function updateConnectorObjectObservation(element, previousItem, nextItem) {
  if (!element || !nextItem || ['stroke', 'connector'].includes(nextItem.kind)) return;
  const state = observedStates.get(element);
  if (state) state.item = nextItem;
  else observedStates.set(element, { item: nextItem });
  inheritConnectorObjectSize(previousItem, nextItem);
  if (!metrics.has(nextItem)) {
    const cached = elementMetrics.get(element);
    if (cached) metrics.set(nextItem, cached);
  }
}

export function unobserveConnectorObject(element) {
  if (!element) return;
  observedStates.delete(element);
  sharedResizeObserver?.unobserve(element);
}
