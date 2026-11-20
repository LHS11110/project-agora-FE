import { getStrokePoints } from 'perfect-freehand';
import { inkStrokeSize } from './inkStroke.js';
import { freehandOptions } from './freehandOptions.js';

/** Bristle tracks follow the same smoothed centerline and pressure as the brush. */
export function brushBristlePaths(points, stroke, createPath = () => new Path2D()) {
  const size = inkStrokeSize(stroke.strokeWidth);
  const samples = getStrokePoints(points, freehandOptions(stroke, size));
  const offsets = [-.45, 0, .45];
  const tracks = offsets.map(() => []);
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
    tracks.forEach((track, bristle) => {
      const offset = offsets[bristle] * radius;
      track.push([x + normal.x * offset, y + normal.y * offset]);
    });
  });
  return tracks.map((track) => {
    const path = createPath();
    if (!track.length) return path;
    path.moveTo(track[0][0], track[0][1]);
    if (track.length === 2) {
      path.lineTo(track[1][0], track[1][1]);
    } else if (track.length > 2) {
      for (let i = 1; i < track.length - 1; i++) {
        const mx = (track[i][0] + track[i + 1][0]) / 2;
        const my = (track[i][1] + track[i + 1][1]) / 2;
        path.quadraticCurveTo(track[i][0], track[i][1], mx, my);
      }
      const last = track[track.length - 1];
      path.lineTo(last[0], last[1]);
    }
    return path;
  });
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
