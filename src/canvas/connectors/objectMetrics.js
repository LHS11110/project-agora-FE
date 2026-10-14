const metrics = new WeakMap();
const elementMetrics = new WeakMap();
let revision = 0, frame = null;
let dirtyIds=new Set(),unknown=false;
export const CONNECTOR_METRICS_EVENT = 'frelog:connector-metrics';
export const connectorMetricsRevision = () => revision;
export const connectorObjectSize = item => item && metrics.get(item);
export function inheritConnectorObjectSize(previous,next){
  const measured=previous && metrics.get(previous);
  if(measured && next && ['kind','width','height','fontSize','contentScale','contentScaleX','contentScaleY','text','code','formula'].every(key=>previous[key]===next[key]))metrics.set(next,measured);
}
export function measureConnectorObject(item, element) {
  if (!element || ['stroke', 'connector'].includes(item.kind)) return;
  const width = element.offsetWidth, height = element.offsetHeight;
  if (!(width > 0 && height > 0)) return;
  const previous = metrics.get(item);
  if (previous?.width === width && previous?.height === height) return;
  metrics.set(item, { width, height });
  const measured=elementMetrics.get(element);
  // Moving creates a new immutable item, but doesn't change the DOM size.
  // Avoid invalidating the entire routing/index pipeline on every drag frame.
  if(measured?.width===width && measured?.height===height && Number(item.width)>0 && Number(item.height)>0)return;
  elementMetrics.set(element,{width,height});revision++;
  if(element.dataset?.itemId)dirtyIds.add(element.dataset.itemId);else unknown=true;
  if (frame === null) frame = requestAnimationFrame(() => {
    frame=null;const event=new Event(CONNECTOR_METRICS_EVENT);event.changedItemIds=unknown?null:[...dirtyIds];
    dirtyIds=new Set();unknown=false;window.dispatchEvent(event);
  });
}
