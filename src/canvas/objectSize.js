import { objectContentScale, isContentScalable } from './objectContentScale.js';
export const MIN_OBJECT_FONT_SIZE = 2;
export const MAX_OBJECT_FONT_SIZE = 256;
export const supportsObjectFontSize = item => Boolean(item?.kind && item.kind !== 'host-tombstone');
export const hasIndependentContentSize = item => ['text', 'note', 'table', 'math', 'code'].includes(item?.kind);
export const objectBaseFontSize = item => ({ text: 13, code: 13, note: 10, table: 9, math: 16, question: 12, chart: 9, connector: 12, shape: 12, image: 8, link: 8, pdf: 12, 'user-group': 12 }[item?.kind] || 13);
export function objectFontSize(item) {
  const saved = Number(item?.fontSize);
  return Number.isFinite(saved) && saved > 0 ? saved
    : objectBaseFontSize(item) * Math.min(objectContentScale(item, 'X'), objectContentScale(item, 'Y'));
}
export const isObjectFontSize = value => Number.isFinite(Number(value)) && Number(value) >= MIN_OBJECT_FONT_SIZE && Number(value) <= MAX_OBJECT_FONT_SIZE;

// Legacy text surfaces already scale their complete content once. Rich cards
// use a font-only factor so their geometry, icons and media never stretch.
export function objectFontStyle(item){
 const fit=isContentScalable(item)?Math.min(objectContentScale(item,'X'),objectContentScale(item,'Y')):1;
 const factor=hasIndependentContentSize(item)||!(Number(item?.fontSize)>0)?1:objectFontSize(item)/(objectBaseFontSize(item)*fit);
 return {'--object-font-factor':factor,'--object-font-size':`${objectFontSize(item)}px`};
}
