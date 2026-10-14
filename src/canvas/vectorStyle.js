export const VECTOR_STYLES = ['standard', 'sketch'];

function seedHash(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

// Smooth seeded noise avoids a repeating sine-wave pattern or redraw flicker.
function noise(position, seed) {
  const cell = Math.floor(position), t = position - cell;
  const sample = index => {
    let value = Math.imul(seed ^ index, 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296 * 2 - 1;
  };
  return sample(cell) + (sample(cell + 1) - sample(cell)) * t * t * (3 - 2 * t);
}

// Drift follows arc length, independently of how a curve was tessellated.
// Corners and endpoints stay anchored; short arrowheads get gentler variation.
export function sketchPath(points, seed = '', pass = 0, roughness = 1) {
  if (points.length < 2) return points;
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const length = distances.at(-1);
  if (!length) return points.map(point => ({ ...point }));
  const anchors = [0, length];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y);
    if (ab && bc && ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (ab * bc) < .75) anchors.push(distances[i]);
  }
  const hash = seedHash(`${seed}:${pass}`);
  const amplitude = Math.min(2.1, Math.min(1.9, .45 + length * .005) * roughness);
  const wavelength = Math.max(12, Math.min(55, length * .2));
  const taper = Math.min(12, length / 4);
  const result = [{ ...points[0] }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], segment = distances[i] - distances[i - 1];
    const steps = Math.max(1, Math.ceil(segment / 3));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps, distance = distances[i - 1] + segment * t;
      const nearest = Math.min(...anchors.map(anchor => Math.abs(distance - anchor)));
      const fade = Math.min(1, nearest / taper);
      const envelope = fade * fade * (3 - 2 * fade);
      const offset = amplitude * envelope * (noise(distance / wavelength, hash) + .2 * noise(distance / 9, hash ^ 0x9e3779b9));
      result.push({ x: a.x + (b.x - a.x) * t - (b.y - a.y) / (segment || 1) * offset,
        y: a.y + (b.y - a.y) * t + (b.x - a.x) / (segment || 1) * offset });
    }
  }
  result[result.length - 1] = { ...points.at(-1) };
  return result;
}

export function vectorStrokePaths(points, visualStyle, seed = '', roughness = 1) {
  return visualStyle === 'sketch'
    ? [{ points: sketchPath(points, seed, 0, roughness), widthScale: .85, alpha: .85 },
      { points: sketchPath(points, seed, 1, roughness), widthScale: .45, alpha: .35 }]
    : [{ points, widthScale: 1, alpha: 1 }];
}

/** Two light, parallel pen passes, clipped to a possibly concave polygon. */
export function sketchHatchPaths(polygon, seed = '', spacing) {
  if (polygon.length < 3) return [];
  const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y);
  const size = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const gap = spacing || Math.max(5, Math.min(12, size / 10));
  const hash = seedHash(`${seed}:hatch`);
  const result = [];
  for (let pass = 0; pass < 2; pass++) {
    const angle = -Math.PI / 4;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const projected = polygon.map(p => ({ x: p.x * cosine + p.y * sine, y: -p.x * sine + p.y * cosine }));
    const low = Math.min(...projected.map(p => p.y)), high = Math.max(...projected.map(p => p.y));
    const step = Math.max(gap, (high - low) / 512);
    for (let line = 0, y = low + step * .45; y < high; line++, y += step) {
      const level = y + pass * .6 + noise(line * 1.37, hash) * step * .06;
      const hits = [];
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i], b = projected[(i + 1) % projected.length];
        // Half-open edges avoid counting a shared vertex twice.
        if ((a.y <= level && b.y > level) || (b.y <= level && a.y > level)) {
          hits.push(a.x + (b.x - a.x) * (level - a.y) / (b.y - a.y));
        }
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        if (hits[i + 1] - hits[i] < .4) continue;
        const point = x => ({ x: x * cosine - level * sine, y: x * sine + level * cosine });
        result.push({ points: [point(hits[i]), point(hits[i + 1])],
          widthScale: pass ? .7 : 1, alpha: (pass ? .10 : .30) + noise(line, hash) * .025 });
      }
    }
  }
  return result;
}

// Shared by Pixi and SVG, including circular heads and multipart arrowheads.
export function arrowheadStrokeParts(head, visualStyle, seed, transform = point => point) {
  return head.parts.map((part, index) => {
    const points = part.points.map(transform);
    const outline = part.closed && points.length ? [...points, points[0]] : points;
    return { ...part, center: part.center ? transform(part.center) : undefined,
      hatches: visualStyle === 'sketch' && part.filled
        ? sketchHatchPaths(part.points, `${seed}:head:${index}`).map(stroke => ({ ...stroke, points: stroke.points.map(transform) })) : [],
      strokes: vectorStrokePaths(outline, visualStyle, `${seed}:head:${index}`, 1.6) };
  });
}
