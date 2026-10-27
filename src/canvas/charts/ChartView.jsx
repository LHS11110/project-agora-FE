import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { chartDataset, chartNumber, CHART_COLORS } from './chartData.js';
import './chart.css';

const WIDTH = 400, HEIGHT = 240, LEFT = 46, RIGHT = 14, TOP = 18, BOTTOM = 45;
const W = WIDTH - LEFT - RIGHT, H = HEIGHT - TOP - BOTTOM;
const numberLabel = value => Number(value.toPrecision(4)).toString();
function polar(cx, cy, r, angle) { return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }; }
function sector(cx, cy, outer, inner, start, end) {
  const epsilon = .00001, finish = Math.min(end, start + Math.PI * 2 - epsilon);
  const a = polar(cx, cy, outer, start), b = polar(cx, cy, outer, finish), large = finish - start > Math.PI ? 1 : 0;
  if (!inner) return `M ${cx} ${cy} L ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} Z`;
  const c = polar(cx, cy, inner, finish), d = polar(cx, cy, inner, start);
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
}

export default function ChartView({ item }) {
  useUiLocale();
  const { columns, rows } = chartDataset(item);
  const type = item.chartType || 'bar';
  const series = columns.slice(1).map((name, index) => ({ name: name || ui('계열 {count}', { count: index + 1 }), color: CHART_COLORS[index % CHART_COLORS.length], values: rows.map(row => chartNumber(row[index + 1])) }));
  const chartRows = rows.map((row, index) => ({ label: row[0] || String(index + 1), x: chartNumber(row[0]), index }));
  const isPie = type === 'pie' || type === 'donut';
  const hasData = isPie ? series[0]?.values.some(value => value !== null && value > 0)
    : type === 'scatter' ? chartRows.some((row, i) => row.x !== null && series.some(s => s.values[i] !== null))
      : series.some(s => s.values.some(value => value !== null));
  const values = series.flatMap(s => s.values.filter(value => value !== null));
  const low = Math.min(0, ...values), high = Math.max(0, ...values) || (low === 0 ? 1 : 0);
  const span = high - low || 1;
  const y = value => TOP + H * (high - value) / span;
  const baseY = y(0);
  const xvalues = chartRows.map(row => row.x).filter(value => value !== null);
  const xMin = Math.min(...xvalues), xMax = Math.max(...xvalues), xSpan = xMax - xMin || 1;
  const pointX = index => type === 'scatter' ? LEFT + ((chartRows[index].x - xMin) / xSpan) * W
    : LEFT + (index + .5) * W / Math.max(1, rows.length);
  let angle = -Math.PI / 2;
  const pieValues = (series[0]?.values || []).map(value => value !== null && value > 0 ? value : 0);
  const total = pieValues.reduce((sum, value) => sum + value, 0);
  return <div className="chart-card" aria-label={ui('그래프')}>
    <div className="chart-card-heading"><strong>{item.title || ui('그래프')}</strong></div>
    {!hasData ? <div className="chart-empty">{ui('설정 패널에서 데이터를 입력하세요.')}</div> : <svg className="chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={item.title || ui('그래프')}>
      {isPie ? <>
        {pieValues.map((value, index) => { if (!value) return null; const start = angle; angle += value / total * Math.PI * 2; return <path key={index} d={sector(155, 112, 88, type === 'donut' ? 48 : 0, start, angle)} fill={CHART_COLORS[index % CHART_COLORS.length]}><title>{`${chartRows[index].label}: ${numberLabel(value)}`}</title></path>; })}
        {chartRows.slice(0, 8).map((row, index) => pieValues[index] > 0 && <g key={index}><rect x="263" y={27 + index * 22} width="9" height="9" rx="2" fill={CHART_COLORS[index % CHART_COLORS.length]} /><text x="278" y={35 + index * 22}>{row.label.slice(0, 13)}</text></g>)}
      </> : <>
        {[0, 1, 2, 3, 4].map(index => { const value = high - span * index / 4; return <g key={index}><line x1={LEFT} x2={LEFT + W} y1={TOP + H * index / 4} y2={TOP + H * index / 4} className="chart-grid" /><text x={LEFT - 6} y={TOP + H * index / 4 + 3} textAnchor="end">{numberLabel(value)}</text></g>; })}
        <line x1={LEFT} x2={LEFT + W} y1={baseY} y2={baseY} className="chart-axis" />
        {type !== 'scatter' && chartRows.map((row, index) => (rows.length <= 8 || index % Math.ceil(rows.length / 8) === 0) && <text key={index} x={pointX(index)} y={TOP + H + 17} textAnchor="middle">{row.label.slice(0, 10)}</text>)}
        {type === 'scatter' && [0, 1, 2, 3, 4].map(index => <text key={index} x={LEFT + W * index / 4} y={TOP + H + 17} textAnchor="middle">{numberLabel(xMin + xSpan * index / 4)}</text>)}
        {series.map((s, seriesIndex) => {
          if (type === 'bar') return s.values.map((value, index) => { if (value === null) return null; const band = W / Math.max(1, rows.length), bar = Math.min(30, band * .75 / series.length); return <rect key={`${seriesIndex}-${index}`} x={LEFT + band * index + band / 2 - bar * series.length / 2 + seriesIndex * bar} y={Math.min(y(value), baseY)} width={Math.max(.5, bar - 1)} height={Math.max(.5, Math.abs(baseY - y(value)))} fill={s.color}><title>{`${chartRows[index].label} · ${s.name}: ${numberLabel(value)}`}</title></rect>; });
          const runs = []; let run = [];
          s.values.forEach((value, index) => { if (value === null || (type === 'scatter' && chartRows[index].x === null)) { if (run.length) runs.push(run); run = []; } else run.push({ x: pointX(index), y: y(value), value, index }); }); if (run.length) runs.push(run);
          return <g key={seriesIndex}>{runs.map((points, index) => <g key={index}>
            {type === 'area' && points.length > 1 && <path d={`M ${points[0].x} ${baseY} ${points.map(point => `L ${point.x} ${point.y}`).join(' ')} L ${points.at(-1).x} ${baseY} Z`} fill={s.color} opacity=".18" />}
            {type !== 'scatter' && points.length > 1 && <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {points.map(point => <circle key={point.index} cx={point.x} cy={point.y} r="3" fill={s.color}><title>{`${chartRows[point.index].label} · ${s.name}: ${numberLabel(point.value)}`}</title></circle>)}
          </g>)}</g>;
        })}
        {series.slice(0, 5).map((s, index) => <g key={index} transform={`translate(${LEFT + index * 66} ${HEIGHT - 10})`}><rect width="8" height="8" rx="2" fill={s.color} /><text x="11" y="7">{s.name.slice(0, 8)}</text></g>)}
      </>}
    </svg>}
  </div>;
}
