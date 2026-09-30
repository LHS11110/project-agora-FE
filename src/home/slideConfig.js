export const HOME_SLIDES = [
  { label: '아고라 소개', row: 0, column: 0 },
  { label: '서비스 구조', row: 1, column: 0 },
  { label: '벡터 캔버스', row: 1, column: 1 },
  { label: '실시간 협업', row: 1, column: 2 },
  { label: '직접 체험', row: 2, column: 2 },
];

export function getAdjacentSlide(index, rowOffset, columnOffset) {
  const current = HOME_SLIDES[index];
  return HOME_SLIDES.findIndex((slide) => (
    slide.row === current.row + rowOffset && slide.column === current.column + columnOffset
  ));
}

export function canScroll(element, direction) {
  if (!element || direction === 0) return false;
  const { overflowY } = window.getComputedStyle(element);
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false;
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 1) return false;
  return direction > 0
    ? element.scrollTop < maxScroll - 1
    : element.scrollTop > 1;
}
