import { shapeStrokeWidth } from './shapeAppearance.js';
import { shapeOutlinePaths } from './shapeGeometry.js';
import { shapeArrowGeometry } from '../components/shapeArrowGeometry.js';
import { itemDepth } from './itemDepth.js';
import { connectorGeometry } from '../components/connectorGeometry.js';
import { strokeSelectionGeometry } from './strokeSelection.js';
import { isRasterText } from './plainTextRaster.js';
import { isOverviewProxy } from './sceneRepresentation.js';

export const isVectorItem = item => ['shape', 'stroke', 'connector'].includes(item?.kind) || isRasterText(item);
export const needsVectorDom = (id, item, selected, editingId, connectionStartId, world = {width:1600,height:1000}, scale = 1) =>
  (!isVectorItem(item) && !isOverviewProxy(item,world,scale)) || selected.has(String(id)) || editingId === id || connectionStartId === id
  || (item.kind === 'connector' && Boolean(item.label));

function distance(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
  return Math.hypot(point.x-a.x-t*dx, point.y-a.y-t*dy);
}
function unrotate(point, cx, cy, degrees) {
  const angle = -(Number(degrees) || 0)*Math.PI/180, dx=point.x-cx, dy=point.y-cy;
  return {x:cx+dx*Math.cos(angle)-dy*Math.sin(angle), y:cy+dx*Math.sin(angle)+dy*Math.cos(angle)};
}

// Query only nearby bounds, then test the actual hit area. Shadows are not clickable.
export function hitTestVector(index, point, world, scale = 1, order = new Map(), representationScale = scale) {
  const pad = 10 / Math.max(.01, scale);
  const candidates = index.query({minX:point.x-pad/world.width, minY:point.y-pad/world.height,
    maxX:point.x+pad/world.width, maxY:point.y+pad/world.height});
  const pixel = {x:point.x*world.width, y:point.y*world.height};
  const hits = candidates.filter(({id, item}) => {
    if (!isVectorItem(item) && !isOverviewProxy(item,world,representationScale)) return false;
    if (item.kind === 'connector') {
      const geometry = connectorGeometry(item,index.items,world.width,world.height);
      return geometry?.points.some((p,i,points) => i && distance(pixel,points[i-1],p) <= pad)
        || [geometry?.start,geometry?.end].some(p=>p && Math.hypot(pixel.x-p.x,pixel.y-p.y)<=pad);
    }
    if (item.kind === 'stroke') {
      const geometry = strokeSelectionGeometry(item,world);
      if (!geometry) return false;
      const local = unrotate(pixel,geometry.x+geometry.width/2,geometry.y+geometry.height/2,item.rotation);
      local.x-=geometry.x;local.y-=geometry.y;
      return geometry.points.some((p,i,points)=>distance(local,i?points[i-1]:p,p)<=Math.max(pad,geometry.hitWidth/2));
    }
    const x=(Number(item.x)||0)*world.width,y=(Number(item.y)||0)*world.height;
    const w=(Number(item.width)||.14)*world.width,h=(Number(item.height)||.12)*world.height;
    const local=unrotate(pixel,x+w/2,y+h/2,item.rotation);
    if (item.kind === 'shape' && item.shapeType === 'arrow') {
      const geometry = shapeArrowGeometry(w, h, item.bend, item.startHead, item.endHead, item);
      const relative = { x: local.x - x, y: local.y - y };
      if (geometry.curvePoints.some((p, i, points) => i && distance(relative, points[i - 1], p) <= Math.max(pad, shapeStrokeWidth(item) / 2))
        || geometry.heads.some(head => head.points.some(p => Math.hypot(relative.x - p.x, relative.y - p.y) <= pad))) return true;
    }
    if (local.x>=x && local.x<=x+w && local.y>=y && local.y<=y+h) return true;
    if (item.kind === 'shape' && item.shapeType !== 'arrow' && item.strokeEnabled !== false) {
      const relative = { x: local.x - x, y: local.y - y };
      return shapeOutlinePaths(item.shapeType, w, h, item).some(path => path.some((p, i) => i && distance(relative, path[i - 1], p) <= shapeStrokeWidth(item) / 2));
    }
    return false;
  });
  hits.sort((a,b)=>itemDepth(b.item)-itemDepth(a.item)
    || (order.get(b.id) ?? b.bounds.minY)-(order.get(a.id) ?? a.bounds.minY));
  return hits[0] || null;
}
