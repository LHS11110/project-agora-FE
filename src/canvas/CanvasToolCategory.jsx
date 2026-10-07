import { useId } from 'react';
import Icon from '../components/Icon.jsx';

export default function CanvasToolCategory({ label, open, onOpenChange, selectedTool, categoryColor, onColorChange, className = '', folderId, dropActive, reorderEdge, dragging, dragHandlers, consumeDragClick, onRename, onDelete, editingName, children }) {
  const labelId = useId();
  return <section className={`canvas-tool-category ${className}${selectedTool ? ' has-selected-tool' : ''}`} data-tool-folder-id={folderId} data-drop-active={Boolean(dropActive)} data-reorder-edge={reorderEdge} data-folder-dragging={Boolean(dragging)} data-open={open} aria-labelledby={labelId} style={categoryColor ? { '--category-color': categoryColor } : undefined}>
    <div className="canvas-category-header">
    <button type="button" id={labelId} className="canvas-category-heading" aria-expanded={open} aria-controls={`${labelId}-content`} {...dragHandlers} onClick={event => { if (consumeDragClick?.(event)) return; onOpenChange(!open); }} title={`${selectedTool ? `${label} · 선택한 도구: ${selectedTool}` : label} · 드래그해서 폴더 순서 변경`}>
      <Icon name="chevron" size={10} className="canvas-category-chevron" />
      <svg className="canvas-category-folder" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        <path className="folder-open-line" d="M3 10h18l-2 11H5Z" />
      </svg>
      <span>{label}</span>
      {selectedTool && <><i className="canvas-category-selected" aria-hidden="true" /><span className="canvas-category-sr">선택한 도구: {selectedTool}</span></>}
    </button>
      {onColorChange && <input type="color" className="canvas-category-color-input" value={categoryColor} aria-label={`${label} 폴더 색상`} title={`${label} 폴더 색상 변경`} onChange={event => onColorChange(event.target.value)} />}
    </div>
    {(onRename || onDelete) && <div className="tool-folder-management"><button type="button" onClick={onRename} aria-label={`${label} 폴더 이름 변경`}>이름</button><button type="button" onClick={onDelete} aria-label={`${label} 폴더 삭제`} title="폴더만 삭제하고 도구는 미분류로 이동">삭제</button></div>}
    {editingName}
    <div id={`${labelId}-content`} className="canvas-category-collapse" aria-hidden={!open} inert={open ? undefined : ''}>
      <div className="canvas-category-clip"><div className="canvas-category-content">{children}</div></div>
    </div>
  </section>;
}
