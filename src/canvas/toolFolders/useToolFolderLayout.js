import { useEffect, useState } from 'react';
import { createId } from '../canvasIds.js';
import { normalizeCanvasColor } from '../useCanvasPalette.js';
import { defaultFolderLayout, normalizeFolderLayout, UNASSIGNED, toolsById, folderDefaults } from './folderModel.js';
const STORAGE_KEY = 'frelog_tool_folder_layout_v1';
function readLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeFolderLayout(JSON.parse(saved));
    const layout = defaultFolderLayout();
    const colors = JSON.parse(localStorage.getItem('frelog_tool_category_colors_v1') || '{}');
    const expanded = JSON.parse(localStorage.getItem('frelog_tool_categories') || '{}');
    layout.folders.forEach(folder => { folder.color = normalizeCanvasColor(colors?.[folder.id]) || folder.color; if (typeof expanded?.[folder.id] === 'boolean') folder.open = expanded[folder.id]; });
    return layout;
  } catch { return defaultFolderLayout(); }
}
export function useToolFolderLayout(activeTool) {
  const [layout, setLayout] = useState(readLayout);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* Editing works without persistence. */ } }, [layout]);
  useEffect(() => {
    setLayout(current => {
      const folder = current.folders.find(candidate => candidate.tools.includes(activeTool));
      if (!folder || folder.open) return current;
      return { ...current, folders: current.folders.map(candidate => candidate.id === folder.id ? { ...candidate, open: true } : candidate) };
    });
  }, [activeTool]);
  const updateFolder = (id, updates) => setLayout(current => ({ ...current, folders: current.folders.map(folder => folder.id === id ? { ...folder, ...updates } : folder) }));
  const renameFolder = (id, label) => { const name = label.trim().slice(0, 40); if (name) updateFolder(id, { label: name }); };
  const setFolderColor = (id, value) => { const color = normalizeCanvasColor(value); if (color) updateFolder(id, { color }); };
  const createFolder = label => {
    const name = label.trim().slice(0, 40);
    if (!name) return;
    setLayout(current => ({ ...current, folders: [...current.folders, { id: createId(), label: name, color: '#6484b8', open: true, tools: [] }] }));
  };
  const deleteFolder = id => setLayout(current => {
    const folder = current.folders.find(candidate => candidate.id === id);
    if (!folder) return current;
    return { folders: current.folders.filter(candidate => candidate.id !== id), unassigned: [...current.unassigned, ...folder.tools] };
  });
  const moveTool = (toolId, targetId, beforeToolId) => {
    if (!Object.hasOwn(toolsById, toolId)) return;
    setLayout(current => {
      if (targetId !== UNASSIGNED && !current.folders.some(folder => folder.id === targetId)) return current;
      if (beforeToolId === toolId) return current;
      const insert = ids => {
        const next = ids.filter(id => id !== toolId), index = next.indexOf(beforeToolId);
        next.splice(index < 0 ? next.length : index, 0, toolId); return next;
      };
      return { folders: current.folders.map(folder => ({ ...folder, open: folder.id === targetId ? true : folder.open, tools: folder.id === targetId ? insert(folder.tools) : folder.tools.filter(id => id !== toolId) })), unassigned: targetId === UNASSIGNED ? insert(current.unassigned) : current.unassigned.filter(id => id !== toolId) };
    });
  };
  const moveFolder = (folderId, targetId, after = false) => setLayout(current => {
    const folder = current.folders.find(candidate => candidate.id === folderId);
    if (!folder || folderId === targetId || (targetId !== UNASSIGNED && !current.folders.some(candidate => candidate.id === targetId))) return current;
    const next = current.folders.filter(candidate => candidate.id !== folderId);
    const index = targetId === UNASSIGNED ? next.length : next.findIndex(candidate => candidate.id === targetId) + (after ? 1 : 0);
    next.splice(index, 0, folder);
    if (next.every((candidate, position) => candidate.id === current.folders[position].id)) return current;
    return { ...current, folders: next };
  });
  return { layout, createFolder, deleteFolder, renameFolder, setFolderColor, moveTool, moveFolder,
    setFolderOpen: (id, open) => updateFolder(id, { open }),
    setAllOpen: open => setLayout(current => ({ ...current, folders: current.folders.map(folder => ({ ...folder, open })) })),
    resetColors: () => setLayout(current => ({ ...current, folders: current.folders.map(folder => ({ ...folder, color: folderDefaults[folder.id] || '#6484b8' })) })),
    resetLayout: () => setLayout(defaultFolderLayout()),
  };
}
