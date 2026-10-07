import { useEffect, useState } from 'react';
import { canvasToolCategories } from './canvasToolCatalog.js';

const storageKey = 'frelog_tool_categories';
const categoryIds = [...canvasToolCategories.map(category => category.id), 'color'];

export function useToolCategories(activeTool) {
  const activeCategory = canvasToolCategories.find(category => category.tools.some(tool => tool.id === activeTool))?.id;
  const [expanded, setExpanded] = useState(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* Use defaults when storage is unavailable. */ }
    return Object.fromEntries(categoryIds.map(id => [id, typeof saved[id] === 'boolean' ? saved[id] : id === activeCategory || id === 'color']));
  });
  const setCategoryOpen = (id, open) => setExpanded(current => current[id] === open ? current : { ...current, [id]: open });
  const setAllOpen = open => setExpanded(Object.fromEntries(categoryIds.map(id => [id, open])));
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(expanded)); } catch { /* The panel remains usable without persistence. */ }
  }, [expanded]);
  useEffect(() => {
    if (activeCategory) setExpanded(current => current[activeCategory] ? current : { ...current, [activeCategory]: true });
  }, [activeCategory, activeTool]);
  return { expanded, activeCategory, setCategoryOpen, setAllOpen };
}
