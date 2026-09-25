const MIN_WIDTHS = { image: 100, code: 190, note: 170, text: 110 };
const MIN_HEIGHTS = { shape: 38, code: 64, note: 148, math: 33, text: 38, table: 60, link: 60 };

function rotateAround(point, center, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  };
}

function strokeBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, Number(point.x) || 0),
    minY: Math.min(bounds.minY, Number(point.y) || 0),
    maxX: Math.max(bounds.maxX, Number(point.x) || 0),
    maxY: Math.max(bounds.maxY, Number(point.y) || 0),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

export function captureResize(item, handle, start, element, viewport) {
  if (item?.kind === 'stroke' && Array.isArray(item.points) && item.points.length) {
    return { kind: 'stroke', handle, start, bounds: strokeBounds(item.points) };
  }

  const width = Math.max(1, Number(viewport.width) || 1);
  const height = Math.max(1, Number(viewport.height) || 1);
  const objectWidth = Math.max(1, element?.offsetWidth || width * (Number(item.width) || 0.2)) / width;
  const objectHeight = Math.max(1, element?.offsetHeight || height * (Number(item.height) || 0.12)) / height;
  const x = Number(item.x) || 0;
  const y = Number(item.y) || 0;
  const center = { x: (x + objectWidth / 2) * width, y: (y + objectHeight / 2) * height };
  const rotation = (Number(item.rotation) || 0) * Math.PI / 180;
  const startLocal = rotateAround({ x: start.x * width, y: start.y * height }, center, -rotation);

  return {
    kind: 'rect', handle, startLocal, center, rotation,
    x, y, width: objectWidth, height: objectHeight,
  };
}

export function resizeItemAtPointer(item, resize, point, viewport) {
  const boardWidth = Math.max(1, Number(viewport.width) || 1);
  const boardHeight = Math.max(1, Number(viewport.height) || 1);

  if (resize.kind === 'stroke') {
    const { minX, minY, maxX, maxY } = resize.bounds;
    const originalWidth = maxX - minX;
    const originalHeight = maxY - minY;
    let nextMinX = minX;
    let nextMaxX = maxX;
    let nextMinY = minY;
    let nextMaxY = maxY;
    const deltaX = point.x - resize.start.x;
    const deltaY = point.y - resize.start.y;
    if (resize.handle.includes('w') && originalWidth > 1 / boardWidth) nextMinX += deltaX;
    if (resize.handle.includes('e') && originalWidth > 1 / boardWidth) nextMaxX += deltaX;
    if (resize.handle.includes('n') && originalHeight > 1 / boardHeight) nextMinY += deltaY;
    if (resize.handle.includes('s') && originalHeight > 1 / boardHeight) nextMaxY += deltaY;
    const minWidth = 4 / boardWidth;
    const minHeight = 4 / boardHeight;
    if (nextMaxX - nextMinX < minWidth) {
      if (resize.handle.includes('w')) nextMinX = nextMaxX - minWidth;
      else nextMaxX = nextMinX + minWidth;
    }
    if (nextMaxY - nextMinY < minHeight) {
      if (resize.handle.includes('n')) nextMinY = nextMaxY - minHeight;
      else nextMaxY = nextMinY + minHeight;
    }
    const nextWidth = nextMaxX - nextMinX;
    const nextHeight = nextMaxY - nextMinY;
    return {
      ...item,
      points: item.points.map((part) => ({
        ...part,
        x: originalWidth > 1 / boardWidth ? nextMinX + (part.x - minX) * nextWidth / originalWidth : part.x,
        y: originalHeight > 1 / boardHeight ? nextMinY + (part.y - minY) * nextHeight / originalHeight : part.y,
      })),
    };
  }

  const { handle, startLocal, center, rotation, x, y, width, height } = resize;
  const localPoint = rotateAround({ x: point.x * boardWidth, y: point.y * boardHeight }, center, -rotation);
  const deltaX = localPoint.x - startLocal.x;
  const deltaY = localPoint.y - startLocal.y;
  let left = -width * boardWidth / 2;
  let right = width * boardWidth / 2;
  let top = -height * boardHeight / 2;
  let bottom = height * boardHeight / 2;
  const minWidth = Math.max(40, MIN_WIDTHS[item.kind] || 0) / boardWidth;
  const minHeightPixels = item.kind === 'link' && item.mediaType !== 'link' ? 125 : MIN_HEIGHTS[item.kind] || 0;
  const minHeight = Math.max(32, minHeightPixels) / boardHeight;

  if (handle.includes('w')) left = Math.min(left + deltaX, right - minWidth);
  if (handle.includes('e')) right = Math.max(right + deltaX, left + minWidth);
  if (handle.includes('n')) top = Math.min(top + deltaY, bottom - minHeight);
  if (handle.includes('s')) bottom = Math.max(bottom + deltaY, top + minHeight);

  const nextWidth = (right - left) / boardWidth;
  const nextHeight = (bottom - top) / boardHeight;
  const localCenterOffset = { x: (left + right) / 2, y: (top + bottom) / 2 };
  const nextCenter = rotateAround({ x: center.x + localCenterOffset.x, y: center.y + localCenterOffset.y }, center, rotation);
  return {
    ...item,
    x: nextCenter.x / boardWidth - nextWidth / 2,
    y: nextCenter.y / boardHeight - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  };
}
