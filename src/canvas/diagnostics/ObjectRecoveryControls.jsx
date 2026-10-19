import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useRef } from 'react';
import { createObjectDiagnostics, updateObjectDiagnostics } from './objectDiagnostics.js';
export { finiteBounds } from './objectDiagnostics.js';
import './object-recovery.css';
export default function ObjectRecoveryControls({ items, spatialIndex, onDelete }) {
  useUiLocale();
  const cache=useRef(null);
  if(!cache.current)cache.current=createObjectDiagnostics();
  updateObjectDiagnostics(cache.current,items,spatialIndex);
  const problems=cache.current.value;
  if (!problems.length) return null;
  return <section className="inspector-section object-recovery"><strong className="inspector-label">{"" + ui("표시 문제 객체 ·") + " "}{problems.length}{ui("개")}</strong><small className="inspector-hint">{ui("화면에서 조작할 수 없는 객체를 여기서 정리할 수 있습니다.")}</small>{problems.map(({ id, reason }) => <div key={id}><span><strong>{ui(reason)}</strong><code title={id}>{id}</code></span><button type="button" onClick={() => onDelete(id)} aria-label={ui("{v0} 문제 객체 삭제", {
  v0: id
})}>{ui("삭제")}</button></div>)}</section>;
}
