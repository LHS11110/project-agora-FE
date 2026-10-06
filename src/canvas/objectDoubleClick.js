import { inspectShareUrl } from '../components/shareMedia.js';

export function handleObjectDoubleClick(event, { id, item, activeTool, editing, onStartEditing, onConnectorDoubleClick }) {
  if (activeTool !== 'select' || editing) return;
  if (event.target.closest?.('button, input, textarea, select, .object-rotation-handle, .resize-handle')) return;
  // Cells handle their own coordinates, including column names.
  if (item.kind === 'table') return;
  if (['text', 'note', 'code', 'math'].includes(item.kind)) {
    event.preventDefault(); event.stopPropagation();
    onStartEditing(id);
  } else if (item.kind === 'connector') {
    event.preventDefault(); event.stopPropagation();
    onConnectorDoubleClick(id, item);
  } else if (item.kind === 'link') {
    const media = inspectShareUrl(item.url);
    if (!media) return;
    event.preventDefault(); event.stopPropagation();
    if (media.mediaType === 'link') window.open(media.url, '_blank', 'noopener,noreferrer');
    else onStartEditing(id);
  }
}
