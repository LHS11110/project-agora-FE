const metrics = new WeakMap();
let revision = 0, frame = null;
export const CONNECTOR_METRICS_EVENT = 'frelog:connector-metrics';
export const connectorMetricsRevision = () => revision;
export const connectorObjectSize = item => item && metrics.get(item);
export function measureConnectorObject(item, element) {
  if (!element || ['stroke', 'connector'].includes(item.kind)) return;
  const width = element.offsetWidth, height = element.offsetHeight;
  if (!(width > 0 && height > 0)) return;
  const previous = metrics.get(item);
  if (previous?.width === width && previous?.height === height) return;
  metrics.set(item, { width, height }); revision++;
  if (frame === null) frame = requestAnimationFrame(() => {
    frame = null; window.dispatchEvent(new Event(CONNECTOR_METRICS_EVENT));
  });
}
