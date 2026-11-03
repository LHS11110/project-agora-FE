import { useRef } from 'react';
import Icon from '../components/Icon.jsx';
import { canvasToolCategories } from './canvasToolCatalog.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
const tools = Object.fromEntries(canvasToolCategories.flatMap(category => category.tools).map(tool => [tool.id, tool]));
const groups = [['select', 'hand'], ['pen', 'eraser', 'laser'], ['note', 'shape', 'connect', 'text', 'table', 'chart', 'image']];
export default function CanvasQuickDock({ undoCount = 0, onUndo, canUndo = false, canWrite = true, activeTool, onSelectTool, onUploadImage, toolsExpanded, onToggleTools }) {
  useUiLocale();
  const imageInput = useRef(null);
  return <nav className="canvas-quick-dock" aria-label={ui('캔버스 도구')}>
    <div className="quick-dock-group"><button type="button" className="quick-dock-tool" disabled={!canUndo || !undoCount} onClick={onUndo} aria-label={ui('실행 취소')} title={`${ui('실행 취소')} · Ctrl/⌘ + Z (${undoCount})`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12" transform="translate(0 -2)" /></svg><span className="quick-dock-tooltip">{ui('실행 취소')} · Ctrl/⌘ + Z</span>
    </button></div>
    {groups.map((group, index) => <div className="quick-dock-group" key={index}>
      {group.map(id => { const tool = tools[id]; return <button type="button" key={id}
        disabled={!canWrite&&!['select','hand','laser'].includes(id)} className={`quick-dock-tool${activeTool === id ? ' is-active' : ''}`}
        aria-label={ui(tool.description || tool.label)} aria-pressed={tool.upload ? undefined : activeTool === id}
        onClick={() => tool.upload ? imageInput.current?.click() : onSelectTool(id)}>
        <Icon name={tool.icon} size={21} /><span className="quick-dock-tooltip">{ui(tool.label)}</span>
      </button>; })}
    </div>)}
    <div className="quick-dock-group"><button type="button" className="quick-dock-tool quick-dock-more" aria-label={ui('툴 패널')}
      aria-expanded={toolsExpanded} onClick={onToggleTools}><Icon name="grid" size={20} /><span className="quick-dock-tooltip">{ui('툴 패널')}</span></button></div>
    <input ref={imageInput} type="file" accept="image/*" hidden onChange={onUploadImage} />
  </nav>;
}
