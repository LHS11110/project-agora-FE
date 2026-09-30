import { memo, useEffect, useState } from 'react';

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
      setCursors((current) => {
        const previous = current[peer.peer_id];
        const color = cursorColor(peer.nickname, peer.tag_number);
        if (previous?.x === x && previous?.y === y && previous?.color === color
          && previous?.nickname === peer.nickname && previous?.tag_number === peer.tag_number) return current;
        return { ...current, [peer.peer_id]: { ...peer, x, y, color } };
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

  return Object.entries(cursors)
    .filter(([, cursor]) => cursor.x >= visibleBounds.minX && cursor.x <= visibleBounds.maxX
      && cursor.y >= visibleBounds.minY && cursor.y <= visibleBounds.maxY)
    .map(([peerId, cursor]) => <div className="remote-cursor" key={peerId} style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, '--cursor-color': cursor.color }} title={`${cursor.nickname}#${cursor.tag_number}`}><svg viewBox="0 0 18 22" aria-hidden="true"><path d="M1 1v17l4.5-4.3 3.1 7.1 3.1-1.4-3.2-6.8H15z" /></svg><span>{cursor.nickname}</span></div>);
});


export default RemoteCursorLayer;
