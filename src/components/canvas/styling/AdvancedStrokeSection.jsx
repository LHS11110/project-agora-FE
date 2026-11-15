import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { readObjectStyle, writeObjectStylePatch } from '../../../canvas/styling/objectStyleModel.js';

export default function AdvancedStrokeSection({ items, targetIds, onPatchStyle }) {
  useUiLocale();
  if (!targetIds.length) return null;
  const primaryItem = items[targetIds[0]];
  const style = readObjectStyle(primaryItem);
  const stroke = style.stroke;

  const updateStroke = (updater) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => {
      const patch = typeof updater === 'function' ? updater(cur.stroke, cur) : updater;
      return {
        ...cur,
        stroke: { ...cur.stroke, ...patch, explicit: true },
      };
    }));
  };

  return (
    <section className="inspector-section inspector-style-stroke">
      <div className="inspector-switch-row">
        <span>
          <strong>{ui('고급 선 / 테두리 (Stroke)')}</strong>
          <small>{ui('4면 개별 두께 · 기준선 · 점선 · 끝 모양')}</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-label={ui('고급 테두리 표시')}
          aria-checked={stroke.enabled}
          className={`toggle-switch${stroke.enabled ? ' on' : ''}`}
          onClick={() => updateStroke((cur) => ({ enabled: !cur.enabled }))}
        >
          <i />
        </button>
      </div>

      {stroke.enabled && (
        <div className="inspector-layer-card" style={{ marginTop: 6 }}>
          <div className="inspector-grid-2">
            <label className="inspector-mini-field">
              <span>{ui('선 색상')}</span>
              <input
                type="color"
                aria-label={ui('고급 테두리 색상')}
                value={stroke.color}
                onChange={(e) => updateStroke({ color: e.target.value })}
              />
            </label>
            <label className="inspector-mini-field">
              <span>{ui('기준선 (Align)')}</span>
              <select
                aria-label={ui('테두리 기준선')}
                value={stroke.align}
                onChange={(e) => updateStroke({ align: e.target.value })}
              >
                <option value="center">{ui('중앙 (Center)')}</option>
                <option value="inside">{ui('안쪽 (Inside)')}</option>
                <option value="outside">{ui('바깥쪽 (Outside)')}</option>
              </select>
            </label>
          </div>

          <div className="inspector-layer-head">
            <span style={{ fontSize: 9, color: 'var(--ink-muted)' }}>{ui('두께 (px)')}</span>
            <button
              type="button"
              className="inspector-icon-mini"
              aria-pressed={!stroke.sides.linked}
              title={stroke.sides.linked ? ui('상하좌우 개별 두께 지정') : ui('전체 두께 통일')}
              onClick={() => updateStroke((cur) => ({
                sides: { ...cur.sides, linked: !cur.sides.linked },
              }))}
            >
              {stroke.sides.linked ? '⊞' : '⊡'}
            </button>
          </div>

          {stroke.sides.linked ? (
            <label className="inspector-mini-field">
              <input
                type="number"
                min="0.5"
                max="64"
                step="0.5"
                aria-label={ui('전체 선 두께')}
                value={stroke.width}
                onChange={(e) => {
                  const w = Math.max(0.5, Math.min(64, Number(e.target.value) || 1));
                  updateStroke({
                    width: w,
                    sides: { linked: true, top: w, right: w, bottom: w, left: w },
                  });
                }}
              />
            </label>
          ) : (
            <div className="inspector-grid-4">
              {[['top', ui('상 T')], ['right', ui('우 R')], ['bottom', ui('하 B')], ['left', ui('좌 L')]].map(([side, label]) => (
                <label key={side} className="inspector-mini-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max="32"
                    step="0.5"
                    aria-label={label}
                    value={stroke.sides[side]}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(32, Number(e.target.value) || 0));
                      updateStroke((cur) => ({
                        sides: { ...cur.sides, linked: false, [side]: v },
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="inspector-grid-2">
            <label className="inspector-mini-field">
              <span>{ui('선 패턴')}</span>
              <select
                aria-label={ui('점선 패턴')}
                value={stroke.dashPattern}
                onChange={(e) => updateStroke({ dashPattern: e.target.value })}
              >
                <option value="solid">{ui('실선 (Solid)')}</option>
                <option value="dashed">{ui('점선 (Dashed)')}</option>
                <option value="dotted">{ui('도트 (Dotted)')}</option>
                <option value="custom">{ui('사용자 지정')}</option>
              </select>
            </label>
            {stroke.dashPattern !== 'solid' && (
              <div className="inspector-grid-2" style={{ marginTop: 0 }}>
                <label className="inspector-mini-field">
                  <span>{ui('길이 (Dash)')}</span>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    aria-label={ui('점선 길이')}
                    value={stroke.dash}
                    onChange={(e) => updateStroke({ dash: Math.max(1, Math.min(64, Number(e.target.value) || 1)) })}
                  />
                </label>
                <label className="inspector-mini-field">
                  <span>{ui('간격 (Gap)')}</span>
                  <input
                    type="number"
                    min="0"
                    max="64"
                    aria-label={ui('점선 간격')}
                    value={stroke.gap}
                    onChange={(e) => updateStroke({ gap: Math.max(0, Math.min(64, Number(e.target.value) || 0)) })}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="inspector-grid-2">
            <label className="inspector-mini-field">
              <span>{ui('선 끝 모양 (Cap)')}</span>
              <select
                aria-label={ui('선 끝 모양')}
                value={stroke.cap}
                onChange={(e) => updateStroke({ cap: e.target.value })}
              >
                <option value="butt">{ui('직각 (Butt)')}</option>
                <option value="round">{ui('둥글게 (Round)')}</option>
                <option value="square">{ui('사각 (Square)')}</option>
              </select>
            </label>
            <label className="inspector-mini-field">
              <span>{ui('꺾임 (Join)')}</span>
              <select
                aria-label={ui('선 꺾임 처리')}
                value={stroke.join}
                onChange={(e) => updateStroke({ join: e.target.value })}
              >
                <option value="miter">{ui('뾰족하게 (Miter)')}</option>
                <option value="round">{ui('둥글게 (Round)')}</option>
                <option value="bevel">{ui('모따기 (Bevel)')}</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
