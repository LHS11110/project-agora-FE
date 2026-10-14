import { itemDepthRange } from './itemSnapshots.js';
import { itemDepth } from './itemDepth.js';
import { useMemo } from 'react';
import './object-depth-controls.css';

function DepthIcon({ direction, edge }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className={direction === 'back' ? 'depth-icon-back' : ''}>
    <path d="M5 11 10 6l5 5M10 6v10" />{edge && <path d="M5 3h10" />}
  </svg>;
}

export default function ObjectDepthControls({ ids, items, onChange }) {
  const value = useMemo(()=>{const first=itemDepth(items[ids[0]]);return ids.every(id=>itemDepth(items[id])===first)?first:''},[ids,items]);
  const range = itemDepthRange(items);
  const apply = depth => ids.forEach(id => onChange(id, depth));
  return <section className="inspector-section object-depth-controls">
    <div className="object-depth-heading"><strong className="inspector-label">객체 깊이</strong><span>{ids.length}개 선택</span></div>
    <label className="object-depth-field"><span>깊이</span><input aria-label="객체 깊이" type="number" step="1" value={value} placeholder="혼합" onChange={event => { if (event.target.value !== '') apply(Number(event.target.value)); }} /></label>
    <div className="object-depth-actions">
      <button className="inspector-secondary-action" onClick={() => apply(range.max + 1)}><DepthIcon edge /><span>맨 앞으로</span></button>
      <button className="inspector-secondary-action" onClick={() => apply(range.min - 1)}><DepthIcon direction="back" edge /><span>맨 뒤로</span></button>
      <button className="inspector-secondary-action" onClick={() => ids.forEach(id => onChange(id, itemDepth(items[id]) + 1))}><DepthIcon /><span>한 단계 앞으로</span></button>
      <button className="inspector-secondary-action" onClick={() => ids.forEach(id => onChange(id, itemDepth(items[id]) - 1))}><DepthIcon direction="back" /><span>한 단계 뒤로</span></button>
    </div>
    <small className="inspector-hint">숫자가 클수록 앞에 표시됩니다. 기본값은 0입니다.</small>
  </section>;
}
