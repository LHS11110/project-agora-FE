import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { shapeFillOpacity, shapeStrokeWidth, sketchFillOpacity } from '../../canvas/shapeAppearance.js';
import { itemDepth } from '../../canvas/itemDepth.js';
import UserGroupContent from '../../canvas/userGroups/UserGroupContent.jsx';
import RenderedContent from '../../canvas/content/RenderedContent.jsx';
import { isTextContent, contentMode, contentSource } from '../../canvas/content/contentPresentation.js';
import { shapeOutlinePaths, shapeFillPaths } from '../../canvas/shapeGeometry.js';
import { objectBounds } from '../CanvasSpatialBTree.js';
import { connectorGeometry, OBJECT_SIZES } from '../connectorGeometry.js';
import { shapeArrowGeometry } from '../shapeArrowGeometry.js';
import { vectorStrokePaths, sketchHatchPaths } from '../../canvas/vectorStyle.js';
import ConnectorArrowheads from '../canvas/ConnectorArrowheads.jsx';
import AuthenticatedImage from '../AuthenticatedImage.jsx';
import MarkdownText from '../MarkdownText.jsx';
import MathFormula from '../MathFormula.jsx';
import ChartView from '../../canvas/charts/ChartView.jsx';
import { volumeGeometry, shadeVolumeColor } from '../../canvas/volumeGeometry.js';

const WIDTH = 1000;
const HEIGHT = 600;
const kinds = new Set(['note', 'text', 'code', 'math', 'table', 'chart', 'image', 'link', 'shape', 'stroke', 'connector', 'pdf', 'user-group']);

function PreviewContent({ item, token }) {
  useUiLocale();
  if (item.kind === 'user-group') return <UserGroupContent item={item} token={token} />;
  if (item.kind === 'pdf') return <div className="canvas-preview-pdf"><AuthenticatedImage src={item.thumbnail} token={token} alt={item.filename || 'PDF'} fallback={<strong>PDF · {item.filename || ui('문서')}</strong>} /></div>;
  if (item.kind === 'image') return <AuthenticatedImage src={item.src} token={token} alt={item.filename || ui("공유 이미지")} fallback={<span>{item.filename || ui('이미지')}</span>} />;
  if (item.kind === 'table') return <table><thead><tr>{(item.columns || []).map((value, i) => <th key={i}>{String(value)}</th>)}</tr></thead><tbody>{(item.rows || []).map((row, i) => <tr key={i}>{(Array.isArray(row) ? row : []).map((value, j) => <td key={j}>{String(value)}</td>)}</tr>)}</tbody></table>;
  if (item.kind === 'chart') return <ChartView item={item} />;
  if (isTextContent(item)) return <RenderedContent value={contentSource(item)} mode={contentMode(item)} language={item.language || 'javascript'} />;
  if (item.kind === 'link') return <><strong>{item.title || ui("공유 링크")}</strong><p>{item.url || ''}</p></>;
  return item.format === 'markdown' || item.kind === 'note' ? <MarkdownText source={item.text || ''} /> : <p>{item.text || ''}</p>;
}

function PreviewLines({ paths, visualStyle, seed, width = 2 }) {


  return paths.flatMap((path, index) => vectorStrokePaths(path, visualStyle, `${seed}:${index}`).map((stroke, pass) =>
    <polyline key={`${index}:${pass}`} points={stroke.points.map(p => `${p.x},${p.y}`).join(' ')}
      fill="none" strokeOpacity={stroke.alpha} strokeWidth={width * stroke.widthScale} strokeLinejoin="round" />));
}

function PreviewObject({ id, item, token }) {


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
    const arrow = item.shapeType === 'arrow' ? shapeArrowGeometry(width, height, item.bend, item.startHead, item.endHead, item) : null;
    const volume = volumeGeometry(item.shapeType, width, height);
    const faces = volume ? volume.faces : shapeFillPaths(item.shapeType, width, height, item).map(points => ({ points, light: 0 }));
    return <g transform={`translate(${x} ${y}) rotate(${rotation} ${width / 2} ${height / 2})`} style={{ color }} fill="none" stroke={color} strokeWidth={shapeStrokeWidth(item)}>
      {!arrow && (!volume || item.volumeStyle !== 'wireframe') && shapeFillOpacity(item) > 0 && /^#[0-9a-f]{6}$/i.test(item.fill || '') && faces.map(({ points: path, light }, index) => item.visualStyle === 'sketch'
        ? <g key={`fill-${index}`}>{sketchHatchPaths(path, `${id}:fill`, undefined, shapeFillOpacity(item), sketchFillOpacity(item)).map((hatch, line) => <polyline key={line} points={hatch.points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke={item.fill} strokeWidth={1.2 * hatch.widthScale} strokeOpacity={hatch.alpha} strokeLinecap="round" />)}</g>
        : <polygon key={`fill-${index}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill={shadeVolumeColor(item.fill, light)} fillOpacity={shapeFillOpacity(item)} stroke="none" />)}
      {item.strokeEnabled !== false && (arrow ? <><PreviewLines paths={[arrow.points]} width={shapeStrokeWidth(item)} visualStyle={item.visualStyle} seed={id} /><ConnectorArrowheads geometry={arrow} visualStyle={item.visualStyle} seed={id} /></>
        : <PreviewLines paths={shapeOutlinePaths(item.shapeType, width, height, item)} width={shapeStrokeWidth(item)} visualStyle={item.visualStyle} seed={id} />)}
    </g>;
  }
  return <foreignObject x={x} y={y} width={width} height={height} transform={`rotate(${rotation} ${x + width / 2} ${y + height / 2})`}><div xmlns="http://www.w3.org/1999/xhtml" className={`preview-object preview-object-${item.kind}`} style={{ background: item.kind === 'note' ? item.color || '#f6edcf' : undefined, color: item.kind === 'text' && contentMode(item) !== 'code' && /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : undefined }}><PreviewContent item={item} token={token} /></div></foreignObject>;
}

/** Frame the complete document, including objects outside the initial viewport. */
export default function CanvasContentPreview({ items, token, name }) {
  useUiLocale();
  const entries = Object.entries(items).filter(([, item]) => item && kinds.has(item.kind)).sort((a, b) => itemDepth(a[1]) - itemDepth(b[1]));
  const bounds = entries.map(([, item]) => objectBounds(item, items, WIDTH, HEIGHT));
  const valid = bounds.filter(b => Object.values(b).every(Number.isFinite));
  if (!valid.length) return <div className="canvas-preview-message">{ui("아직 객체가 없어요")}</div>;
  const minX = Math.min(...valid.map(b => b.minX)) * WIDTH - 35;
  const minY = Math.min(...valid.map(b => b.minY)) * HEIGHT - 35;
  const width = Math.max(240, Math.max(...valid.map(b => b.maxX)) * WIDTH - minX + 35);
  const height = Math.max(160, Math.max(...valid.map(b => b.maxY)) * HEIGHT - minY + 35);
  return <svg className="canvas-content-preview" viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label={ui("{v0} 객체 미리보기", {
  v0: name || ui("캔버스")
})}>
    {entries.map(([id, item]) => {
      if (item.kind !== 'connector') return <PreviewObject key={id} id={id} item={item} token={token} />;
      const geometry = connectorGeometry(item, items, WIDTH, HEIGHT);
      return geometry && <g key={id} style={{ color: item.color || '#617d68' }}>
        {vectorStrokePaths(geometry.points, item.visualStyle, id).map((stroke, pass) => <polyline key={pass} points={stroke.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={item.color || '#617d68'} strokeWidth={(item.strokeWidth || 1.5) * stroke.widthScale} strokeOpacity={stroke.alpha} />)}
        <ConnectorArrowheads geometry={geometry} visualStyle={item.visualStyle} seed={id} />
      </g>;
    })}
  </svg>;
}
