import { objectContentScale } from './objectContentScale.js';
export const MIN_OBJECT_FONT_SIZE = 2;
export const MAX_OBJECT_FONT_SIZE = 256;
export const hasIndependentContentSize = item => ['text', 'note', 'table', 'math', 'code'].includes(item?.kind);
export const objectBaseFontSize = item => ({ text: 13, code: 13, note: 10, table: 9, math: 16 }[item?.kind] || 13);
export function objectFontSize(item) {
  const saved = Number(item?.fontSize);
  return Number.isFinite(saved) && saved > 0 ? saved
    : objectBaseFontSize(item) * Math.min(objectContentScale(item, 'X'), objectContentScale(item, 'Y'));
}
export const isObjectFontSize = value => Number.isFinite(Number(value)) && Number(value) >= MIN_OBJECT_FONT_SIZE && Number(value) <= MAX_OBJECT_FONT_SIZE;
