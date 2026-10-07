import Icon from '../components/Icon.jsx';
import CanvasColorPicker from './CanvasColorPicker.jsx';
import { canvasToolCategories } from './canvasToolCatalog.js';
import CanvasToolCategory from './CanvasToolCategory.jsx';
import { useToolCategories } from './useToolCategories.js';
import './canvas-tool-panel.css';

export default function CanvasToolPanel({ activeTool, onSelectTool, color, onColorChange, onUploadImage, favoriteColors, onSaveFavorite }) {
  const { expanded, setCategoryOpen, setAllOpen } = useToolCategories(activeTool);
  return <aside className="canvas-tools categorized-tools" aria-label="캔버스 도구">
    <div className="canvas-tool-fold-actions"><button type="button" onClick={() => setAllOpen(true)}>모두 열기</button><button type="button" onClick={() => setAllOpen(false)}>모두 접기</button></div>
    {canvasToolCategories.map(category => <CanvasToolCategory key={category.id} label={category.label} open={expanded[category.id]}
      onOpenChange={open => setCategoryOpen(category.id, open)} selectedTool={category.tools.find(tool => tool.id === activeTool)?.label}>
      <div className="canvas-category-actions">
        {category.tools.map(tool => {
          const content = <>{tool.mark ? <span className="markdown-tool-mark" aria-hidden="true">{tool.mark}</span> : <Icon name={tool.icon} size={18} />}<span className="canvas-tool-label">{tool.label}</span></>;
          const description = tool.description || tool.label;
          return tool.upload
            ? <label key={tool.id} className="tool-button file-tool" title={description}>{content}<input type="file" accept="image/*" aria-label={description} onChange={onUploadImage} /></label>
            : <button key={tool.id} type="button" className={`tool-button${activeTool === tool.id ? ' active' : ''}`} title={description} aria-label={description} aria-pressed={activeTool === tool.id} onClick={() => onSelectTool(tool.id)}>{content}</button>;
        })}
      </div>
    </CanvasToolCategory>)}
    <CanvasToolCategory className="canvas-tool-colors" label="색상" open={expanded.color} onOpenChange={open => setCategoryOpen('color', open)}>
      <CanvasColorPicker color={color} onChange={onColorChange} favoriteColors={favoriteColors} onSaveFavorite={onSaveFavorite} label="펜 및 도형 색상" compact />
    </CanvasToolCategory>
  </aside>;
}
