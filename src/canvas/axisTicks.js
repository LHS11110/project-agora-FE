import { CANVAS_SPACE } from './canvasSpace.js';
export const MAX_AXIS_TICKS = 256;
export function niceAxisStep(minimum) {
  if (!(minimum > 0) || !Number.isFinite(minimum)) return null;
  const power = 10 ** Math.floor(Math.log10(minimum));
  if (!power) return minimum;
  const fraction = minimum / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}
export function formatAxisValue(value) {
  if (!Number.isFinite(value)) return '';
  return String(Number(value.toPrecision(13))); // Drop binary rounding noise and negative zero.
}
function ticks(origin, length, scale, step, direction) {
  const spacing = step * scale;
  if (!Number.isFinite(origin) || !(spacing >= 1) || !Number.isFinite(spacing)) return [];
  const first = ((origin % spacing) + spacing) % spacing;
  const count = Math.min(MAX_AXIS_TICKS, Math.ceil(length / spacing) + 1);
  const result = [];
  for (let index = 0; index < count; index++) {
    const position = first + index * spacing;
    if (position < 18 || position > length - 42) continue;
    const multiple = Math.round((position - origin) / spacing);
    if (!multiple) continue; // The existing origin labels zero once.
    const value = multiple * step * direction;
    if (Number.isFinite(value)) result.push({position, value, label:formatAxisValue(value)});
  }
  return result;
}
export function axisOrigin(camera, width, height, space = CANVAS_SPACE) {
  const originX = space.width * camera.scale / 2 + camera.x;
  const originY = space.height * camera.scale / 2 + camera.y;
  // Align the one-pixel lines and both tick renderers to the same screen pixels.
  const pin = (origin, length) => Math.round(Math.max(8, Math.min(Math.max(8, length - 8), origin)));
  return { originX, originY, displayX: pin(originX, width), displayY: pin(originY, height) };
}

/**
 * Bounded by the viewport, independent of scene object count or world extent.
 * `forcedStep` lets an overscanned strip reuse the visible viewport's step, so the
 * labels drawn while moving match the ones shown once the camera settles.
 */
export function axisTickLayout(camera, viewport, space = CANVAS_SPACE, forcedStep = null) {
  const {scale,x,y} = camera;
  const width = Math.max(0, viewport.width), height = Math.max(0, viewport.height);
  const origin = axisOrigin(camera, width, height, space);
  const { originX, originY } = origin;
  if (!(scale > 0) || ![scale,x,y,width,height].every(Number.isFinite)) return {step:null,x:[],y:[],originX,originY};
  let step = niceAxisStep(80 / scale);
  if (!step || !Number.isFinite(step)) return {step:null,x:[],y:[],originX,originY};
  // Reserve enough screen space even for long labels after a distant pan. Measure the
  // labels that can actually appear (multiples of the step): raw edge coordinates such as
  // -54.99999375 during a zoom looked long and flipped the step between 5 and 10.
  const edgeLabel = value => formatAxisValue(Math.round(value / step) * step).length;
  const longest = Math.max(edgeLabel(-originX / scale), edgeLabel((width - originX) / scale));
  step = forcedStep > 0 ? forcedStep : niceAxisStep(Math.max(80,Math.min(220,longest*6+20)) / scale);
  if (!step || !Number.isFinite(step)) return {step:null,x:[],y:[],originX,originY};
  return {step,...origin,
    x:ticks(originX,width,scale,step,1),
    y:ticks(originY,height,scale,step,-1)};
}
