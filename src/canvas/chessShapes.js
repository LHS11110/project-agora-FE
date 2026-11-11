import en from '../i18n/en.js';

en['체스'] = 'Chess';
en['체스 킹'] = 'Chess King';
en['체스 퀸'] = 'Chess Queen';
en['체스 룩'] = 'Chess Rook';
en['체스 비숍'] = 'Chess Bishop';
en['체스 나이트'] = 'Chess Knight';
en['체스 폰'] = 'Chess Pawn';

export const chessShapeCatalog = [
  { id: 'chess-king', label: '체스 킹', aspect: 72/98, category: 'chess', keywords: '체스 킹 chess king 기물 말' },
  { id: 'chess-queen', label: '체스 퀸', aspect: 72/97.4, category: 'chess', keywords: '체스 퀸 chess queen 기물 말' },
  { id: 'chess-rook', label: '체스 룩', aspect: 72/94, category: 'chess', keywords: '체스 룩 chess rook 캐슬 castle 기물 말' },
  { id: 'chess-bishop', label: '체스 비숍', aspect: 72/97, category: 'chess', keywords: '체스 비숍 chess bishop 기물 말' },
  { id: 'chess-knight', label: '체스 나이트', aspect: 72/94, category: 'chess', keywords: '체스 나이트 chess knight 말 horse 기물' },
  { id: 'chess-pawn', label: '체스 폰', aspect: 72/92, category: 'chess', keywords: '체스 폰 chess pawn 기물 말' },
];

const types = new Set(chessShapeCatalog.map(s => s.id));
export const isChessShape = type => types.has(type);

const p = (x, y) => ({ x, y });
const close = points => [...points, { ...points[0] }];

/**
 * Sample a path made of ['L', x, y], ['C', x1, y1, x2, y2, x, y] and
 * ['A', cx, cy, r, fromDeg, toDeg] segments (degrees, y down).
 */
function trace(start, segments, steps = 18) {
  const points = [p(...start)];
  for (const [kind, ...v] of segments) {
    const from = points[points.length - 1];
    if (kind === 'L') points.push(p(v[0], v[1]));
    else if (kind === 'C') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        points.push(p(u ** 3 * from.x + 3 * u * u * t * v[0] + 3 * u * t * t * v[2] + t ** 3 * v[4],
          u ** 3 * from.y + 3 * u * u * t * v[1] + 3 * u * t * t * v[3] + t ** 3 * v[5]));
      }
    } else if (kind === 'A') {
      const [cx, cy, r, a0, a1] = v, n = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 8));
      for (let i = 0; i <= n; i++) {
        const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
        points.push(p(cx + r * Math.cos(a), cy + r * Math.sin(a)));
      }
    }
  }
  return points;
}

/** Mirror a right-half profile (top centre → bottom centre) into a closed silhouette. */
function mirrored(start, segments) {
  const right = trace(start, segments);
  const left = right.slice(1, -1).reverse().map(q => p(100 - q.x, q.y));
  return close([...right, ...left]);
}

const circle = (cx, cy, r) => close(trace([cx + r, cy], [['A', cx, cy, r, 0, 360]]).slice(1, -1));
const hLine = (y, half) => [p(50 - half, y), p(50 + half, y)];

// Shared Staunton foot: concave stem → bead ring → stepped plinth.
const foot = (stemX, stemY) => [
  ['C', stemX - 1, stemY + 14, 57, 70, 66, 78],
  ['C', 71, 78.5, 72, 81, 68, 82.5],
  ['C', 74, 83, 78, 85, 78, 88],
  ['C', 84, 88.5, 86, 91, 86, 94],
  ['L', 86, 100],
  ['L', 50, 100],
];
const footDetails = () => [hLine(82.5, 18), hLine(88, 28), hLine(94, 36)];

const cache = new Map();

function base(type) {
  if (cache.has(type)) return cache.get(type);
  let silhouette, details = [], extraFills = [];

  if (type === 'chess-pawn') {
    silhouette = mirrored([50, 8], [
      ['A', 50, 22, 14, -90, 62],
      ['C', 58, 36, 66, 36, 68, 39],
      ['C', 70, 41.5, 66, 44, 58, 44],
      ...foot(58, 44),
    ]);
    details = [hLine(44, 8), ...footDetails()];
  } else if (type === 'chess-rook') {
    silhouette = mirrored([50, 6], [
      ['L', 55, 6], ['L', 55, 15], ['L', 63, 15], ['L', 63, 6], ['L', 74, 6],
      ['L', 74, 24],
      ['C', 74, 27, 70, 28, 66, 29],
      ['C', 63, 42, 62, 58, 64, 70],
      ['L', 66, 72],
      ['C', 70, 73, 71, 77, 68, 78],
      ['C', 74, 80, 78, 84, 78, 88],
      ['C', 84, 88.5, 86, 91, 86, 94],
      ['L', 86, 100], ['L', 50, 100],
    ]);
    details = [hLine(24, 24), hLine(29, 16), hLine(72, 16), hLine(78, 18), hLine(88, 28), hLine(94, 36)];
  } else if (type === 'chess-bishop') {
    const finial = circle(50, 7, 4);
    extraFills.push(finial);
    silhouette = mirrored([50, 11], [
      ['C', 58, 15, 66, 24, 66, 33],
      ['C', 66, 41, 60, 46, 56, 47],
      ['C', 66, 48, 68, 51, 66, 53],
      ['C', 64, 55, 60, 55, 57, 55],
      ...foot(57, 55),
    ]);
    details = [[p(52, 22), p(60, 32)], hLine(47, 6), hLine(55, 7), ...footDetails()];
  } else if (type === 'chess-queen') {
    const balls = [[50, 6, 3.4], [37, 10, 3], [63, 10, 3], [26, 17, 2.6], [74, 17, 2.6]].map(([x, y, r]) => circle(x, y, r));
    extraFills.push(...balls);
    silhouette = mirrored([50, 22], [
      ['L', 56, 14], ['L', 58.5, 24], ['L', 63, 13.5], ['L', 64.5, 26], ['L', 74, 19.5],
      ['C', 70, 28, 65, 35, 62, 40],
      ['C', 68, 41, 69, 44, 66, 46],
      ['C', 63, 48, 59, 48, 57, 48],
      ...foot(57, 48),
    ]);
    details = [hLine(40, 12), hLine(48, 7), ...footDetails()];
  } else if (type === 'chess-king') {
    silhouette = mirrored([50, 2], [
      ['L', 52.5, 2], ['L', 52.5, 6], ['L', 56.5, 6], ['L', 56.5, 10], ['L', 52.5, 10], ['L', 52.5, 15],
      ['C', 62, 15, 72, 18, 72, 26],
      ['C', 72, 32, 67, 37, 63, 40],
      ['C', 68, 41, 69, 44, 66, 46],
      ['C', 63, 48, 59, 48, 57, 48],
      ...foot(57, 48),
    ]);
    details = [[p(50, 15), p(50, 40)], hLine(40, 13), hLine(48, 7), ...footDetails()];
  } else if (type === 'chess-knight') {
    silhouette = close(trace([22, 100], [
      ['L', 22, 94],
      ['C', 22, 91, 24, 88.5, 30, 88],
      ['C', 30, 84, 33, 82, 36, 81],
      ['C', 34, 74, 37, 66, 45, 58],
      ['C', 41, 56, 37, 55, 33, 57],
      ['C', 25, 61, 17, 60, 14, 55],
      ['C', 12, 51, 14, 47, 19, 43],
      ['C', 27, 36, 35, 27, 42, 18],
      ['L', 44, 6],
      ['L', 50, 13],
      ['C', 53, 10, 56, 8, 58, 6],
      ['L', 59, 13],
      ['C', 74, 18, 82, 36, 80, 56],
      ['C', 79, 68, 74, 76, 70, 81],
      ['C', 73, 82, 76, 84, 76, 88],
      ['C', 81, 88.5, 84, 91, 84, 94],
      ['L', 84, 100],
    ]));
    details = [
      circle(43, 29, 2.2),
      [p(19, 51), p(23, 50)],
      [p(44, 18), p(55, 15)],
      trace([60, 15], [['C', 70, 26, 74, 44, 72, 60], ['C', 71, 68, 68, 74, 64, 80]]),
      [p(30, 88), p(76, 88)], [p(22, 94), p(84, 94)], [p(36, 81), p(70, 81)],
    ];
  }

  const paths = [silhouette, ...extraFills, ...details];
  const fills = [silhouette, ...extraFills];
  const vertices = paths.flat();
  const xs = vertices.map(q => q.x), ys = vertices.map(q => q.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1, h = Math.max(...ys) - y0 || 1;
  const scale = path => path.map(q => p((q.x - x0) / w, (q.y - y0) / h));
  const result = { paths: paths.map(scale), fills: fills.map(scale) };
  cache.set(type, result);
  return result;
}

export function chessShapeGeometry(type, width, height) {
  if (!types.has(type)) return null;
  const b = base(type);
  const scale = path => path.map(q => p(q.x * width, q.y * height));
  return { paths: b.paths.map(scale), fills: b.fills.map(scale) };
}
