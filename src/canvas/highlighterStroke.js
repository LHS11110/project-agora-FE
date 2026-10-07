function polygon(path, points) {
  // Keep every swept segment's winding identical, including at sharp turns.
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  const ordered = area < 0 ? points.slice().reverse() : points;
  ordered.forEach((point, i) => i ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
  path.closePath();
}

/** A flat nib perpendicular to travel sweeps connected, flat-ended polygons. */
export function addHighlighterToPath(path, points, width) {
  const radius = width / 2;
  if (points.length === 1) {
    const p = points[0], depth = Math.max(.5, width * .08);
    path.rect(p.x - depth / 2, p.y - radius, depth, width);
    return;
  }
  let previousNormal = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < .001) continue;
    const normal = { x: -(b.y - a.y) / length * radius, y: (b.x - a.x) / length * radius };
    const offset = (p, n, sign) => ({ x: p.x + n.x * sign, y: p.y + n.y * sign });
    polygon(path, [offset(a, normal, 1), offset(b, normal, 1), offset(b, normal, -1), offset(a, normal, -1)]);
    if (previousNormal) {
      polygon(path, [a, offset(a, previousNormal, 1), offset(a, normal, 1)]);
      polygon(path, [a, offset(a, previousNormal, -1), offset(a, normal, -1)]);
    }
    previousNormal = normal;
  }
}
