import { getStrokePoints } from 'perfect-freehand';
import { inkStrokeSize } from './inkStroke.js';
import { freehandOptions } from './freehandOptions.js';

/** Bristle tracks follow the same smoothed centerline and pressure as the brush. */
export function brushBristlePaths(points, stroke) {
  const size = inkStrokeSize(stroke.strokeWidth);
  const samples = getStrokePoints(points, freehandOptions(stroke, size));
  const offsets = [-.45, 0, .45];
  const paths = offsets.map(() => new Path2D());
  let pressure = Math.max(.05, Math.min(1, samples[0]?.pressure ?? .5));
  let normal = { x: 0, y: 1 };
  samples.forEach((sample, index) => {
    const [x, y] = sample.point;
    const next = samples[index + 1] || sample;
    const previous = samples[index - 1] || sample;
    const dx = next.point[0] - previous.point[0], dy = next.point[1] - previous.point[1];
    const length = Math.hypot(dx, dy);
    if (length > .001) {
      const nx = -dy / length, ny = dx / length;
      normal = { x: normal.x * .65 + nx * .35, y: normal.y * .65 + ny * .35 };
      const norm = Math.hypot(normal.x, normal.y) || 1;
      normal = { x: normal.x / norm, y: normal.y / norm };
    }
    const target = stroke.simulatePressure === false ? sample.pressure
      : .75 - Math.min(1, sample.distance / Math.max(1, size)) * .65;
    pressure += (target - pressure) * .25;
    const radius = size / 2 * (.4 + .6 * pressure);
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
  context.globalAlpha = opacity * .94;
  context.fill(body, 'nonzero');
  context.save();
  context.clip(body, 'nonzero');
  context.globalAlpha = opacity * .05;
  context.lineWidth = Math.max(.2, inkStrokeSize(stroke.strokeWidth) * .025);
  context.lineCap = 'round'; context.lineJoin = 'round';
  for (const path of bristles) context.stroke(path);
  context.restore();
}
