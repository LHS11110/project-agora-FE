const close = points => [...points, { ...points[0] }];
function arc(cx, cy, rx, ry, start = 0, end = Math.PI * 2, count = 64) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = start + (end - start) * index / count;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}
function curvedOutline(start, curves) {
  const points = [{ x: start[0], y: start[1] }];
  for (const [cx1, cy1, cx2, cy2, x, y] of curves) {
    const from = points[points.length - 1];
    for (let index = 1; index <= 20; index += 1) {
      const t = index / 20, u = 1 - t;
      points.push({ x: u ** 3 * from.x + 3 * u ** 2 * t * cx1 + 3 * u * t ** 2 * cx2 + t ** 3 * x,
        y: u ** 3 * from.y + 3 * u ** 2 * t * cy1 + 3 * u * t ** 2 * cy2 + t ** 3 * y });
    }
  }
  return close(points);
}
function polygon(sides, star = false) {
  const points = Array.from({ length: star ? sides * 2 : sides }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / (star ? sides * 2 : sides);
    const radius = star && index % 2 ? 0.22 : 0.5;
    return { x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius };
  });
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return close(points.map(p => ({ x: (p.x - minX) / (maxX - minX), y: (p.y - minY) / (maxY - minY) })));
}

/** Shared contours for vector rendering, picker previews and connector anchors. */
export function shapeOutlinePaths(type, width, height) {
  const points = values => close(values.map(([x, y]) => ({ x: x * width, y: y * height })));
  const scale = path => path.map(p => ({ x: p.x * width, y: p.y * height }));
  if (type === 'circle') return [arc(width / 2, height / 2, Math.min(width, height) / 2, Math.min(width, height) / 2)];
  if (type === 'ellipse') return [arc(width / 2, height / 2, width / 2, height / 2)];
  if (type === 'square') {
    const side = Math.min(width, height), x = (width - side) / 2, y = (height - side) / 2;
    return [close([{ x, y }, { x: x + side, y }, { x: x + side, y: y + side }, { x, y: y + side }])];
  }
  if (type === 'triangle') return [points([[0.5, 0], [1, 1], [0, 1]])];
  if (type === 'diamond') return [points([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]])];
  if (type === 'pentagon' || type === 'hexagon' || type === 'star') return [scale(polygon(type === 'hexagon' ? 6 : 5, type === 'star'))];
  if (type === 'trapezoid') return [points([[0.22, 0], [0.78, 0], [1, 1], [0, 1]])];
  if (type === 'semicircle') return [close(arc(width / 2, height, width / 2, height, Math.PI, Math.PI * 2))];
  if (type === 'cylinder') return [
    [{ x: 0, y: height * 0.15 }, { x: 0, y: height * 0.85 }, ...arc(width / 2, height * 0.85, width / 2, height * 0.15, Math.PI, 0, 32), { x: width, y: height * 0.15 }],
    arc(width / 2, height * 0.15, width / 2, height * 0.15),
  ];
  if (type === 'cloud') return [scale(curvedOutline([0.23, 0.85], [
    [0.04, 0.85, 0, 0.7, 0.08, 0.58], [0.01, 0.38, 0.18, 0.22, 0.35, 0.3],
    [0.37, 0.03, 0.68, 0.03, 0.73, 0.29], [0.9, 0.22, 1, 0.4, 0.93, 0.55],
    [1, 0.67, 0.96, 0.85, 0.79, 0.85], [0.6, 0.85, 0.4, 0.85, 0.23, 0.85],
  ]))];
  if (type === 'heart') return [scale(curvedOutline([0.5, 1], [
    [0.25, 0.8, 0, 0.57, 0, 0.3], [0, 0, 0.36, 0, 0.5, 0.25],
    [0.64, 0, 1, 0, 1, 0.3], [1, 0.57, 0.75, 0.8, 0.5, 1],
  ]))];
  if (type === 'person') {
    const radius = Math.min(width * 0.14, height * 0.1);
    return [arc(width / 2, height * 0.14, radius, radius), points([
      [0.34, 0.32], [0.66, 0.32], [0.85, 0.57], [0.75, 0.63], [0.63, 0.46],
      [0.63, 0.66], [0.72, 0.95], [0.59, 0.98], [0.5, 0.74], [0.41, 0.98],
      [0.28, 0.95], [0.37, 0.66], [0.37, 0.46], [0.25, 0.63], [0.15, 0.57],
    ])];
  }
  if (type === 'arrow') return [[{ x: width * 0.1, y: height / 2 }, { x: width * 0.9, y: height / 2 }], [{ x: width * 0.7, y: height * 0.25 }, { x: width * 0.9, y: height / 2 }, { x: width * 0.7, y: height * 0.75 }]];
  return [points([[0, 0], [1, 0], [1, 1], [0, 1]])];
}
