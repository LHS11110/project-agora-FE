import UserGroupContent from '../../canvas/userGroups/UserGroupContent.jsx';
import RenderedContent from '../../canvas/content/RenderedContent.jsx';
import { isTextContent, contentMode, contentSource } from '../../canvas/content/contentPresentation.js';
import { shapeOutlinePaths, shapeFillPaths } from '../../canvas/shapeGeometry.js';
import { objectBounds } from '../CanvasSpatialBTree.js';
import { connectorGeometry, OBJECT_SIZES } from '../connectorGeometry.js';
import { shapeArrowGeometry } from '../shapeArrowGeometry.js';
import ConnectorArrowheads from '../canvas/ConnectorArrowheads.jsx';
import AuthenticatedImage from '../AuthenticatedImage.jsx';
import MarkdownText from '../MarkdownText.jsx';
import MathFormula from '../MathFormula.jsx';

const WIDTH = 1000;
const HEIGHT = 600;
const kinds = new Set(['note', 'text', 'code', 'math', 'table', 'image', 'link', 'shape', 'stroke', 'connector', 'pdf', 'user-group']);

function PreviewContent({ item, token }) {
  if (item.kind === 'user-group') return <UserGroupContent item={item} token={token} />;
  if (item.kind === 'pdf') return <div className="canvas-preview-pdf"><AuthenticatedImage src={item.thumbnail} token={token} alt={item.filename || 'PDF'} fallback={<strong>PDF · {item.filename || '문서'}</strong>} /></div>;
  if (item.kind === 'image') return <AuthenticatedImage src={item.src} token={token} alt={item.filename || '공유 이미지'} fallback={<span>{item.filename || '이미지'}</span>} />;
  if (item.kind === 'table') return <table><thead><tr>{(item.columns || []).map((value, i) => <th key={i}>{String(value)}</th>)}</tr></thead><tbody>{(item.rows || []).map((row, i) => <tr key={i}>{(Array.isArray(row) ? row : []).map((value, j) => <td key={j}>{String(value)}</td>)}</tr>)}</tbody></table>;
  if (isTextContent(item)) return <RenderedContent value={contentSource(item)} mode={contentMode(item)} language={item.language || 'javascript'} />;
  if (item.kind === 'link') return <><strong>{item.title || '공유 링크'}</strong><p>{item.url || ''}</p></>;
  return item.format === 'markdown' || item.kind === 'note' ? <MarkdownText source={item.text || ''} /> : <p>{item.text || ''}</p>;
}

function PreviewObject({ item, token }) {
  const [defaultWidth, defaultHeight] = OBJECT_SIZES[item.kind] || [0.2, 0.12];
  const x = (Number(item.x) || 0) * WIDTH;
  const y = (Number(item.y) || 0) * HEIGHT;
  const width = Math.max(1, (Number(item.width) || defaultWidth) * WIDTH);
  const height = Math.max(1, (Number(item.height) || defaultHeight) * HEIGHT);
  const rotation = Number(item.rotation) || 0;
  if (item.kind === 'stroke') {
    const bounds = objectBounds({ ...item, rotation: 0 }, {}, WIDTH, HEIGHT);
    return <polyline points={(item.points || []).map(p => `${p.x * WIDTH},${p.y * HEIGHT}`).join(' ')} fill="none" stroke={item.color || '#263b35'} strokeWidth={item.strokeWidth || 3.5} strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${rotation} ${(bounds.minX + bounds.maxX) * WIDTH / 2} ${(bounds.minY + bounds.maxY) * HEIGHT / 2})`} />;
  }
  if (item.kind === 'shape') {
    const color = item.color || '#617d68';
    const arrow = item.shapeType === 'arrow' ? shapeArrowGeometry(width, height, item.bend, item.startHead, item.endHead) : null;
    return <g transform={`translate(${x} ${y}) rotate(${rotation} ${width / 2} ${height / 2})`} style={{ color }} fill="none" stroke={color} strokeWidth={item.strokeWidth || 2}>
      {!arrow && /^#[0-9a-f]{6}$/i.test(item.fill || '') && shapeFillPaths(item.shapeType, width, height).map((path, index) => <polygon key={`fill-${index}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill={item.fill} stroke="none" />)}
      {arrow ? <><polyline points={arrow.points.map(p => `${p.x},${p.y}`).join(' ')} /><ConnectorArrowheads geometry={arrow} offsetX={0} offsetY={0} strokeWidth={item.strokeWidth || 2} /></> : shapeOutlinePaths(item.shapeType, width, height).map((path, index) => <polyline key={index} points={path.map(p => `${p.x},${p.y}`).join(' ')} strokeLinejoin="round" />)}
    </g>;
  }
  return <foreignObject x={x} y={y} width={width} height={height} transform={`rotate(${rotation} ${x + width / 2} ${y + height / 2})`}><div xmlns="http://www.w3.org/1999/xhtml" className={`preview-object preview-object-${item.kind}`} style={{ background: item.kind === 'note' ? item.color || '#f6edcf' : undefined }}><PreviewContent item={item} token={token} /></div></foreignObject>;
}

/** Frame the complete document, including objects outside the initial viewport. */
export default function CanvasContentPreview({ items, token, name }) {
  const entries = Object.entries(items).filter(([, item]) => item && kinds.has(item.kind));
  const bounds = entries.map(([, item]) => objectBounds(item, items, WIDTH, HEIGHT));
  const valid = bounds.filter(b => Object.values(b).every(Number.isFinite));
  if (!valid.length) return <div className="canvas-preview-message">아직 객체가 없어요</div>;
  const minX = Math.min(...valid.map(b => b.minX)) * WIDTH - 35;
  const minY = Math.min(...valid.map(b => b.minY)) * HEIGHT - 35;
  const width = Math.max(240, Math.max(...valid.map(b => b.maxX)) * WIDTH - minX + 35);
  const height = Math.max(160, Math.max(...valid.map(b => b.maxY)) * HEIGHT - minY + 35);
  const connectors = entries.filter(([, item]) => item.kind === 'connector').map(([id, item]) => ({ id, item, geometry: connectorGeometry(item, items, WIDTH, HEIGHT) })).filter(entry => entry.geometry);
  return <svg className="canvas-content-preview" viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label={`${name || '캔버스'} 객체 미리보기`}>
    {connectors.map(({ id, item, geometry }) => <polyline key={id} points={geometry.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={item.color || '#617d68'} strokeWidth={item.strokeWidth || 1.5} />)}
    {entries.filter(([, item]) => item.kind !== 'connector').map(([id, item]) => <PreviewObject key={id} item={item} token={token} />)}
    {connectors.map(({ id, item, geometry }) => <g key={id} style={{ color: item.color || '#617d68' }}><ConnectorArrowheads geometry={geometry} offsetX={0} offsetY={0} strokeWidth={item.strokeWidth || 1.5} /></g>)}
  </svg>;
}
