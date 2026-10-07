import Icon from '../Icon.jsx';
import { CANVAS_SPACE } from '../../canvas/canvasSpace.js';
import { connectorObjectSize } from '../../canvas/connectors/objectMetrics.js';
import { OBJECT_SIZES } from '../connectorGeometry.js';
import { shapeCatalog } from '../../canvas/shapeCatalog.js';
import { codeLanguageLabel } from '../../canvas/codeLanguages.js';
import './connector-endpoint-info.css';

const labels = { text: '텍스트', note: '포스트잇', code: '코드', math: '수식', shape: '도형', table: '테이블', image: '이미지', link: '링크', stroke: '드로잉' };
function summary(item) {
  if (item.kind === 'code') return `${item.filename || 'snippet.js'} · ${codeLanguageLabel(item.language || 'text')}`;
  if (item.kind === 'shape') return shapeCatalog.find(shape => shape.id === item.shapeType)?.label || '도형';
  if (item.kind === 'table') return `${item.rows?.length || 0}행 × ${item.columns?.length || 0}열 · ${(item.columns || []).join(', ')}`;
  return String(item.text || item.formula || item.title || item.filename || item.url || '내용 없음');
}
function EndpointCard({ label, id, item, onNavigate }) {
  const measured = connectorObjectSize(item);
  const [defaultWidth, defaultHeight] = OBJECT_SIZES[item?.kind] || [.2, .12];
  const width = measured?.width ?? (Number(item?.width) || defaultWidth) * CANVAS_SPACE.width;
  const height = measured?.height ?? (Number(item?.height) || defaultHeight) * CANVAS_SPACE.height;
  const content = item ? summary(item) : '';
  return <article className="connector-endpoint-card">
    <div className="connector-endpoint-heading"><strong>{label}</strong><span>{item ? labels[item.kind] || item.kind : '연결 대상 없음'}</span></div>
    <code className="connector-endpoint-id" title={String(id || '')}>{id || '—'}</code>
    {item ? <><p className="connector-endpoint-summary" title={content}>{content.slice(0, 240)}</p>
      <dl className="connector-endpoint-details"><div><dt>위치</dt><dd>{Math.round((Number(item.x) || 0) * CANVAS_SPACE.width)}, {Math.round((Number(item.y) || 0) * CANVAS_SPACE.height)}</dd></div><div><dt>크기</dt><dd>{Math.round(width)} × {Math.round(height)} px</dd></div><div><dt>회전</dt><dd>{Math.round(Number(item.rotation) || 0)}°</dd></div></dl>
      <button type="button" onClick={() => onNavigate(id)} aria-label={`${label}로 이동`}>객체로 이동 <Icon name="arrow" size={13} /></button></> : <p className="connector-endpoint-summary">삭제되었거나 현재 접근할 수 없는 객체입니다.</p>}
  </article>;
}
export default function ConnectorEndpointInfo({ connector, items, onNavigate }) {
  return <section className="inspector-section connector-endpoint-section" aria-label="연결된 객체 정보">
    <strong className="inspector-label">연결된 객체</strong>
    <EndpointCard label="시작 객체" id={connector.from} item={items[connector.from]} onNavigate={onNavigate} />
    <span className="connector-endpoint-direction" aria-hidden="true">↓</span>
    <EndpointCard label="끝 객체" id={connector.to} item={items[connector.to]} onNavigate={onNavigate} />
  </section>;
}
