import { shapeStrokeWidth } from './shapeAppearance.js';
import { drawImagePreview } from './ImagePreviewCache.js';
import { objectBounds } from '../components/CanvasSpatialBTree.js';
import { drawVectorItems } from './drawVectorItems.js';
import { drawStroke } from './inkStrokeRenderer.js';
import { canvasGraphics } from './canvasGraphics.js';
import { objectShadow } from './objectShadow.js';
import { drawPlainText } from './plainTextRaster.js';
import { objectFontSize } from './objectSize.js';

const fields = ['__imagePreview','imageFrameEnabled','kind','shapeType','volumeStyle','vertexCount','cornerStyle','fillOpacity','sketchFillOpacity','width','height','color','fill','strokeEnabled','visualStyle','strokeWidth','startHead','endHead','headSize','bend','bendPoints','bendPointCount','from','to','fromPort','toPort','brush','opacity','simulatePressure','complete','text','fontSize','contentScale','contentScaleX','contentScaleY'];
const renderFields = [...fields,'x','y','rotation','points','shadowEnabled','shadowBlur','shadowOpacity','shadowOffsetX','shadowOffsetY','__selectionOutline'];
export const sameRasterInput = (a,b) => a === b || (a && b && renderFields.every(field => a[field] === b[field]));
export function rasterDescriptor(id, item, world, referenceItems, routeKey = '') {
  const local = Object.fromEntries(fields.filter(field => item[field] !== undefined).map(field => [field, item[field]]));
  let x = 0, y = 0, centerX = 0, centerY = 0;
  const rotation = item.kind === 'connector' ? 0 : Number(item.rotation) || 0;
  if (item.kind === 'shape' || item.kind === 'text') {
    x = (Number(item.x) || 0) * world.width; y = (Number(item.y) || 0) * world.height;
    local.x = 0; local.y = 0;
    centerX = (Number(item.width) || .14) * world.width / 2;
    centerY = (Number(item.height) || .12) * world.height / 2;
    if(item.kind==='text')local.fontSize=objectFontSize(item);
  } else if (item.kind === 'stroke') {
    const points = (item.points || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!points.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) { minX = Math.min(minX,p.x); minY = Math.min(minY,p.y); maxX = Math.max(maxX,p.x); maxY = Math.max(maxY,p.y); }
    x = minX * world.width; y = minY * world.height;
    centerX = (maxX - minX) * world.width / 2; centerY = (maxY - minY) * world.height / 2;
    local.points = points.map(p => ({ ...p, x: Number((p.x-minX).toFixed(8)), y: Number((p.y-minY).toFixed(8)) }));
  }
  local.rotation = item.kind === 'connector' ? item.rotation : 0;
  local.shadowEnabled = false;
  if(item.__selectionOutline)local.__selectionOutline=true;
  const shadow = objectShadow(item);
  // Standard shapes have no per-object randomness. Share their pixels regardless
  // of position/rotation; sketch strokes keep their object-specific seed.
  const seed = item.visualStyle === 'sketch' || item.kind === 'connector' ? id : '';
  // Inline uploads can contain megabytes of base64. The layer's scoped image
  // version identifies decoded pixels without copying source bytes into keys.
  const appearance = local.__imagePreview ? { ...local, __imagePreview: true } : local;
  const key = JSON.stringify([seed, appearance, shadow, world.width, world.height, ['connector','text'].includes(item.kind) || item.__imagePreview ? routeKey : '']);
  return { key, local, shadow, x, y, centerX, centerY, rotation };
}

export function rasterizeObject(id, descriptor, world, referenceItems, preferredRatio = 1, pixelBudget = 2_000_000, textAppearance = {}) {
  const bounds = objectBounds(descriptor.local, referenceItems, world.width, world.height);
  const { shadow } = descriptor;
  const borderPad = descriptor.local.kind === 'shape' && descriptor.local.strokeEnabled !== false ? Math.ceil(shapeStrokeWidth(descriptor.local) / 2) + 2 : 2;
  const pad = Math.max(descriptor.local.__selectionOutline ? 4 : 2, borderPad + (shadow.enabled ? Math.ceil(shadow.blur * 3 + Math.max(Math.abs(shadow.x), Math.abs(shadow.y))) : 0));
  const left = bounds.minX * world.width - pad, top = bounds.minY * world.height - pad;
  const width = Math.max(1, (bounds.maxX-bounds.minX)*world.width+pad*2);
  const height = Math.max(1, (bounds.maxY-bounds.minY)*world.height+pad*2);
  const ratio = Math.min(preferredRatio, 4096 / Math.max(width,height), Math.sqrt(pixelBudget / (width*height)));
  const raw = document.createElement('canvas');
  raw.width = Math.max(1,Math.ceil(width*ratio)); raw.height = Math.max(1,Math.ceil(height*ratio));
  const context = raw.getContext('2d');
  context.setTransform(ratio,0,0,ratio,-left*ratio,-top*ratio);
  if (descriptor.local.__imagePreview) drawImagePreview(context, descriptor.local, world, textAppearance.imagePreview);
  else if (descriptor.local.kind === 'text') drawPlainText(context,descriptor.local,world,textAppearance.font || 'serif',textAppearance.color || '#3c5144');
  else if (descriptor.local.kind === 'stroke') drawStroke(context,descriptor.local,world.width,world.height);
  else drawVectorItems(canvasGraphics(context),{[id]:descriptor.local},world.width,world.height,null,referenceItems);
  if(descriptor.local.__selectionOutline){
    context.globalAlpha=1;context.strokeStyle='#c28b43';context.lineWidth=1;
    context.strokeRect(bounds.minX*world.width-2.5,bounds.minY*world.height-2.5,
      (bounds.maxX-bounds.minX)*world.width+5,(bounds.maxY-bounds.minY)*world.height+5);
  }
  let canvas = raw;
  if (shadow.enabled && shadow.opacity > 0) {
    canvas = document.createElement('canvas'); canvas.width = raw.width; canvas.height = raw.height;
    const shaded = canvas.getContext('2d');
    shaded.filter = `drop-shadow(${shadow.x*ratio}px ${shadow.y*ratio}px ${shadow.blur*ratio}px rgba(24,34,43,${shadow.opacity}))`;
    shaded.drawImage(raw,0,0);
    raw.width = raw.height = 1;
  }
  // Preserve the sampling ratio after integer pixel rounding; otherwise the
  // sprite compresses glyphs and paper proportions at fractional zoom quality.
  return { canvas, width:canvas.width/ratio, height:canvas.height/ratio, left, top };
}

let gpuUsers = 0;
export function acquireGpuSlot() {
  if (gpuUsers >= 4) return null;
  gpuUsers++;
  let released = false;
  return () => { if (!released) { released = true; gpuUsers--; } };
}
