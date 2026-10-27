import { useEffect, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { chartNumber, formatChartData, parseChartData } from './chartData.js';
import './chart.css';

const labels = [['bar', '막대 그래프'], ['line', '선 그래프'], ['area', '영역 그래프'], ['pie', '원 그래프'], ['donut', '도넛 그래프'], ['scatter', '산점도']];

export default function ChartControls({ item, onChange }) {
  useUiLocale();
  const source = formatChartData(item.columns, item.rows);
  const [baseline, setBaseline] = useState(source), [draft, setDraft] = useState(source), [error, setError] = useState('');
  const dirty = draft !== baseline;
  const conflict = dirty && source !== baseline;
  useEffect(() => { if (!dirty) { setBaseline(source); setDraft(source); } }, [source, dirty]);
  const reload = () => { setBaseline(source); setDraft(source); setError(''); };
  const apply = () => {
    if (conflict) return;
    try {
      const next = parseChartData(draft);
      if (next.rows.some(row => row.slice(1).some(value => value.trim() && chartNumber(value) === null))) throw new Error('숫자 열에는 유한한 숫자를 입력하세요.');
      if (onChange(next) === false) return;
      const formatted = formatChartData(next.columns, next.rows);
      setBaseline(formatted); setDraft(formatted); setError('');
    } catch (failure) { setError(failure.message); }
  };
  return <section className="inspector-section chart-editor">
    <strong className="inspector-label">{ui('그래프 설정')}</strong>
    <label>{ui('그래프 종류')}<select aria-label={ui('그래프 종류')} value={item.chartType || 'bar'} onChange={event => onChange({ chartType: event.target.value })}>{labels.map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
    <label>{ui('제목')}<input aria-label={ui('그래프 제목')} maxLength={120} value={item.title || ''} onChange={event => onChange({ title: event.target.value })} /></label>
    <label>{ui('데이터 (CSV 또는 탭으로 구분)')}<textarea aria-label={ui('그래프 데이터')} value={draft} maxLength={32768} onChange={event => { setDraft(event.target.value); setError(''); }} spellCheck="false" /></label>
    <small>{ui('첫 행은 열 이름, 첫 열은 항목입니다. 나머지 열에 숫자를 입력하세요.')}</small>
    {(item.chartType === 'pie' || item.chartType === 'donut') && <small>{ui('원형 그래프는 첫 번째 숫자 열의 양수만 표시합니다.')}</small>}
    {item.chartType === 'scatter' && <small>{ui('산점도는 첫 열을 X 값으로 사용합니다.')}</small>}
    {conflict && <small role="alert">{ui('다른 사용자가 데이터를 변경했습니다. 최신 데이터를 불러온 뒤 다시 편집하세요.')}</small>}
    {error && <small role="alert">{ui(error)}</small>}
    <div className="chart-editor-actions"><button type="button" disabled={!dirty || conflict} onClick={apply}>{ui('데이터 적용')}</button>{(dirty || conflict) && <button type="button" onClick={reload}>{ui('최신 데이터 불러오기')}</button>}</div>
  </section>;
}
