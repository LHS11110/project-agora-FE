import { canvasToolCategories } from '../canvasToolCatalog.js';
import { normalizeCanvasColor } from '../useCanvasPalette.js';
export const UNASSIGNED = 'unassigned';
export const folderDefaults = { navigate: '#6484b8', draw: '#c98957', diagram: '#8772b8', write: '#63977c', structure: '#589da5', media: '#b67496', color: '#a08b59' };
export const toolsById = Object.fromEntries([...canvasToolCategories.flatMap(category => category.tools), { id: 'palette', label: '색상 관리', icon: 'grid', palette: true }].map(tool => [tool.id, tool]));
export function defaultFolderLayout() {
  return { folders: [...canvasToolCategories.map(category => ({ id: category.id, label: category.label, color: folderDefaults[category.id], open: category.id === 'navigate', tools: category.tools.map(tool => tool.id) })), { id: 'color', label: '색상', color: folderDefaults.color, open: true, tools: ['palette'] }], unassigned: [] };
}
export function normalizeFolderLayout(value) {
  if (!Array.isArray(value?.folders)) return defaultFolderLayout();
  const seen = new Set(), folderIds = new Set();
  const takeTools = ids => (Array.isArray(ids) ? ids : []).filter(id => {
    if (!Object.hasOwn(toolsById, id) || seen.has(id)) return false;
    seen.add(id); return true;
  });
  const folders = value.folders.filter(folder => typeof folder?.id === 'string' && folder.id !== UNASSIGNED && !['__proto__', 'constructor', 'prototype'].includes(folder.id) && !folderIds.has(folder.id) && folderIds.add(folder.id)).map(folder => ({ id: folder.id, label: String(folder.label || '폴더').slice(0, 40), color: normalizeCanvasColor(folder.color) || '#6484b8', open: Boolean(folder.open), tools: takeTools(folder.tools) }));
  const unassigned = takeTools(value.unassigned);
  for (const id of Object.keys(toolsById)) if (!seen.has(id)) {
    const collaboration = folders.find(folder => (id === 'user-group' && folder.id === 'navigate') || (id === 'pdf' && folder.id === 'media')); 
    if (collaboration) collaboration.tools.push(id); else unassigned.push(id);
  }
  return { folders, unassigned };
}
