import { useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
export function ToolLabel({ tool }) {
  return <>{tool.mark ? <span className="markdown-tool-mark" aria-hidden="true">{tool.mark}</span> : <Icon name={tool.icon} size={18} />}<span className="canvas-tool-label">{tool.label}</span></>;
}
export default function FolderTool({ tool, activeTool, onSelectTool, onUploadImage, onUploadPdf, dragController, dragging, scattering, children }) {
  const input = useRef(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  return <div className={`folder-tool${dragging ? ' is-dragging' : ''}${scattering ? ' is-scattering' : ''}`} data-folder-tool-id={tool.id}>
    <button type="button" className={`tool-button${activeTool === tool.id ? ' active' : ''}`} title={`${tool.description || tool.label} · 드래그해서 폴더 이동`} aria-label={tool.description || tool.label} aria-pressed={tool.palette ? undefined : activeTool === tool.id} aria-expanded={tool.palette ? paletteOpen : undefined} {...dragController.toolPointerHandlers(tool.id)} onClick={event => {
      if (dragController.consumeClick(event)) return;
      if (tool.upload) input.current?.click();
      else if (tool.palette) setPaletteOpen(open => !open);
      else onSelectTool(tool.id);
    }}><ToolLabel tool={tool} /></button>
    {tool.upload && <input ref={input} type="file" accept={tool.accept || 'image/*'} hidden aria-label={tool.description || tool.label} onChange={tool.id === 'pdf' ? onUploadPdf : onUploadImage} />}
    {tool.palette && paletteOpen && children}
  </div>;
}
