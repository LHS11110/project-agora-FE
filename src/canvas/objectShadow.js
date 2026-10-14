const clamp = (value, fallback, min, max) => Number.isFinite(Number(value)) && value != null
  ? Math.max(min, Math.min(max, Number(value))) : fallback;

export function objectShadow(item = {}) {
  return { enabled: item.shadowEnabled !== false,
    blur: clamp(item.shadowBlur, 6, 0, 24), opacity: clamp(item.shadowOpacity, .15, 0, 1),
    x: clamp(item.shadowOffsetX, 0, -24, 24), y: clamp(item.shadowOffsetY, 2, -24, 24) };
}
export function shadowFilter(item) {
  const shadow = objectShadow(item);
  return shadow.enabled && shadow.opacity > 0
    ? `drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px rgba(24,34,43,${shadow.opacity}))` : 'none';
}
export function objectShadowStyle(item) {
  const shadow = objectShadow(item);
  return { '--object-shadow-filter': shadowFilter(item), '--object-shadow-box': shadow.enabled
    ? `${shadow.x}px ${shadow.y}px ${shadow.blur * 2}px rgba(24,34,43,${shadow.opacity})` : 'none' };
}
