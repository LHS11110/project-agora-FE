const cardKinds = new Set(['image', 'pdf', 'chart', 'table', 'text', 'code', 'link']);
export const supportsObjectCorners = item => cardKinds.has(item?.kind);
export const validObjectCornerStyle = value => value === 'sharp' || value === 'rounded';
export const objectCornerStyle = item => item?.cornerStyle || (item?.kind === 'image' ? 'sharp' : 'rounded');
/** World-pixel radius shared by the DOM and the GPU thumbnail renderer. */
export function objectCornerRadius(item, width = Infinity, height = Infinity) {
  return item?.cornerStyle === 'rounded' ? Math.max(0, Math.min(24, width / 2, height / 2)) : 0;
}
