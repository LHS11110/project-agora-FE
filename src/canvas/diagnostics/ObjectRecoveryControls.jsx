import { useRef } from 'react';
import { createObjectDiagnostics, updateObjectDiagnostics } from './objectDiagnostics.js';
export { finiteBounds } from './objectDiagnostics.js';
import './object-recovery.css';
export default function ObjectRecoveryControls({ items, spatialIndex, onDelete }) {
  const cache=useRef(null);
  if(!cache.current)cache.current=createObjectDiagnostics();
  updateObjectDiagnostics(cache.current,items,spatialIndex);
  const problems=cache.current.value;
  if (!problems.length) return null;
  return <section className="inspector-section object-recovery"><strong className="inspector-label">표시 문제 객체 · {problems.length}개</strong><small className="inspector-hint">화면에서 조작할 수 없는 객체를 여기서 정리할 수 있습니다.</small>{problems.map(({ id, reason }) => <div key={id}><span><strong>{reason}</strong><code title={id}>{id}</code></span><button type="button" onClick={() => onDelete(id)} aria-label={`${id} 문제 객체 삭제`}>삭제</button></div>)}</section>;
}
