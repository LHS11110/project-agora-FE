import { GRAPHICS_PROFILES } from './graphicsQuality.js';

export default function GraphicsQualityControls({ value, onChange }) {
  return <section className="inspector-section graphics-quality-controls">
    <strong className="inspector-label">그래픽 품질</strong>
    <div className="theme-switch" role="group" aria-label="그래픽 품질 선택">
      {Object.entries(GRAPHICS_PROFILES).map(([key, profile]) => <button type="button" key={key}
        className={value === key ? 'active' : ''} aria-pressed={value === key}
        onClick={() => onChange(key)}>{profile.label}</button>)}
    </div>
    <small className="inspector-hint">{GRAPHICS_PROFILES[value].description}</small>
    <small className="inspector-hint">이 기기에 저장되며 객체와 다른 참여자의 설정은 유지됩니다.</small>
  </section>;
}
