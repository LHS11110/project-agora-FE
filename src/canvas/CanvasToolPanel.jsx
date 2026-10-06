import Icon from '../components/Icon.jsx';
import CanvasColorPicker from './CanvasColorPicker.jsx';
import { canvasToolCategories } from './canvasToolCatalog.js';
import './canvas-tool-panel.css';

export default function CanvasToolPanel({ activeTool, onSelectTool, color, onColorChange, onUploadImage, favoriteColors, onSaveFavorite }) {
  return <aside className="canvas-tools categorized-tools" aria-label="캔버스 도구">
    {canvasToolCategories.map(category => <section className="canvas-tool-category" key={category.id} aria-labelledby={`tool-category-${category.id}`}>
      <h2 id={`tool-category-${category.id}`}>{category.label}</h2>
      <div className="canvas-category-actions">
        {category.tools.map(tool => {
          const content = <>{tool.mark ? <span className="markdown-tool-mark" aria-hidden="true">{tool.mark}</span> : <Icon name={tool.icon} size={18} />}<span className="canvas-tool-label">{tool.label}</span></>;
          const description = tool.description || tool.label;
          return tool.upload
            ? <label key={tool.id} className="tool-button file-tool" title={description}>{content}<input type="file" accept="image/*" aria-label={description} onChange={onUploadImage} /></label>
            : <button key={tool.id} type="button" className={`tool-button${activeTool === tool.id ? ' active' : ''}`} title={description} aria-label={description} aria-pressed={activeTool === tool.id} onClick={() => onSelectTool(tool.id)}>{content}</button>;
        })}
      </div>
    </section>)}
    <section className="canvas-tool-category canvas-tool-colors" aria-labelledby="tool-category-color">
      <h2 id="tool-category-color">색상</h2>
      <CanvasColorPicker color={color} onChange={onColorChange} favoriteColors={favoriteColors} onSaveFavorite={onSaveFavorite} label="펜 및 도형 색상" compact />
    </section>
  </aside>;
}
