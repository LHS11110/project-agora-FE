export const PEN_STYLES = [
  { id: 'pen', label: '펜', description: '필압·속도에 따라 굵기가 변하는 매끄러운 필기 선' },
  { id: 'ink', label: '붓', description: '필압·속도에 따라 굵기와 붓결이 달라지는 선' },
  { id: 'highlighter', label: '형광펜', description: '이동 방향에 수직인 평평한 펜촉으로 칠하는 선' },
  { id: 'spray', label: '스프레이', description: '작은 입자가 흩어지는 선' },
];
export const isPenStyle = value => PEN_STYLES.some(style => style.id === value);
export function strokeOpacity(stroke) {
  const opacity = Number(stroke?.opacity ?? 1);
  return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
}
