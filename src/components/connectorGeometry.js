export const OBJECT_SIZES = {
  image: [0.3, 0.2],
  code: [0.32, 0.2],
  shape: [0.14, 0.12],
  math: [0.2, 0.09],
  text: [0.22, 0.12],
  note: [0.22, 0.15],
  table: [0.42, 0.32],
  link: [0.3, 0.15],
};

function objectRect(item, width, height) {
  const [defaultWidth, defaultHeight] = OBJECT_SIZES[item?.kind] || [0.2, 0.12];
  const x = (Number(item?.x) || 0) * width;
  const y = (Number(item?.y) || 0) * height;
  const objectWidth = (Number(item?.width) || defaultWidth) * width;
  const objectHeight = (Number(item?.height) || defaultHeight) * height;
  return {
    centerX: x + objectWidth / 2,
    centerY: y + objectHeight / 2,
    halfWidth: objectWidth / 2,
    halfHeight: objectHeight / 2,
    rotation: (Number(item?.rotation) || 0) * Math.PI / 180,
    isEllipse: item?.kind === 'shape' && item.shapeType === 'ellipse',
  };
}

function distanceToEdge(rect, directionX, directionY) {
  const cosine = Math.cos(rect.rotation);
  const sine = Math.sin(rect.rotation);
  const localX = directionX * cosine + directionY * sine;
  const localY = -directionX * sine + directionY * cosine;
  if (rect.isEllipse) {
    const factor = (localX / rect.halfWidth) ** 2 + (localY / rect.halfHeight) ** 2;
    return factor > 0 ? 1 / Math.sqrt(factor) : 0;
  }
  const xDistance = Math.abs(localX) > 1e-8 ? rect.halfWidth / Math.abs(localX) : Infinity;
  const yDistance = Math.abs(localY) > 1e-8 ? rect.halfHeight / Math.abs(localY) : Infinity;
  return Math.min(xDistance, yDistance);
}

function bezierPoint(points, t) {
  const [p0, p1, p2, p3, p4, p5] = points;
  const inverse = 1 - t;
  const i2 = inverse * inverse;
  const t2 = t * t;
  const weights = [i2 * i2 * inverse, 5 * i2 * i2 * t, 10 * i2 * inverse * t2, 10 * i2 * t2 * t, 5 * inverse * t2 * t2, t2 * t2 * t];
  return points.reduce((point, current, index) => ({
    x: point.x + current.x * weights[index],
    y: point.y + current.y * weights[index],
  }), { x: 0, y: 0 });
}

export function connectorGeometry(item, items, width = 1, height = 1) {
  const fromItem = items?.[item?.from];
  const toItem = items?.[item?.to];
  if (!fromItem || !toItem) return null;

  const from = objectRect(fromItem, width, height);
  const to = objectRect(toItem, width, height);
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;

  const directionX = dx / length;
  const directionY = dy / length;
  const normalX = -directionY;
  const normalY = directionX;
  const curveRotation = (Number(item.rotation) || 0) * Math.PI / 180;
  const curveNormalX = normalX * Math.cos(curveRotation) - normalY * Math.sin(curveRotation);
  const curveNormalY = normalX * Math.sin(curveRotation) + normalY * Math.cos(curveRotation);
  const sourceReach = distanceToEdge(from, directionX, directionY);
  const targetReach = distanceToEdge(to, -directionX, -directionY);
  const start = {
    x: from.centerX + directionX * sourceReach,
    y: from.centerY + directionY * sourceReach,
  };
  const end = {
    x: to.centerX - directionX * targetReach,
    y: to.centerY - directionY * targetReach,
  };
  const gap = Math.max(1, (end.x - start.x) * directionX + (end.y - start.y) * directionY);
  const bend = Math.min(72, gap * 0.18);
  const curve = [
    start,
    { x: start.x + directionX * gap * 0.2, y: start.y + directionY * gap * 0.2 },
    { x: start.x + directionX * gap * 0.4 + curveNormalX * bend, y: start.y + directionY * gap * 0.4 + curveNormalY * bend },
    { x: end.x - directionX * gap * 0.4 + curveNormalX * bend, y: end.y - directionY * gap * 0.4 + curveNormalY * bend },
    { x: end.x - directionX * gap * 0.2, y: end.y - directionY * gap * 0.2 },
    end,
  ];
  const points = Array.from({ length: 33 }, (_, index) => bezierPoint(curve, index / 32));
  return { points, directionX, directionY };
}
