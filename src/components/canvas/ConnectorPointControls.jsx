import { connectorPointCount, MAX_BEND_POINTS } from '../../canvas/connectors/controlPoints.js';
import '../../canvas/content/unified-content.css';
export default function ConnectorPointControls({ item, onChange }) {
  return <div className="content-render-controls"><label>곡률 조절점 개수<input type="number" min="1" max={MAX_BEND_POINTS} step="1" value={connectorPointCount(item)} aria-label="연결 화살표 곡률 조절점 개수" onChange={event => {
    const count = Number(event.target.value);
    if (Number.isInteger(count) && count >= 1 && count <= MAX_BEND_POINTS) onChange(count);
  }} /></label><small className="inspector-hint">기본 1개 · 최대 {MAX_BEND_POINTS}개. 각 점을 드래그해 원하는 부분을 휘어보세요.</small></div>;
}
