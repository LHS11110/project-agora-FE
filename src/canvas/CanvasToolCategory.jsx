import { useId } from 'react';
import Icon from '../components/Icon.jsx';

export default function CanvasToolCategory({ label, open, onOpenChange, selectedTool, className = '', children }) {
  const labelId = useId();
  return <section className={`canvas-tool-category ${className}${selectedTool ? ' has-selected-tool' : ''}`} data-open={open} aria-labelledby={labelId}>
    <button type="button" id={labelId} className="canvas-category-heading" aria-expanded={open} aria-controls={`${labelId}-content`} onClick={() => onOpenChange(!open)} title={selectedTool ? `${label} · 선택한 도구: ${selectedTool}` : label}>
      <Icon name="chevron" size={10} className="canvas-category-chevron" />
      <svg className="canvas-category-folder" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        <path className="folder-open-line" d="M3 10h18l-2 11H5Z" />
      </svg>
      <span>{label}</span>
      {selectedTool && <><i className="canvas-category-selected" aria-hidden="true" /><span className="canvas-category-sr">선택한 도구: {selectedTool}</span></>}
    </button>
    <div id={`${labelId}-content`} className="canvas-category-collapse" aria-hidden={!open} inert={open ? undefined : ''}>
      <div className="canvas-category-clip"><div className="canvas-category-content">{children}</div></div>
    </div>
  </section>;
}
