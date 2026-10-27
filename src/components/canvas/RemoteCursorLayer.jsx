import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { Fragment, memo, useEffect, useRef, useState } from 'react';
import { CANVAS_SPACE } from '../../canvas/canvasSpace.js';
import '../../cursor-smoothing.css';

function selectionBounds(selection) {
  const { start, end } = selection || {};
  if (![start?.x, start?.y, end?.x, end?.y].every(Number.isFinite)) return null;
  return { minX: Math.min(start.x, end.x), minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x), maxY: Math.max(start.y, end.y) };
}

function cursorColor(nickname, tagNumber) {
  const identity = `${nickname || ''}#${tagNumber ?? ''}`;
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `hsl(${(hash >>> 0) % 360} 66% 43%)`;
}

const RemoteCursorLayer = memo(function RemoteCursorLayer({ updaterRef, activePeerIds, visibleBounds }) {
  useUiLocale();
  const [cursors, setCursors] = useState({});
  const pending = useRef(new Map());
  const frame = useRef(0);

  useEffect(() => {
    const updateCursor = (peer, cursor) => {
      if (!peer?.peer_id) return;
      if (cursor.visible === false) {
        pending.current.set(peer.peer_id, null);
      } else {
        const x = Number(cursor.x), y = Number(cursor.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        pending.current.set(peer.peer_id, { ...peer, x, y, color: cursorColor(peer.nickname, peer.tag_number), selection: selectionBounds(cursor.selection) });
      }
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const updates = pending.current;
        pending.current = new Map();
        setCursors(current => {
          let next = current;
          for (const [id, value] of updates) {
            const previous = next[id];
            if (!value) { if (!previous) continue; if (next === current) next = { ...current }; delete next[id]; continue; }
            const a = previous?.selection, b = value.selection;
            const sameSelection = a === b || (a && b && a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY);
            if (previous?.x === value.x && previous?.y === value.y && previous?.color === value.color && previous?.nickname === value.nickname && previous?.tag_number === value.tag_number && sameSelection) continue;
            if (next === current) next = { ...current };
            next[id] = value;
          }
          return next;
        });
      });
    };
    updaterRef.current = updateCursor;
    return () => {
      if (updaterRef.current === updateCursor) updaterRef.current = null;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      pending.current.clear();
    };
  }, [updaterRef]);

  useEffect(() => {
    const active = new Set(activePeerIds.split('\n').filter(Boolean));
    for (const id of pending.current.keys()) if (!active.has(id)) pending.current.delete(id);
    setCursors((current) => {
      const nextEntries = Object.entries(current).filter(([peerId]) => active.has(peerId));
      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
  }, [activePeerIds]);

  return Object.entries(cursors).map(([peerId, cursor]) => {
    const selection = cursor.selection;
    const selectionVisible = selection && selection.minX <= visibleBounds.maxX && selection.maxX >= visibleBounds.minX
      && selection.minY <= visibleBounds.maxY && selection.maxY >= visibleBounds.minY;
    const cursorVisible = cursor.x >= visibleBounds.minX && cursor.x <= visibleBounds.maxX
      && cursor.y >= visibleBounds.minY && cursor.y <= visibleBounds.maxY;
    return <Fragment key={peerId}>
      {selectionVisible && <div className="remote-selection-marquee" data-peer-id={peerId} aria-hidden="true"
        style={{ left: `${selection.minX * 100}%`, top: `${selection.minY * 100}%`,
          width: `${(selection.maxX - selection.minX) * 100}%`, height: `${(selection.maxY - selection.minY) * 100}%`, '--cursor-color': cursor.color }}>
        <span>{cursor.nickname}{" " + ui("· 선택 중") + ""}</span>
      </div>}
      {cursorVisible && <div className="remote-cursor" style={{ transform: `translate3d(${cursor.x * CANVAS_SPACE.width}px, ${cursor.y * CANVAS_SPACE.height}px, 0)`, '--cursor-color': cursor.color }} title={`${cursor.nickname}#${cursor.tag_number}`}><svg viewBox="0 0 18 22" aria-hidden="true"><path d="M1 1v17l4.5-4.3 3.1 7.1 3.1-1.4-3.2-6.8H15z" /></svg><span>{cursor.nickname}</span></div>}
    </Fragment>;
  });
});


export default RemoteCursorLayer;
