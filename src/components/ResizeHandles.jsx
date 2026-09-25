import './resize-handles.css';

const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const labels = {
  nw: '왼쪽 위', n: '위쪽', ne: '오른쪽 위', e: '오른쪽',
  se: '오른쪽 아래', s: '아래쪽', sw: '왼쪽 아래', w: '왼쪽',
};

export default function ResizeHandles({ onPointerDown }) {
  return <span className="object-resize-handles">
    {directions.map((direction) => <button
      key={direction}
      type="button"
      className={`object-resize-handle resize-${direction}`}
      aria-label={`${labels[direction]} 모서리에서 크기 조절`}
      title="드래그해 크기 조절"
      tabIndex={-1}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPointerDown(event, direction);
      }}
    />)}
  </span>;
}
