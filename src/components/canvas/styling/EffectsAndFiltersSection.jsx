import { useEffect, useState } from 'react';
import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import {
  DEFAULT_FILTERS,
  readObjectStyle,
  writeObjectStylePatch,
  normalizeEffect,
} from '../../../canvas/styling/objectStyleModel.js';

export default function EffectsAndFiltersSection({ items, targetIds, onPatchStyle }) {
  useUiLocale();
  const primaryItem = targetIds.length ? items[targetIds[0]] : null;
  const style = readObjectStyle(primaryItem || {});
  const [cssDraft, setCssDraft] = useState(style.customCss || '');

  useEffect(() => {
    setCssDraft(style.customCss || '');
  }, [targetIds[0], style.customCss]);

  if (!targetIds.length) return null;

  const commitEffects = (buildNextEffects) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({
      ...cur,
      explicitEffects: true,
      effects: buildNextEffects(cur.effects || [], cur).map((fx, idx) => normalizeEffect(fx, idx)),
    })));
  };

  const addEffect = (type = 'drop-shadow') => {
    commitEffects((cur) => [
      ...cur,
      normalizeEffect({
        id: `fx-${Date.now()}`,
        enabled: true,
        type,
        color: type === 'inner-shadow' ? '#ffffff' : '#18222b',
        opacity: type === 'inner-shadow' ? 0.35 : 0.22,
        x: 0,
        y: type.includes('blur') ? 0 : 6,
        blur: type.includes('blur') ? 12 : 14,
        spread: 0,
      }, cur.length),
    ]);
  };

  const updateEffect = (index, patch) => {
    commitEffects((cur) => cur.map((fx, idx) => (idx === index ? { ...fx, ...patch } : fx)));
  };

  const updateFilter = (field, value) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({
      ...cur,
      filters: { ...cur.filters, [field]: Number(value) },
    })));
  };

  return (
    <section className="inspector-section inspector-style-effects">
      <div className="inspector-layer-head">
        <strong className="inspector-label">{ui('다중 효과 (Effects)')}</strong>
        <button
          type="button"
          className="inspector-icon-mini"
          aria-label={ui('효과 추가')}
          title={ui('효과 추가')}
          onClick={() => addEffect('drop-shadow')}
        >
          +
        </button>
      </div>

      <div className="inspector-layer-stack">
        {style.effects.map((fx, idx) => (
          <div key={fx.id || idx} className="inspector-layer-card">
            <div className="inspector-layer-head">
              <button
                type="button"
                className="inspector-icon-mini"
                aria-label={ui('효과 사용 전환')}
                aria-pressed={fx.enabled !== false}
                onClick={() => updateEffect(idx, { enabled: fx.enabled === false })}
              >
                {fx.enabled === false ? '○' : '●'}
              </button>
              <select
                aria-label={ui('효과 유형')}
                value={fx.type}
                onChange={(e) => updateEffect(idx, { type: e.target.value })}
              >
                <option value="drop-shadow">{ui('외부 그림자 (Drop Shadow)')}</option>
                <option value="inner-shadow">{ui('내부 그림자 (Inner Shadow)')}</option>
                <option value="layer-blur">{ui('레이어 블러 (Layer Blur)')}</option>
                <option value="background-blur">{ui('배경 블러 (Glass Blur)')}</option>
              </select>
              <button
                type="button"
                className="inspector-icon-mini"
                aria-label={ui('효과 삭제')}
                onClick={() => commitEffects((cur) => cur.filter((_, j) => j !== idx))}
              >
                ×
              </button>
            </div>

            {fx.type.includes('shadow') && (
              <div className="inspector-grid-4">
                <label className="inspector-mini-field">
                  <span>{ui('색상')}</span>
                  <input type="color" aria-label={ui('그림자 색상')} value={fx.color} onChange={(e) => updateEffect(idx, { color: e.target.value })} />
                </label>
                <label className="inspector-mini-field">
                  <span>X</span>
                  <input type="number" min="-48" max="48" aria-label={ui('그림자 X')} value={fx.x} onChange={(e) => updateEffect(idx, { x: Number(e.target.value) || 0 })} />
                </label>
                <label className="inspector-mini-field">
                  <span>Y</span>
                  <input type="number" min="-48" max="48" aria-label={ui('그림자 Y')} value={fx.y} onChange={(e) => updateEffect(idx, { y: Number(e.target.value) || 0 })} />
                </label>
                <label className="inspector-mini-field">
                  <span>Blur</span>
                  <input type="number" min="0" max="64" aria-label={ui('그림자 흐림')} value={fx.blur} onChange={(e) => updateEffect(idx, { blur: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
                <label className="inspector-mini-field" style={{ gridColumn: '1 / 3' }}>
                  <span>{ui('투명도')} ({Math.round(fx.opacity * 100)}%)</span>
                  <input type="range" min="0" max="100" aria-label={ui('그림자 투명도')} value={Math.round(fx.opacity * 100)} onChange={(e) => updateEffect(idx, { opacity: Number(e.target.value) / 100 })} />
                </label>
                <label className="inspector-mini-field" style={{ gridColumn: '3 / 5' }}>
                  <span>{ui('퍼짐 (Spread)')}</span>
                  <input type="number" min="-24" max="32" aria-label={ui('그림자 퍼짐')} value={fx.spread} onChange={(e) => updateEffect(idx, { spread: Number(e.target.value) || 0 })} />
                </label>
              </div>
            )}

            {fx.type.includes('blur') && (
              <label className="inspector-mini-field">
                <span>{ui('블러 강도')} ({fx.blur}px)</span>
                <input
                  type="range"
                  min="0"
                  max="48"
                  aria-label={ui('블러 강도')}
                  value={fx.blur}
                  onChange={(e) => updateEffect(idx, { blur: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="inspector-layer-head">
          <strong className="inspector-label">{ui('CSS 필터')}</strong>
          <button
            type="button"
            className="inspector-icon-mini"
            title={ui('필터 초기화')}
            aria-label={ui('필터 초기화')}
            onClick={() => onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({ ...cur, filters: { ...DEFAULT_FILTERS } })))}
          >
            ↺
          </button>
        </div>
        {[
          ['brightness', ui('밝기'), 0, 200, '%'],
          ['contrast', ui('대비'), 0, 200, '%'],
          ['saturate', ui('채도'), 0, 200, '%'],
          ['grayscale', ui('흑백'), 0, 100, '%'],
          ['sepia', ui('세피아'), 0, 100, '%'],
          ['hueRotate', ui('색조 회전'), -180, 180, '°'],
        ].map(([field, label, min, max, unit]) => (
          <div key={field} style={{ marginTop: 4 }}>
            <div className="zoom-sensitivity-heading">
              <span>{label}</span>
              <span>{style.filters[field]}{unit}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              aria-label={label}
              value={style.filters[field]}
              onChange={(e) => updateFilter(field, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <strong className="inspector-label">{ui('커스텀 인라인 CSS')}</strong>
        <textarea
          className="inspector-css-textarea"
          aria-label={ui('커스텀 인라인 CSS 입력')}
          placeholder="border-style: double; letter-spacing: 1px;"
          value={cssDraft}
          onChange={(e) => setCssDraft(e.target.value)}
        />
        <div className="inspector-grid-2">
          <button
            type="button"
            className="inspector-secondary-action"
            onClick={() => onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({ ...cur, customCss: cssDraft })))}
          >
            {ui('CSS 적용')}
          </button>
          <button
            type="button"
            className="inspector-secondary-action"
            onClick={() => {
              setCssDraft('');
              onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({ ...cur, customCss: '' })));
            }}
          >
            {ui('CSS 초기화')}
          </button>
        </div>
      </div>
    </section>
  );
}
