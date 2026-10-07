export function groupLayout(scene, ids, items, viewSize) {
  if (!scene) return null;
  const elements = new Map([...scene.querySelectorAll('[data-item-id]')].map(element => [element.dataset.itemId, element]));
  const rects = {};
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const id of ids) {
    const item = items[id], element = elements.get(String(id));
    if (!item) continue;
    const width = element?.offsetWidth || (Number(item.width) || .2) * viewSize.width;
    const defaultHeight = { shape: .12, math: .09, text: .12, note: .15, table: .32, link: .15 }[item.kind] || .2;
    const height = element?.offsetHeight || (Number(item.height) || defaultHeight) * viewSize.height;
    const cx = (Number(item.x) || 0) * viewSize.width + width / 2;
    const cy = (Number(item.y) || 0) * viewSize.height + height / 2;
    const angle = (Number(item.rotation) || 0) * Math.PI / 180;
    const halfX = Math.abs(Math.cos(angle)) * width / 2 + Math.abs(Math.sin(angle)) * height / 2;
    const halfY = Math.abs(Math.sin(angle)) * width / 2 + Math.abs(Math.cos(angle)) * height / 2;
    bounds.minX = Math.min(bounds.minX, cx - halfX); bounds.maxX = Math.max(bounds.maxX, cx + halfX);
    bounds.minY = Math.min(bounds.minY, cy - halfY); bounds.maxY = Math.max(bounds.maxY, cy + halfY);
    rects[id] = { cx, cy, width, height };
  }
  if (Object.keys(rects).length < 2) return null;
  return { rects, left: bounds.minX, top: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY,
    cx: (bounds.minX + bounds.maxX) / 2, cy: (bounds.minY + bounds.maxY) / 2 };
}

export function rotateGroup(initialItems, layout, degrees, viewSize) {
  const radians = degrees * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  return Object.fromEntries(Object.entries(initialItems).map(([id, item]) => {
    const rect = layout.rects[id], dx = rect.cx - layout.cx, dy = rect.cy - layout.cy;
    return [id, { ...item,
      x: (layout.cx + dx * cosine - dy * sine - rect.width / 2) / viewSize.width,
      y: (layout.cy + dx * sine + dy * cosine - rect.height / 2) / viewSize.height,
      rotation: (((Number(item.rotation) || 0) + degrees + 180) % 360 + 360) % 360 - 180,
    }];
  }));
}
