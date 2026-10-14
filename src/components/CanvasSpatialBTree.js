import { changedItemIds } from '../canvas/itemSnapshots.js';
import RBush from 'rbush';
import { objectShadow } from '../canvas/objectShadow.js';
import { connectorObjectSize } from '../canvas/connectors/objectMetrics.js';
import { CANVAS_SPACE } from '../canvas/canvasSpace.js';
import { strokePaintSize } from '../canvas/inkStroke.js';
import { connectorGeometry, OBJECT_SIZES } from './connectorGeometry.js';
import { shapeArrowGeometry } from './shapeArrowGeometry.js';

function rotatedBounds(bounds, rotation, viewportWidth, viewportHeight) {
  const degrees = Number(rotation);
  if (!Number.isFinite(degrees) || degrees === 0) return bounds;
  const centerX = (bounds.minX + bounds.maxX) / 2 * viewportWidth;
  const centerY = (bounds.minY + bounds.maxY) / 2 * viewportHeight;
  const angle = degrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const corners = [
    [bounds.minX * viewportWidth, bounds.minY * viewportHeight],
    [bounds.maxX * viewportWidth, bounds.minY * viewportHeight],
    [bounds.maxX * viewportWidth, bounds.maxY * viewportHeight],
    [bounds.minX * viewportWidth, bounds.maxY * viewportHeight],
  ].map(([x, y]) => {
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: centerX + dx * cosine - dy * sine,
      y: centerY + dx * sine + dy * cosine,
    };
  });
  return corners.reduce((rotated, point) => ({
    minX: Math.min(rotated.minX, point.x / viewportWidth),
    minY: Math.min(rotated.minY, point.y / viewportHeight),
    maxX: Math.max(rotated.maxX, point.x / viewportWidth),
    maxY: Math.max(rotated.maxY, point.y / viewportHeight),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function objectBounds(item, items, viewportWidth = 1, viewportHeight = 1) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  if (item?.kind === 'stroke' && Array.isArray(item.points) && item.points.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of item.points) {
      const x = (Number(point.x) || 0) * width;
      const y = (Number(point.y) || 0) * height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const pad = Math.max(2, strokePaintSize(item) / 2);
    const rotation = (Number(item.rotation) || 0) * Math.PI / 180;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const points = item.points.map((point) => {
      const dx = (Number(point.x) || 0) * width - centerX;
      const dy = (Number(point.y) || 0) * height - centerY;
      return { x: centerX + dx * cosine - dy * sine, y: centerY + dx * sine + dy * cosine };
    });
    const bounds = points.reduce((current, point) => ({
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    return { minX: (bounds.minX - pad) / width, minY: (bounds.minY - pad) / height,
      maxX: (bounds.maxX + pad) / width, maxY: (bounds.maxY + pad) / height };
  }

  if (item?.kind === 'connector') {
    const geometry = connectorGeometry(item, items, width, height);
    if (geometry?.points.length) {
      const pad = Math.max(8, (Number(item.strokeWidth) || 1.5) / 2 + 6);
      const points = [...geometry.points, ...(geometry.heads || []).flatMap((head) => head.points || [])];
      const bounds = points.reduce((current, point) => ({
        minX: Math.min(current.minX, point.x),
        minY: Math.min(current.minY, point.y),
        maxX: Math.max(current.maxX, point.x),
        maxY: Math.max(current.maxY, point.y),
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      return { minX: (bounds.minX - pad) / width, minY: (bounds.minY - pad) / height,
        maxX: (bounds.maxX + pad) / width, maxY: (bounds.maxY + pad) / height };
    }
  }

  if (item?.kind === 'connector') {
    const target = items?.[item.from] || items?.[item.to];
    if (target && target.kind !== 'connector') {
      const anchor = objectBounds(target, items, width, height);
      return { minX: anchor.minX, minY: anchor.maxY + .012, maxX: anchor.minX + .2, maxY: anchor.maxY + .06 };
    }
  }
  const [defaultWidth, defaultHeight] = OBJECT_SIZES[item?.kind] || [0.2, 0.12];
  const x = Number(item?.x) || 0;
  const y = Number(item?.y) || 0;
  const measured = connectorObjectSize(item);
  const objectWidth = measured ? measured.width / CANVAS_SPACE.width : Number(item?.width) || defaultWidth;
  const objectHeight = measured ? measured.height / CANVAS_SPACE.height : Number(item?.height) || defaultHeight;
  if (item?.kind === 'shape' && item.shapeType === 'arrow') {
    const geometry = shapeArrowGeometry(objectWidth * width, objectHeight * height, item.bend, item.startHead, item.endHead);
    const centerX = (x + objectWidth / 2) * width;
    const centerY = (y + objectHeight / 2) * height;
    const angle = (Number(item.rotation) || 0) * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const points = [...geometry.points, ...(geometry.heads || []).flatMap((head) => head.points || [])].map((point) => {
      const px = x * width + point.x;
      const py = y * height + point.y;
      const dx = px - centerX;
      const dy = py - centerY;
      return { x: centerX + dx * cosine - dy * sine, y: centerY + dx * sine + dy * cosine };
    });
    const padding = 2.5;
    const bounds = points.reduce((current, point) => ({
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    return {
      minX: (bounds.minX - padding) / width,
      minY: (bounds.minY - padding) / height,
      maxX: (bounds.maxX + padding) / width,
      maxY: (bounds.maxY + padding) / height,
    };
  }
  return rotatedBounds({ minX: x, minY: y, maxX: x + objectWidth, maxY: y + objectHeight }, item?.rotation, width, height);
}

// Keep the public query API while RBush incrementally updates changed rectangles.
const geometryFields = ['kind','type','x','y','width','height','rotation','shapeType','bend','bendPoints','startHead','endHead','strokeWidth','brush','simulatePressure','points','from','to'];
function geometryKey(item) {
  return geometryFields.map(field => item[field]);
}
function sameKey(a,b) { return a?.length === b.length && b.every((value,index) => value === a[index]); }
function paintedBounds(bounds,item,width,height) {
  const shadow = objectShadow(item);
  const blur = shadow.enabled && shadow.opacity > 0 ? shadow.blur * 3 : 0;
  // Include only the actual painted fringe, so edge shadows don't disappear.
  const fringe = item.kind === 'shape' ? Math.max(2,(Number(item.strokeWidth)||1.5)/2+2) : 2;
  return { minX: bounds.minX-(blur+fringe+Math.max(0,-shadow.x))/width,
    minY: bounds.minY-(blur+fringe+Math.max(0,-shadow.y))/height,
    maxX: bounds.maxX+(blur+fringe+Math.max(0,shadow.x))/width,
    maxY: bounds.maxY+(blur+fringe+Math.max(0,shadow.y))/height };
}

export default class CanvasSpatialBTree {
  constructor(items = {}, viewSize = { width: 1, height: 1 }, fanout = 12) {
    this.tree = new RBush(fanout);
    this.entries = new Map();
    this.connectorIds = new Set();
    this.stats = { updates:0, boundsCalculated:0, inserted:0, removed:0, queries:0 };
    this.update(items,viewSize);
  }
  update(items,viewSize,revision = 0,changedIds = null) {
    const width = Math.max(1,viewSize.width || 1), height = Math.max(1,viewSize.height || 1);
    if (items === this.items && width === this.width && height === this.height && revision === this.revision) return this;
    const resized = width !== this.width || height !== this.height;
    const remeasured = revision !== this.revision;
    const initial = !this.items;
    if(changedIds==null && !remeasured && this.items)changedIds=changedItemIds(this.items,items);
    const incremental = changedIds && !resized && !initial;
    const ids = incremental ? [...new Set(changedIds.map(String))] : Object.keys(items);
    let obstaclesChanged = resized || remeasured;
    const removals = incremental ? ids.map(id=>[id,this.entries.get(id)]).filter(([,entry])=>entry) : this.entries;
    for (const [id,entry] of removals) if (!Object.hasOwn(items,id) || !items[id] || items[id].type === 'chat_room') {
      this.tree.remove(entry); this.entries.delete(id); this.stats.removed++;
      this.connectorIds.delete(id);
      if (entry.item.kind !== 'connector') obstaclesChanged = true;
    }
    const pending = [];
    const affected=new Set(ids);
    const updateEntry = (id,item,force) => {
      const old = this.entries.get(id);
      affected.add(id);
      const measured = connectorObjectSize(item);
      if (!force && old?.item === item && measured?.width === old.measuredWidth && measured?.height === old.measuredHeight) return false;
      const key = geometryKey(item);
      const geometryChanged = force || !old || !sameKey(old.geometryKey,key)
        || measured?.width !== old.measuredWidth || measured?.height !== old.measuredHeight;
      const shadowKey = JSON.stringify(objectShadow(item));
      if (!geometryChanged && old.shadowKey === shadowKey) { old.item = item; return false; }
      try {
        const bounds = geometryChanged ? objectBounds(item,items,width,height) : old.bounds;
        if (geometryChanged) this.stats.boundsCalculated++;
        if (!Object.values(bounds).every(Number.isFinite) || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) throw Error('Invalid bounds');
        if (old) this.tree.remove(old);
        const entry = { id,item,bounds,...paintedBounds(bounds,item,width,height),geometryKey:key,shadowKey,
          measuredWidth:measured?.width,measuredHeight:measured?.height };
        this.entries.set(id,entry); pending.push(entry); this.stats.inserted++;
        return geometryChanged;
      } catch { if (old) { this.tree.remove(old); this.entries.delete(id); } return !!old; }
    };
    for (const id of ids) {
      const item=items[id];
      if(item?.kind==='connector')this.connectorIds.add(id);else this.connectorIds.delete(id);
      if (!item || item.type === 'chat_room' || item.kind === 'connector') continue;
      if (updateEntry(id,item,resized||remeasured)) obstaclesChanged = true;
    }
    // Routing depends on obstacles, so invalidate connectors only on geometry changes.
    for (const id of obstaclesChanged ? this.connectorIds : ids) if (items[id]?.kind === 'connector') updateEntry(id,items[id],obstaclesChanged);
    if (initial || pending.length > this.entries.size / 4) this.tree.load(pending);
    else for (const entry of pending) this.tree.insert(entry);
    this.items = items; this.width = width; this.height = height; this.revision = revision;
    this.stats.updates++;this.changedIds=incremental?[...affected]:null;
    return this;
  }
  query(bounds) { this.stats.queries++; return this.tree.search(bounds); }
}

export { objectBounds };
