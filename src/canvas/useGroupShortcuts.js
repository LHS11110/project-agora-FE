import { useEffect, useRef } from 'react';

export function useGroupShortcuts({ editing, onGroup }) {
  const latest = useRef({ editing, onGroup });
  latest.current = { editing, onGroup };
  useEffect(() => {
    const keydown = event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'g') return;
      const target = event.target;
      if (latest.current.editing || target?.isContentEditable || target?.closest?.('input, textarea, select, .monaco-editor, [role="dialog"]')) return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) latest.current.onGroup(!event.shiftKey);
    };
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, []);
}
