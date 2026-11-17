import { useId } from 'react';
import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { BLEND_MODES, readObjectStyle, writeObjectStylePatch } from '../../../canvas/styling/objectStyleModel.js';

export default function LayoutGeometrySection({
  items,
  targetIds,
  intersection,
  canApplyAutoLayout,
  onPatchStyle,
  onApplyAutoLayout,
}) {
  useUiLocale();
  const fieldId = useId();
  if (!targetIds.length) return null;
  const primaryItem = items[targetIds[0]];
  const style = readObjectStyle(primaryItem);
  const caps = intersection.capabilities || {};
  const mixed = intersection.mixed || {};
  const c = style.cornerRadius;
  const al = style.autoLayout;

  const updateCorner = (updater) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => {
      const nextCorner = updater(cur.cornerRadius, cur);
      return { ...cur, cornerRadius: { ...cur.cornerRadius, ...nextCorner, explicit: true } };
    }));
  };

  const updateAutoLayout = (patch) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({
      ...cur,
      autoLayout: { ...cur.autoLayout, ...patch },
    })));
  };

  const opacityPct = Math.round((style.opacity ?? 1) * 100);

  return (
    <section className="inspector-section inspector-style-layout">
      <strong className="inspector-label">
        {ui('투명도 · 블렌드 · 모서리')}
        {(mixed.opacity || mixed.blendMode) && <span className="inspector-mixed-badge">{ui('혼합')}</span>}
      </strong>

      <div className="zoom-sensitivity-heading">
        <span>{ui('객체 투명도')}</span>
        <span>{opacityPct}%</span>
      </div>
      <input
        id={`${fieldId}-opacity`}
        name="style-object-opacity"
        type="range"
        min="0"
        max="100"
        step="1"
        aria-label={ui('객체 자체 투명도')}
        value={opacityPct}
        onChange={(e) => {
          const nextOpacity = Math.max(0, Math.min(1, Number(e.target.value) / 100));
          onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({ ...cur, opacity: nextOpacity })));
        }}
      />

      {caps.blendMode && (
        <div className="inspector-mini-field" style={{ marginTop: 6 }}>
          <span>{ui('블렌드 모드')}</span>
          <select
            id={`${fieldId}-blend-mode`}
            name="style-blend-mode"
            aria-label={ui('객체 블렌드 모드')}
            value={style.blendMode}
            onChange={(e) => onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({ ...cur, blendMode: e.target.value })))}
          >
            {BLEND_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
        </div>
      )}

      {caps.cornerRadius && (
        <div style={{ marginTop: 10 }}>
          <div className="inspector-layer-head">
            <strong className="inspector-label">
              {ui('모서리 곡률 (px)')}
              {mixed.cornerRadius && <span className="inspector-mixed-badge">{ui('혼합')}</span>}
            </strong>
            <button
              type="button"
              className="inspector-icon-mini"
              aria-pressed={!c.linked}
              title={c.linked ? ui('4개 모서리 개별 지정') : ui('전체 모서리 통일')}
              onClick={() => updateCorner((cur) => ({ linked: !cur.linked }))}
            >
              {c.linked ? '⊞' : '⊡'}
            </button>
          </div>
          {c.linked ? (
            <>
              <div className="object-size-controls" style={{ marginTop: 4 }}>
                <label className="inspector-mini-field" style={{ gridColumn: '1 / -1' }}>
                  <span>{ui('전체 둥글기')}</span>
                  <input
                    id={`${fieldId}-corner-all`}
                    name="style-corner-all"
                    type="number"
                    min="0"
                    max="240"
                    aria-label={ui('전체 모서리 곡률')}
                    value={c.tl}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(240, Number(e.target.value) || 0));
                      updateCorner(() => ({ linked: true, tl: v, tr: v, br: v, bl: v }));
                    }}
                  />
                </label>
              </div>
              <input
                id={`${fieldId}-corner-slider`}
                name="style-corner-slider"
                type="range"
                min="0"
                max="120"
                step="1"
                aria-label={ui('모서리 곡률 슬라이더')}
                value={Math.min(120, c.tl)}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(240, Number(e.target.value) || 0));
                  updateCorner(() => ({ linked: true, tl: v, tr: v, br: v, bl: v }));
                }}
              />
            </>
          ) : (
            <div className="inspector-grid-4">
              {[['tl', ui('좌상 TL')], ['tr', ui('우상 TR')], ['br', ui('우하 BR')], ['bl', ui('좌하 BL')]].map(([key, label]) => (
                <label key={key} className="inspector-mini-field">
                  <span>{label}</span>
                  <input
                    id={`${fieldId}-corner-${key}`}
                    name={`style-corner-${key}`}
                    type="number"
                    min="0"
                    max="240"
                    aria-label={label}
                    value={c[key]}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(240, Number(e.target.value) || 0));
                      updateCorner(() => ({ linked: false, [key]: v }));
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {caps.autoLayout && (
        <div style={{ marginTop: 12 }}>
          <div className="inspector-switch-row">
            <span>
              <strong>{ui('오토 레이아웃')}</strong>
              <small>{ui('내부 여백·간격·정렬 및 자동 크기')}</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-label={ui('오토 레이아웃 활성화')}
              aria-checked={al.enabled}
              className={`toggle-switch${al.enabled ? ' on' : ''}`}
              onClick={() => updateAutoLayout({ enabled: !al.enabled })}
            >
              <i />
            </button>
          </div>
          {al.enabled && (
            <div className="inspector-layer-card" style={{ marginTop: 6 }}>
              <div className="inspector-grid-2">
                <label className="inspector-mini-field">
                  <span>{ui('방향')}</span>
                  <select
                    id={`${fieldId}-autolayout-direction`}
                    name="style-autolayout-direction"
                    aria-label={ui('오토 레이아웃 방향')}
                    value={al.direction}
                    onChange={(e) => updateAutoLayout({ direction: e.target.value })}
                  >
                    <option value="row">{ui('가로 (Row)')}</option>
                    <option value="column">{ui('세로 (Column)')}</option>
                    <option value="wrap">{ui('줄바꿈 (Wrap)')}</option>
                  </select>
                </label>
                <label className="inspector-mini-field">
                  <span>{ui('요소 간격 (Gap)')}</span>
                  <input
                    id={`${fieldId}-autolayout-gap`}
                    name="style-autolayout-gap"
                    type="number"
                    min="0"
                    max="120"
                    aria-label={ui('오토 레이아웃 간격')}
                    value={al.gap}
                    onChange={(e) => updateAutoLayout({ gap: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })}
                  />
                </label>
              </div>
              <div className="inspector-grid-4">
                {[
                  ['paddingTop', ui('상 P-T')],
                  ['paddingRight', ui('우 P-R')],
                  ['paddingBottom', ui('하 P-B')],
                  ['paddingLeft', ui('좌 P-L')],
                ].map(([field, label]) => (
                  <label key={field} className="inspector-mini-field">
                    <span>{label}</span>
                    <input
                      id={`${fieldId}-autolayout-${field}`}
                      name={`style-autolayout-${field}`}
                      type="number"
                      min="0"
                      max="120"
                      aria-label={label}
                      value={al[field]}
                      onChange={(e) => updateAutoLayout({ [field]: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })}
                    />
                  </label>
                ))}
              </div>
              <div className="inspector-grid-2">
                <label className="inspector-mini-field">
                  <span>{ui('교차 정렬')}</span>
                  <select
                    id={`${fieldId}-autolayout-align`}
                    name="style-autolayout-align"
                    aria-label={ui('오토 레이아웃 교차 정렬')}
                    value={al.alignItems}
                    onChange={(e) => updateAutoLayout({ alignItems: e.target.value })}
                  >
                    <option value="flex-start">{ui('시작')}</option>
                    <option value="center">{ui('가운데')}</option>
                    <option value="flex-end">{ui('끝')}</option>
                    <option value="stretch">{ui('늘리기 (Fill)')}</option>
                  </select>
                </label>
                <label className="inspector-mini-field">
                  <span>{ui('주축 분배')}</span>
                  <select
                    id={`${fieldId}-autolayout-justify`}
                    name="style-autolayout-justify"
                    aria-label={ui('오토 레이아웃 분배')}
                    value={al.justifyContent}
                    onChange={(e) => updateAutoLayout({ justifyContent: e.target.value })}
                  >
                    <option value="flex-start">{ui('시작')}</option>
                    <option value="center">{ui('가운데')}</option>
                    <option value="flex-end">{ui('끝')}</option>
                    <option value="space-between">{ui('균등 배분')}</option>
                  </select>
                </label>
              </div>
              <div className="inspector-grid-2">
                <label className="inspector-mini-field">
                  <span>{ui('너비 크기')}</span>
                  <select
                    id={`${fieldId}-autolayout-width-mode`}
                    name="style-autolayout-width-mode"
                    aria-label={ui('오토 레이아웃 너비 동작')}
                    value={al.widthMode}
                    onChange={(e) => updateAutoLayout({ widthMode: e.target.value })}
                  >
                    <option value="fixed">{ui('고정 (Fixed)')}</option>
                    <option value="hug">{ui('내용 맞춤 (Hug)')}</option>
                    <option value="fill">{ui('채우기 (Fill)')}</option>
                  </select>
                </label>
                <label className="inspector-mini-field">
                  <span>{ui('높이 크기')}</span>
                  <select
                    id={`${fieldId}-autolayout-height-mode`}
                    name="style-autolayout-height-mode"
                    aria-label={ui('오토 레이아웃 높이 동작')}
                    value={al.heightMode}
                    onChange={(e) => updateAutoLayout({ heightMode: e.target.value })}
                  >
                    <option value="fixed">{ui('고정 (Fixed)')}</option>
                    <option value="hug">{ui('내용 맞춤 (Hug)')}</option>
                    <option value="fill">{ui('채우기 (Fill)')}</option>
                  </select>
                </label>
              </div>
              {canApplyAutoLayout && onApplyAutoLayout && (
                <button
                  type="button"
                  className="inspector-secondary-action"
                  onClick={() => onApplyAutoLayout(targetIds[0])}
                >
                  {ui('내부 하위 객체 자동 정렬 적용')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
