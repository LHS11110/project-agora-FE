// Two-dimensional projections with separate visible faces, shared by the
// picker, vector renderer and connector geometry.
export const volumeShapeCatalog = [
  { id: 'volume-cube', label: '입체 정육면체', aspect: 1, category: 'geometry', keywords: '3d cube solid' },
  { id: 'volume-cuboid', label: '입체 직육면체', aspect: 1.4, category: 'geometry', keywords: '3d cuboid box solid' },
  { id: 'volume-prism', label: '삼각기둥', aspect: 1.3, category: 'geometry', keywords: '3d triangular prism' },
  { id: 'volume-pyramid', label: '사각뿔', aspect: 1, category: 'geometry', keywords: '3d square pyramid' },
  { id: 'volume-cylinder', label: '입체 원기둥', aspect: .85, category: 'geometry', keywords: '3d cylinder solid' },
  { id: 'volume-cone', label: '입체 원뿔', aspect: .9, category: 'geometry', keywords: '3d cone solid' },
  { id: 'volume-sphere', label: '입체 구', aspect: 1, category: 'geometry', keywords: '3d sphere ball solid' },
];
const volumeTypes = new Set(volumeShapeCatalog.map(shape => shape.id));
export const isVolumeShape = type => volumeTypes.has(type);
const poly = values => [...values, values[0]].map(([x, y]) => ({ x, y }));
const line = values => values.map(([x, y]) => ({ x, y }));
const ellipse = (cx, cy, rx, ry, start = 0, end = Math.PI * 2, count = 40) =>
  Array.from({ length: count + 1 }, (_, i) => ({ x: cx + Math.cos(start + (end - start) * i / count) * rx, y: cy + Math.sin(start + (end - start) * i / count) * ry }));

export function volumeGeometry(type, width, height) {
  if (!isVolumeShape(type)) return null;
  let faces, paths;
  if (type === 'volume-cube' || type === 'volume-cuboid') {
    const front = poly([[.05,.28],[.72,.28],[.72,.96],[.05,.96]]);
    const top = poly([[.05,.28],[.28,.05],[.95,.05],[.72,.28]]);
    const side = poly([[.72,.28],[.95,.05],[.95,.73],[.72,.96]]);
    faces = [{ points: front, light: 0 }, { points: side, light: -.18 }, { points: top, light: .22 }];
    paths = [front, top, side];
  } else if (type === 'volume-prism') {
    const front = poly([[.04,.73],[.35,.2],[.35,.92]]), top = poly([[.04,.73],[.35,.2],[.94,.06],[.65,.58]]), side = poly([[.35,.2],[.94,.06],[.94,.78],[.35,.92]]);
    faces = [{ points: side, light: -.15 }, { points: top, light: .2 }, { points: front, light: 0 }]; paths = [side, top, front];
  } else if (type === 'volume-pyramid') {
    const left = poly([[.5,.05],[.04,.78],[.5,.96]]), right = poly([[.5,.05],[.5,.96],[.96,.78]]);
    faces = [{ points: left, light: .1 }, { points: right, light: -.18 }];
    paths = [left, right, line([[.04,.78],[.5,.61],[.96,.78]])];
  } else if (type === 'volume-cylinder') {
    const top = ellipse(.5,.18,.44,.13), bottom = ellipse(.5,.82,.44,.13,0,Math.PI,20);
    const body = [{x:.06,y:.18},{x:.06,y:.82},...bottom.slice().reverse(),{x:.94,y:.18}];
    faces = [{ points: body, light: -.08 }, { points: top, light: .22 }];
    paths = [line([[.06,.18],[.06,.82]]), bottom, line([[.94,.82],[.94,.18]]), top];
  } else if (type === 'volume-cone') {
    const base = ellipse(.5,.82,.44,.13,0,Math.PI,20);
    faces = [{ points: [{x:.5,y:.04},{x:.06,y:.82},...base.slice().reverse()], light: 0 },
      { points: [{x:.5,y:.04},{x:.5,y:.95},...base.slice(0,11).reverse()], light: -.15 }];
    paths = [line([[.5,.04],[.06,.82]]),base,line([[.94,.82],[.5,.04]]),ellipse(.5,.82,.44,.13,Math.PI,Math.PI*2,20)];
  } else {
    const circle = ellipse(.5,.5,.46,.46), highlight = ellipse(.35,.32,.16,.14);
    faces = [{ points: circle, light: -.04 }, { points: highlight, light: .32 }];
    paths = [circle, ellipse(.5,.5,.46,.15), ellipse(.5,.5,.16,.46)];
  }
  const scale = point => ({ x: point.x * width, y: point.y * height });
  return { faces: faces.map(face => ({ ...face, points: face.points.map(scale) })), paths: paths.map(path => path.map(scale)) };
}

export function shadeVolumeColor(value, light = 0) {
  if (!/^#[0-9a-f]{6}$/i.test(value || '')) return value;
  const channels = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
  return '#' + channels.map(channel => Math.round(light >= 0 ? channel + (255 - channel) * light : channel * (1 + light)).toString(16).padStart(2, '0')).join('');
}
