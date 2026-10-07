import { getStrokePoints } from 'perfect-freehand';
import { inkStrokeSize } from './inkStroke.js';

/** Bristle tracks follow the same smoothed centerline and pressure as the brush. */
export function brushBristlePaths(points, stroke) {
  const size = inkStrokeSize(stroke.strokeWidth);
  const samples = getStrokePoints(points, { size, streamline: .15, last: stroke.complete !== false });
  const offsets = [-.8, -.58, -.31, -.08, .22, .49, .76];
  const paths = offsets.map(() => new Path2D());
  let pressure = .5;
  let normal = { x: 0, y: 1 };
  samples.forEach((sample, index) => {
    const [x, y] = sample.point;
    const next = samples[index + 1] || sample;
    const previous = samples[index - 1] || sample;
    const dx = next.point[0] - previous.point[0], dy = next.point[1] - previous.point[1];
    const length = Math.hypot(dx, dy);
    if (length > .001) normal = { x: -dy / length, y: dx / length };
    const target = stroke.simulatePressure === false ? sample.pressure
      : .75 - Math.min(1, sample.distance / Math.max(1, size)) * .65;
    pressure += (target - pressure) * .25;
    const radius = size / 2 * (.15 + .85 * Math.pow(pressure, .8));
    paths.forEach((path, bristle) => {
      const offset = offsets[bristle] * radius;
      const px = x + normal.x * offset, py = y + normal.y * offset;
      if (index) path.lineTo(px, py); else path.moveTo(px, py);
    });
  });
  return paths;
}

export function paintBrush(context, body, bristles, stroke, opacity) {
  // Clip to this stroke only: dry-brush tracks never paint outside its outline.
  context.globalAlpha = opacity * .72;
  context.fill(body, 'nonzero');
  context.save();
  context.clip(body, 'nonzero');
  context.globalAlpha = opacity * .3;
  context.lineWidth = Math.max(.25, inkStrokeSize(stroke.strokeWidth) * .045);
  context.lineCap = 'round'; context.lineJoin = 'round';
  for (const path of bristles) context.stroke(path);
  context.restore();
}
