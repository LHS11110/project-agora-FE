import { isCollaborativeItem } from '../collaborativeSync.js';
import { isCodeLanguage } from '../codeLanguages.js';
import { isTextContent, isContentMode } from './contentPresentation.js';
export function useContentSettings({ itemsRef, setItems, updateCollaborativeMetadata, sendItemChange, refreshSpatialIndex }) {
  return (id, field, value) => {
    const previous = itemsRef.current[id];
    if (!isTextContent(previous)) return;
    const valid = field === 'renderMode' ? isContentMode(value) : field === 'language' ? isCodeLanguage(value) : field === 'filename' && typeof value === 'string' && value.length <= 80;
    if (!valid) return;
    if (isCollaborativeItem(previous)) { updateCollaborativeMetadata(id, field, value); return; }
    const next = { ...previous, [field]: value };
    if (!sendItemChange({ type: 'item_update', item_id: id, item: next }, previous)) return;
    itemsRef.current = { ...itemsRef.current, [id]: next };
    setItems(current => ({ ...current, [id]: next })); refreshSpatialIndex();
  };
}
