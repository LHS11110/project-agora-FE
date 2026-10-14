export function canvasGraphics(context) {
  const color = value => `#${Number(value).toString(16).padStart(6, '0')}`;
  return {
    clear() {},
    moveTo(x, y) { context.beginPath(); context.moveTo(x, y); return this; },
    lineTo(x, y) { context.lineTo(x, y); return this; },
    poly(points) { context.beginPath(); context.moveTo(points[0], points[1]); for (let i = 2; i < points.length; i += 2) context.lineTo(points[i], points[i + 1]); context.closePath(); return this; },
    circle(x, y, radius) { context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); return this; },
    fill(options) { context.fillStyle = color(typeof options === 'number' ? options : options.color); context.globalAlpha = options.alpha ?? 1; context.fill(); return this; },
    stroke(options) { context.strokeStyle = color(options.color); context.globalAlpha = options.alpha ?? 1; context.lineWidth = options.width; context.lineCap = options.cap || 'butt'; context.lineJoin = options.join || 'miter'; context.stroke(); return this; },
  };
}
