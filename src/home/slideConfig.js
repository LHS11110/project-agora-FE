export const HOME_SLIDES = [
  { label: 'FreLog 소개' },
  { label: '작동 방식' },
  { label: '프로젝트 맵' },
  { label: '실시간 협업' },
  { label: '직접 체험' },
];

export function getAdjacentSlide(index, rowOffset, columnOffset) {
  const direction = Math.sign(rowOffset || columnOffset);
  if (direction === 0) return -1;
  const nextIndex = index + direction;
  return nextIndex >= 0 && nextIndex < HOME_SLIDES.length ? nextIndex : -1;
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
