import ArrowHeadPreview from './arrowheads/ArrowHeadPreview.jsx';
import './arrowheads/arrow-head-preview.css';
import { ARROW_HEAD_OPTIONS, DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD } from './arrowheadGeometry.js';

export default function ArrowHeadControls({ item, onChange, className = '' }) {
  return <div className={`arrow-head-controls${className ? ` ${className}` : ''}`} aria-label="화살표 머리 모양">
    <label><span>시작 머리<ArrowHeadPreview type={item?.startHead || DEFAULT_ARROW_START_HEAD} start /></span><select value={item?.startHead || DEFAULT_ARROW_START_HEAD} onChange={(event) => onChange('startHead', event.target.value)} aria-label="시작 화살표 머리 모양">{ARROW_HEAD_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label><span>끝 머리<ArrowHeadPreview type={item?.endHead || DEFAULT_ARROW_END_HEAD} /></span><select value={item?.endHead || DEFAULT_ARROW_END_HEAD} onChange={(event) => onChange('endHead', event.target.value)} aria-label="끝 화살표 머리 모양">{ARROW_HEAD_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
  </div>;
}
