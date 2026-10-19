import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { SizeInput } from '../canvas/ObjectSizeControls.jsx';
import ArrowHeadPreview from './arrowheads/ArrowHeadPreview.jsx';
import './arrowheads/arrow-head-preview.css';
import { ARROW_HEAD_OPTIONS, DEFAULT_ARROW_END_HEAD, DEFAULT_ARROW_START_HEAD } from './arrowheadGeometry.js';

function HeadOptions() {
  useUiLocale();
  return <><optgroup label={ui("화살표 모양")}>{ARROW_HEAD_OPTIONS.filter(option => !option.group).map(({value,label}) => <option key={value} value={value}>{ui(label)}</option>)}</optgroup><optgroup label={ui("ERD 관계")}>{ARROW_HEAD_OPTIONS.filter(option => option.group).map(({value,label}) => <option key={value} value={value}>{ui(label)}</option>)}</optgroup></>;
}

export default function ArrowHeadControls({ item, onChange, className = '' }) {
  useUiLocale();
  return <div className={`arrow-head-controls${className ? ` ${className}` : ''}`} aria-label={ui("화살표 머리 모양")}>
    <label><span>{ui("시작 머리")}<ArrowHeadPreview type={item?.startHead || DEFAULT_ARROW_START_HEAD} visualStyle={item?.visualStyle} start /></span><select value={item?.startHead || DEFAULT_ARROW_START_HEAD} onChange={(event) => onChange('startHead', event.target.value)} aria-label={ui("시작 화살표 머리 모양")}><HeadOptions /></select></label>
    <label><span>{ui("끝 머리")}<ArrowHeadPreview type={item?.endHead || DEFAULT_ARROW_END_HEAD} visualStyle={item?.visualStyle} /></span><select value={item?.endHead || DEFAULT_ARROW_END_HEAD} onChange={(event) => onChange('endHead', event.target.value)} aria-label={ui("끝 화살표 머리 모양")}><HeadOptions /></select></label>
    {(item?.kind === 'connector' || [item?.startHead,item?.endHead].some(value => value?.startsWith('erd-'))) && <small className="inspector-hint">{ui("ERD 관계는 시작과 끝에서 각각 선택합니다. 각 끝은 반대편 객체 하나에 연결될 수 있는 개수를 나타냅니다.")}</small>}
    {(item?.kind || item?.headSize != null) && <div className="object-size-controls arrow-head-size"><SizeInput label={ui("머리 크기")} value={item?.headSize ?? (item?.kind === 'connector' ? Math.max(8, Math.min(15, 6 + (Number(item.strokeWidth) || 1.5) * 2.5)) : 17)} min={2} max={128} onCommit={value => onChange('headSize', value)} /></div>}
  </div>;
}
