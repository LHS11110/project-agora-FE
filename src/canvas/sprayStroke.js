/** Stable particles: camera movement and redraws never randomize a stroke. */
export function addSprayToPath(path, points, width) {
  const radius = width * 2;
  const spacing = Math.max(2, width * .7);
  const noise = value => { const n = Math.sin(value * 12.9898) * 43758.5453; return n - Math.floor(n); };
  const stamp = (x, y) => {
    const seed = Math.round(x * 31) + Math.round(y * 47);
    for (let i = 0; i < 9; i++) {
      const angle = noise(seed + i * 17) * Math.PI * 2;
      const distance = Math.sqrt(noise(seed + i * 23 + 91)) * radius;
      const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
      const dot = Math.max(.3, width * (.04 + noise(seed + i + 7) * .07));
      path.moveTo(px + dot, py); path.arc(px, py, dot, 0, Math.PI * 2);
    }
  };
  if (!points.length) return;
  stamp(points[0].x, points[0].y);
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (!distance) continue;
    const step = Math.max(spacing, distance / 256);
    let offset = Math.max(0, step - carry);
    for (; offset <= distance; offset += step) {
      const ratio = offset / distance;
      stamp(a.x + (b.x - a.x) * ratio, a.y + (b.y - a.y) * ratio);
    }
    carry = Math.max(0, distance - (offset - step));
  }
}
