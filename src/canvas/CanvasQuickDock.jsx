import { useRef } from 'react';
import Icon from '../components/Icon.jsx';
import { canvasToolCategories } from './canvasToolCatalog.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
const tools = Object.fromEntries(canvasToolCategories.flatMap(category => category.tools).map(tool => [tool.id, tool]));
const groups = [['select', 'hand'], ['pen', 'eraser', 'laser'], ['note', 'shape', 'connect', 'text', 'table', 'image']];
export default function CanvasQuickDock({ activeTool, onSelectTool, onUploadImage, toolsExpanded, onToggleTools }) {
  useUiLocale();
  const imageInput = useRef(null);
  return <nav className="canvas-quick-dock" aria-label={ui('캔버스 도구')}>
    {groups.map((group, index) => <div className="quick-dock-group" key={index}>
      {group.map(id => { const tool = tools[id]; return <button type="button" key={id}
        className={`quick-dock-tool${activeTool === id ? ' is-active' : ''}`}
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
