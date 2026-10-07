export default function ConnectorBendHandles({ geometry, offsetX, offsetY, width, height, onStart }) {
  return (geometry?.controlHandles || []).map((point, index) => <button key={index} type="button" className="shape-arrow-bend-handle" style={{ left: `${(point.x - offsetX) / width * 100}%`, top: `${(point.y - offsetY) / height * 100}%` }} title={`조절점 ${index + 1} · 드래그해 곡선 조절`} aria-label={`연결 화살표 곡률 조절점 ${index + 1}`} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); onStart(event, index); }} />);
}
