import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { SizeInput } from './ObjectSizeControls.jsx';
import { objectShadow } from './objectShadow.js';
import './object-shadow-controls.css';

export default function ObjectShadowControls({ ids, items, onChange }) {
  useUiLocale();
  const shadow = objectShadow(items[ids[0]]);
  const update = (field, value) => onChange(ids, field, value);
  return <section className="inspector-section object-shadow-controls">
    <div className="object-shadow-heading"><strong className="inspector-label">{ui("그림자")}</strong><button type="button" className={`toggle-switch${shadow.enabled ? ' on' : ''}`} role="switch" aria-label={ui("객체 그림자")} aria-checked={shadow.enabled} onClick={() => update('shadowEnabled', !shadow.enabled)}><i /></button></div>
    {shadow.enabled && <div className="object-shadow-fields">
      <label><span>{ui("농도")}</span><input type="range" aria-label={ui("그림자 농도")} min="0" max="100" step="1" value={Math.round(shadow.opacity * 100)} onChange={e => update('shadowOpacity', Number(e.target.value) / 100)} /><output>{Math.round(shadow.opacity * 100)}%</output></label>
      <label><span>{ui("흐림")}</span><input type="range" aria-label={ui("그림자 흐림")} min="0" max="24" step="1" value={shadow.blur} onChange={e => update('shadowBlur', Number(e.target.value))} /><output>{shadow.blur}px</output></label>
      <div className="object-size-controls"><SizeInput label={ui("그림자 농도")} value={Math.round(shadow.opacity * 100)} min={0} max={100} unit="%" onCommit={value => update('shadowOpacity', value / 100)} /><SizeInput label={ui("그림자 흐림")} value={shadow.blur} min={0} max={24} step={.1} onCommit={value => update('shadowBlur', value)} /></div>
      <div className="object-shadow-offsets">{[['X', 'shadowOffsetX', shadow.x], ['Y', 'shadowOffsetY', shadow.y]].map(([label, field, value]) => <label key={field}><span>{label}</span><input aria-label={ui("그림자 {v0} 위치", {
  v0: label
})} type="number" min="-24" max="24" step="1" value={value} onChange={e => { if (e.target.value !== '') update(field, Number(e.target.value)); }} /><span>px</span></label>)}</div>
    </div>}
  </section>;
}
