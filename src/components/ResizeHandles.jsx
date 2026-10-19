import { useUiLocale } from '../i18n/useUiLocale.js';
import { ui } from '../i18n/locale.js';
import './resize-handles.css';

const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const labels = {
  nw: '왼쪽 위 모서리', n: '위쪽 테두리', ne: '오른쪽 위 모서리', e: '오른쪽 테두리',
  se: '오른쪽 아래 모서리', s: '아래쪽 테두리', sw: '왼쪽 아래 모서리', w: '왼쪽 테두리',
};

export default function ResizeHandles({ onPointerDown }) {
  useUiLocale();
  return <span className="object-resize-handles">
    {directions.map((direction) => <button
      key={direction}
      type="button"
      className={`object-resize-handle resize-${direction}`}
      aria-label={ui("{v0}에서 크기 조절", {
  v0: ui(labels[direction])
})}
      tabIndex={-1}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPointerDown(event, direction);
      }}
    />)}
  </span>;
}
