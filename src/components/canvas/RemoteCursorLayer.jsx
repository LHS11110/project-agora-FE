import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { Fragment, memo, useEffect, useState } from 'react';
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

  useEffect(() => {
    const updateCursor = (peer, cursor) => {
      if (!peer?.peer_id) return;
      if (cursor.visible === false) {
        setCursors((current) => {
          if (!current[peer.peer_id]) return current;
          const next = { ...current };
          delete next[peer.peer_id];
          return next;
        });
        return;
      }
      const x = Number(cursor.x);
      const y = Number(cursor.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const selection = selectionBounds(cursor.selection);
      setCursors((current) => {
        const previous = current[peer.peer_id];
        const color = cursorColor(peer.nickname, peer.tag_number);
        if (previous?.x === x && previous?.y === y && previous?.color === color
          && previous?.nickname === peer.nickname && previous?.tag_number === peer.tag_number
          && JSON.stringify(previous?.selection) === JSON.stringify(selection)) return current;
        return { ...current, [peer.peer_id]: { ...peer, x, y, color, selection } };
      });
    };
    updaterRef.current = updateCursor;
    return () => {
      if (updaterRef.current === updateCursor) updaterRef.current = null;
    };
  }, [updaterRef]);

  useEffect(() => {
    const active = new Set(activePeerIds.split('\n').filter(Boolean));
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
      {cursorVisible && <div className="remote-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, '--cursor-color': cursor.color }} title={`${cursor.nickname}#${cursor.tag_number}`}><svg viewBox="0 0 18 22" aria-hidden="true"><path d="M1 1v17l4.5-4.3 3.1 7.1 3.1-1.4-3.2-6.8H15z" /></svg><span>{cursor.nickname}</span></div>}
    </Fragment>;
  });
});


export default RemoteCursorLayer;
