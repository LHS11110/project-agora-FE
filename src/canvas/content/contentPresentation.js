export const CONTENT_MODES = [
  { value: 'plain', label: '일반 텍스트' }, { value: 'markdown', label: 'Markdown' },
  { value: 'latex', label: 'LaTeX' }, { value: 'code', label: '코드' },
];
export const isContentMode = mode => CONTENT_MODES.some(option => option.value === mode);
export const isTextContent = item => ['text', 'code', 'math'].includes(item?.kind);
export function contentMode(item) {
  if (isContentMode(item?.renderMode)) return item.renderMode;
  if (item?.kind === 'code') return 'code';
  if (item?.kind === 'math') return 'latex';
  return item?.format === 'markdown' ? 'markdown' : 'plain';
}
export const contentSource = item => String(item?.[item?.kind === 'code' ? 'code' : item?.kind === 'math' ? 'formula' : 'text'] ?? '');
