import { useFolderReorderMotion } from './toolFolders/useFolderReorderMotion.js';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CanvasColorPicker from './CanvasColorPicker.jsx';
import CanvasToolCategory from './CanvasToolCategory.jsx';
import { useToolFolderLayout } from './toolFolders/useToolFolderLayout.js';
import { useToolFolderDrag } from './toolFolders/useToolFolderDrag.js';
import { UNASSIGNED, toolsById } from './toolFolders/folderModel.js';
import FolderNameEditor from './toolFolders/FolderNameEditor.jsx';
import FolderTool, { ToolLabel } from './toolFolders/FolderTool.jsx';
import ToolFolderScatter from './toolFolders/ToolFolderScatter.jsx';
import './canvas-tool-panel.css';
import './toolFolders/tool-folders.css';

export default function CanvasToolPanel({ activeTool, onSelectTool, color, onColorChange, onUploadImage, onUploadPdf, favoriteColors, onSaveFavorite }) {
  const panelRef = useRef(null);
  const folders = useToolFolderLayout(activeTool);
  const captureFolderPositions = useFolderReorderMotion(panelRef, folders.layout.folders);
  const dragController = useToolFolderDrag({ moveTool: folders.moveTool, moveFolder: folders.moveFolder, beforeFolderMove: captureFolderPositions, panelRef });
  const [editingFolder, setEditingFolder] = useState(null);
  const [flights, setFlights] = useState([]);
  const [notice, setNotice] = useState('');
  const scattered = new Set(flights.map(flight => flight.toolId));
  const deleteFolder = folder => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const fallback = panelRef.current?.querySelector(`[data-tool-folder-id="${folder.id}"]`)?.getBoundingClientRect();
      const nextFlights = folder.tools.map(toolId => {
        const element = panelRef.current?.querySelector(`[data-folder-tool-id="${toolId}"]`);
        const rect = element?.getBoundingClientRect();
        const source = rect?.width > 0 && rect.height > 0 ? rect : fallback;
        return source ? { toolId, x: source.left, y: source.top, width: Math.max(80, Math.min(source.width, 120)), color: folder.color } : null;
      }).filter(Boolean);
      setFlights(nextFlights);
    }
    folders.deleteFolder(folder.id); setEditingFolder(null);
    setNotice(`${folder.label} 폴더를 삭제했습니다. 도구 ${folder.tools.length}개를 미분류로 이동했습니다.`);
  };
  const renderTools = ids => ids.map(id => <FolderTool key={id} tool={toolsById[id]} activeTool={activeTool} onSelectTool={onSelectTool} onUploadImage={onUploadImage} onUploadPdf={onUploadPdf} dragController={dragController} dragging={dragController.drag?.toolId === id} scattering={scattered.has(id)}>
    <CanvasColorPicker color={color} onChange={onColorChange} favoriteColors={favoriteColors} onSaveFavorite={onSaveFavorite} label="펜 및 도형 색상" compact />
  </FolderTool>);
  return <aside ref={panelRef} className="canvas-tools categorized-tools editable-tool-folders" aria-label="캔버스 도구">
    <div className="tool-folder-toolbar"><div className="canvas-tool-fold-actions"><button type="button" onClick={() => folders.setAllOpen(true)}>모두 열기</button><button type="button" onClick={() => folders.setAllOpen(false)}>모두 접기</button></div>
      <button type="button" className="canvas-folder-color-reset" onClick={() => setEditingFolder('new')}>+ 폴더 만들기</button>
      <button type="button" className="canvas-folder-color-reset" onClick={folders.resetColors}>폴더 색상 초기화</button>
      <button type="button" className="canvas-folder-color-reset" onClick={() => { setFlights([]); folders.resetLayout(); setEditingFolder(null); setNotice('기본 폴더 구조로 복원했습니다.'); }}>기본 구조 복원</button>
      {editingFolder === 'new' && <FolderNameEditor label="새 폴더 이름" onSubmit={name => { folders.createFolder(name); setEditingFolder(null); }} onCancel={() => setEditingFolder(null)} />}
    </div>
    {folders.layout.folders.map(folder => <CanvasToolCategory key={folder.id} folderId={folder.id} label={folder.label} open={folder.open} categoryColor={folder.color} onColorChange={color => folders.setFolderColor(folder.id, color)} onOpenChange={open => folders.setFolderOpen(folder.id, open)} selectedTool={folder.tools.includes(activeTool) ? toolsById[activeTool]?.label : null} dragHandlers={dragController.folderPointerHandlers(folder.id)} consumeDragClick={dragController.consumeClick} dragging={dragController.drag?.folderId === folder.id} reorderEdge={dragController.drag?.kind === 'folder' && dragController.drag.targetId === folder.id && dragController.drag.folderId !== folder.id ? (dragController.drag.after ? 'after' : 'before') : undefined} dropActive={dragController.drag?.kind === 'tool' && dragController.drag?.targetId === folder.id} onRename={() => setEditingFolder(folder.id)} onDelete={() => deleteFolder(folder)} editingName={editingFolder === folder.id ? <FolderNameEditor name={folder.label} onSubmit={name => { folders.renameFolder(folder.id, name); setEditingFolder(null); }} onCancel={() => setEditingFolder(null)} /> : null}>
      <div className="canvas-category-actions">{renderTools(folder.tools)}</div>
      {!folder.tools.length && <span className="tool-folder-empty">도구를 끌어 넣으세요</span>}
    </CanvasToolCategory>)}
    <section className="tool-folder-unassigned canvas-tool-category" data-tool-folder-id={UNASSIGNED} data-reorder-edge={dragController.drag?.kind === 'folder' && dragController.drag.targetId === UNASSIGNED ? 'before' : undefined} data-drop-active={dragController.drag?.kind === 'tool' && dragController.drag?.targetId === UNASSIGNED} aria-label="미분류 도구">
      <strong>미분류 도구</strong><p>도구를 드래그해 폴더로 옮기세요.</p><div className="canvas-category-actions">{renderTools(folders.layout.unassigned)}</div>{!folders.layout.unassigned.length && <span className="tool-folder-empty">여기에 도구를 꺼내둘 수 있어요</span>}
    </section>
    <span className="canvas-category-sr" role="status" aria-live="polite">{notice}</span>
    {dragController.drag && createPortal(<div className="tool-folder-drag-preview" aria-hidden="true" style={{ left: dragController.drag.x + 12, top: dragController.drag.y + 12 }}>{dragController.drag.kind === 'folder' ? <span>▣ {folders.layout.folders.find(folder => folder.id === dragController.drag.folderId)?.label}</span> : <ToolLabel tool={toolsById[dragController.drag.toolId]} />}</div>, document.body)}
    <ToolFolderScatter flights={flights} panelRef={panelRef} onFinish={() => setFlights([])} />
  </aside>;
}
