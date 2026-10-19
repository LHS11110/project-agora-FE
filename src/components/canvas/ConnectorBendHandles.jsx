import { useUiLocale } from '../../i18n/useUiLocale.js';
import { ui } from '../../i18n/locale.js';
export default function ConnectorBendHandles({ geometry, offsetX, offsetY, width, height, onStart }) {
  useUiLocale();
  return (geometry?.controlHandles || []).map((point, index) => <button key={index} type="button" className="shape-arrow-bend-handle" style={{ left: `${(point.x - offsetX) / width * 100}%`, top: `${(point.y - offsetY) / height * 100}%` }} title={ui("조절점 {v0} · 드래그해 곡선 조절", {
  v0: index + 1
})} aria-label={ui("연결 화살표 곡률 조절점 {v0}", {
  v0: index + 1
})} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); onStart(event, index); }} />);
}
