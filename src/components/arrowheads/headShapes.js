export const ARROW_HEAD_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'triangle', label: '삼각형' }, { value: 'triangle-outline', label: '빈 삼각형' },
  { value: 'open', label: '열린 화살촉' }, { value: 'double', label: '이중 화살촉' },
  { value: 'half', label: '반쪽 화살촉' },
  { value: 'diamond', label: '마름모' }, { value: 'diamond-outline', label: '빈 마름모' },
  { value: 'circle', label: '원형' }, { value: 'circle-outline', label: '빈 원형' },
  { value: 'square', label: '사각형' }, { value: 'square-outline', label: '빈 사각형' },
  { value: 'bar', label: '막대' }, { value: 'double-bar', label: '이중 막대' },
  { value: 'crowfoot', label: '갈퀴형' },
];
export const headNeedsTrim = type => !['none', 'open', 'double', 'half', 'bar', 'double-bar', 'crowfoot'].includes(type);

/** Rigid local geometry shared by SVG and Pixi. Tip is the front of the head. */
export function makeArrowHead(type, tip, axis, length, strokeWidth) {
  if (type === 'none') return null;
  const normal = { x: -axis.y, y: axis.x };
  const point = (x, y) => ({ x: tip.x + length * (axis.x * x + normal.x * y), y: tip.y + length * (axis.y * x + normal.y * y) });
  const parts = [];
  const path = (coords, closed = false, filled = false) => parts.push({ points: coords.map(([x, y]) => point(x, y)), closed, filled });
  if (type.startsWith('triangle')) path([[0, 0], [-1, .42], [-1, -.42]], true, type === 'triangle');
  else if (type.startsWith('diamond')) path([[0, 0], [-.5, .34], [-1, 0], [-.5, -.34]], true, type === 'diamond');
  else if (type.startsWith('circle')) {
    const center = point(-.5, 0), radius = length / 2;
    parts.push({ center, radius, filled: type === 'circle', closed: true,
      points: Array.from({ length: 32 }, (_, index) => ({ x: center.x + Math.cos(index * Math.PI / 16) * radius, y: center.y + Math.sin(index * Math.PI / 16) * radius })) });
  } else if (type.startsWith('square')) path([[0, .4], [-1, .4], [-1, -.4], [0, -.4]], true, type === 'square');
  else if (type === 'open') path([[-1, .42], [0, 0], [-1, -.42]]);
  else if (type === 'half') path([[-1, -.45], [0, 0]]);
  else if (type === 'double') { path([[-.55, .36], [0, 0], [-.55, -.36]]); path([[-1, .36], [-.45, 0], [-1, -.36]]); }
  else if (type === 'bar' || type === 'double-bar') { path([[0, -.48], [0, .48]]); if (type === 'double-bar') path([[-.45, -.48], [-.45, .48]]); }
  else if (type === 'crowfoot') { path([[0, -.45], [-1, 0], [0, .45]]); path([[-1, 0], [0, 0]]); }
  return { type, tip, parts, points: parts.flatMap(part => part.points), strokeWidth: Math.max(.25, Math.min(Number(strokeWidth) || 1.5, length * .16)) };
}
