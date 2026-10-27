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
/** Bounded by the viewport, independent of scene object count or world extent. */
export function axisTickLayout(camera, viewport, space = CANVAS_SPACE) {
  const {scale,x,y} = camera;
  const width = Math.max(0, viewport.width), height = Math.max(0, viewport.height);
  const originX = space.width * scale / 2 + x, originY = space.height * scale / 2 + y;
  if (!(scale > 0) || ![scale,x,y,width,height].every(Number.isFinite)) return {step:null,x:[],y:[],originX,originY};
  let step = niceAxisStep(80 / scale);
  if (!step || !Number.isFinite(step)) return {step:null,x:[],y:[],originX,originY};
  // Reserve enough screen space even for long labels after a distant pan.
  const longest = Math.max(formatAxisValue(-originX / scale).length,formatAxisValue((width-originX)/scale).length);
  step = niceAxisStep(Math.max(80,Math.min(220,longest*6+20)) / scale);
  if (!step || !Number.isFinite(step)) return {step:null,x:[],y:[],originX,originY};
  return {step,originX,originY,
    x:originY>=0&&originY<=height?ticks(originX,width,scale,step,1):[],
    y:originX>=0&&originX<=width?ticks(originY,height,scale,step,-1):[]};
}
