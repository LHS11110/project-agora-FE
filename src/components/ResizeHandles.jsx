import './resize-handles.css';

const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const labels = {
  nw: '왼쪽 위 모서리', n: '위쪽 테두리', ne: '오른쪽 위 모서리', e: '오른쪽 테두리',
  se: '오른쪽 아래 모서리', s: '아래쪽 테두리', sw: '왼쪽 아래 모서리', w: '왼쪽 테두리',
};

export default function ResizeHandles({ onPointerDown }) {
  return <span className="object-resize-handles">
    {directions.map((direction) => <button
      key={direction}
      type="button"
      className={`object-resize-handle resize-${direction}`}
      aria-label={`${labels[direction]}에서 크기 조절`}
      tabIndex={-1}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPointerDown(event, direction);
      }}
    />)}
  </span>;
}
