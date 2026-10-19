import { SizeInput } from '../canvas/ObjectSizeControls.jsx';
import ArrowHeadPreview from './arrowheads/ArrowHeadPreview.jsx';
import './arrowheads/arrow-head-preview.css';
import { ARROW_HEAD_OPTIONS, DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD } from './arrowheadGeometry.js';

function HeadOptions() {
  return <><optgroup label="화살표 모양">{ARROW_HEAD_OPTIONS.filter(option => !option.group).map(({value,label}) => <option key={value} value={value}>{label}</option>)}</optgroup><optgroup label="ERD 관계">{ARROW_HEAD_OPTIONS.filter(option => option.group).map(({value,label}) => <option key={value} value={value}>{label}</option>)}</optgroup></>;
}

export default function ArrowHeadControls({ item, onChange, className = '' }) {
  return <div className={`arrow-head-controls${className ? ` ${className}` : ''}`} aria-label="화살표 머리 모양">
    <label><span>시작 머리<ArrowHeadPreview type={item?.startHead || DEFAULT_ARROW_START_HEAD} visualStyle={item?.visualStyle} start /></span><select value={item?.startHead || DEFAULT_ARROW_START_HEAD} onChange={(event) => onChange('startHead', event.target.value)} aria-label="시작 화살표 머리 모양"><HeadOptions /></select></label>
    <label><span>끝 머리<ArrowHeadPreview type={item?.endHead || DEFAULT_ARROW_END_HEAD} visualStyle={item?.visualStyle} /></span><select value={item?.endHead || DEFAULT_ARROW_END_HEAD} onChange={(event) => onChange('endHead', event.target.value)} aria-label="끝 화살표 머리 모양"><HeadOptions /></select></label>
    {(item?.kind === 'connector' || [item?.startHead,item?.endHead].some(value => value?.startsWith('erd-'))) && <small className="inspector-hint">ERD 관계는 시작과 끝에서 각각 선택합니다. 각 끝은 반대편 객체 하나에 연결될 수 있는 개수를 나타냅니다.</small>}
    {(item?.kind || item?.headSize != null) && <div className="object-size-controls arrow-head-size"><SizeInput label="머리 크기" value={item?.headSize ?? (item?.kind === 'connector' ? Math.max(8, Math.min(15, 6 + (Number(item.strokeWidth) || 1.5) * 2.5)) : 17)} min={2} max={128} onCommit={value => onChange('headSize', value)} /></div>}
  </div>;
}
