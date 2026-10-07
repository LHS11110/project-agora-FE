/** Smooth stylus pressure by distance, so event frequency does not set the response. */
export function penStrokePoints(points, stroke) {
  if (stroke.simulatePressure !== false || !points.length) return points;
  let pressure = points[0].pressure;
  return points.map((point, index) => {
    if (index) {
      const previous = points[index - 1];
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      pressure += (point.pressure - pressure) * (1 - Math.exp(-distance / 4));
    }
    return { ...point, pressure };
  });
}

/** A single closed outline keeps opacity and crossings consistent with saved ink. */
export function addPenOutline(path, outline) {
  if (!outline.length) return;
  const last = outline[outline.length - 1], first = outline[0];
  path.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  for (let index = 0; index < outline.length; index++) {
    const point = outline[index], next = outline[(index + 1) % outline.length];
    path.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
  }
  path.closePath();
}
