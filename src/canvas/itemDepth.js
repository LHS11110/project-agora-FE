import { isRasterText } from './plainTextRaster.js';
import { isOverviewProxy, overviewProxy } from './sceneRepresentation.js';
export const itemDepth = item => Number.isSafeInteger(Number(item?.depth)) ? Number(item.depth) : 0;

export function buildDepthLayers(entries, domTextIds = new Set(), world = {width:1600,height:1000}, scale = 1, selected = new Set()) {
  const layers = new Map([[0, { depth: 0, objects: [], vectors: {} }]]);
  for (const entry of entries) {
    const [id, item] = entry;
    const depth = itemDepth(item);
    if (!layers.has(depth)) layers.set(depth, { depth, objects: [], vectors: {} });
    const layer = layers.get(depth);
    layer.objects.push(entry);
    if ((!item?.runtimeRole && ['stroke', 'shape', 'connector'].includes(item?.kind)) || (isRasterText(item) && !domTextIds.has(String(id)))) layer.vectors[id] = item;
    else if(!domTextIds.has(String(id)) && isOverviewProxy(item,world,scale)) layer.vectors[id]=overviewProxy(item,world,scale);
    if(layer.vectors[id] && selected.has(String(id)) && !domTextIds.has(String(id)))layer.vectors[id]={...layer.vectors[id],__selectionOutline:true};
  }
  return [...layers.values()].sort((a, b) => a.depth - b.depth);
}
