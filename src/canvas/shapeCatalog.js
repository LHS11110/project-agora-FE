export const shapeCatalog = [
  { id: 'circle', label: '원', aspect: 1 },
  { id: 'ellipse', label: '타원', aspect: 1.8 },
  { id: 'triangle', label: '삼각형', aspect: 1.15 },
  { id: 'square', label: '정사각형', aspect: 1 },
  { id: 'rectangle', label: '직사각형', aspect: 1.8 },
  { id: 'pentagon', label: '오각형', aspect: 1 },
  { id: 'hexagon', label: '육각형', aspect: 1.15 },
  { id: 'diamond', label: '마름모', aspect: 1 },
  { id: 'semicircle', label: '반원', aspect: 2 },
  { id: 'cylinder', label: '원기둥', aspect: 1.2 },
  { id: 'cloud', label: '구름', aspect: 1.6 },
  { id: 'person', label: '사람', aspect: 0.55 },
  { id: 'star', label: '별', aspect: 1 },
  { id: 'heart', label: '하트', aspect: 1.1 },
  { id: 'trapezoid', label: '사다리꼴', aspect: 1.5 },
  { id: 'arrow', label: '화살표', aspect: 1.8 },
];

export function shapeCreationSize(type, space) {
  const shape = shapeCatalog.find(entry => entry.id === type) || shapeCatalog.find(entry => entry.id === 'rectangle');
  const width = type === 'person' ? 0.09 : 0.14;
  return { width, height: width * space.width / (shape.aspect * space.height) };
}
