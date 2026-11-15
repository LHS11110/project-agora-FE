import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { readObjectStyle, writeObjectStylePatch } from '../../../canvas/styling/objectStyleModel.js';

export default function ConnectorAdvancedSection({ items, targetIds, onPatchStyle }) {
  useUiLocale();
  if (!targetIds.length) return null;
  const primaryItem = items[targetIds[0]];
  if (primaryItem?.kind !== 'connector') return null;

  const style = readObjectStyle(primaryItem);
  const c = style.connector;
  const ls = c.labelStyle || {};

  const updateConnectorStyle = (patch) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({
      ...cur,
      connector: { ...cur.connector, ...patch },
    })));
  };

  const updateLabelStyle = (patch) => {
    updateConnectorStyle({ labelStyle: { ...c.labelStyle, ...patch } });
  };

  return (
    <section className="inspector-section inspector-style-connector">
      <strong className="inspector-label">{ui('연결선 경로 · 흐름 · 라벨 스타일')}</strong>
      <div className="inspector-grid-2">
        <label className="inspector-mini-field">
          <span>{ui('선 경로 방식')}</span>
          <select
            aria-label={ui('연결선 경로 방식')}
            value={c.routing}
            onChange={(e) => updateConnectorStyle({ routing: e.target.value })}
          >
            <option value="curved">{ui('곡선 (Curved)')}</option>
            <option value="straight">{ui('직선 (Straight)')}</option>
            <option value="orthogonal">{ui('직각 (Orthogonal)')}</option>
          </select>
        </label>
        <label className="inspector-mini-field">
          <span>{ui('점선 흐름 애니메이션')}</span>
          <select
            aria-label={ui('연결선 흐름 애니메이션')}
            value={c.dashAnimation}
            onChange={(e) => {
              const mode = e.target.value;
              onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({
                ...cur,
                connector: { ...cur.connector, dashAnimation: mode },
                ...(mode !== 'none' && cur.stroke.dashPattern === 'solid'
                  ? { stroke: { ...cur.stroke, explicit: true, dashPattern: 'dashed' } }
                  : {}),
              })));
            }}
          >
            <option value="none">{ui('없음')}</option>
            <option value="forward">{ui('정방향 흐름 →')}</option>
            <option value="reverse">{ui('역방향 흐름 ←')}</option>
          </select>
        </label>
      </div>

      {c.dashAnimation !== 'none' && (
        <div style={{ marginTop: 6 }}>
          <div className="zoom-sensitivity-heading">
            <span>{ui('흐름 속도')}</span>
            <span>{c.animationSpeed}x</span>
          </div>
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.25"
            aria-label={ui('흐름 속도')}
            value={c.animationSpeed}
            onChange={(e) => updateConnectorStyle({ animationSpeed: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="inspector-grid-4" style={{ marginTop: 8 }}>
        <label className="inspector-mini-field">
          <span>{ui('라벨 배경')}</span>
          <input
            type="color"
            aria-label={ui('라벨 배경 색상')}
            value={ls.background || '#ffffff'}
            onChange={(e) => updateLabelStyle({ background: e.target.value })}
          />
        </label>
        <label className="inspector-mini-field">
          <span>{ui('라벨 글자')}</span>
          <input
            type="color"
            aria-label={ui('라벨 글자 색상')}
            value={ls.color || '#1f2937'}
            onChange={(e) => updateLabelStyle({ color: e.target.value })}
          />
        </label>
        <label className="inspector-mini-field">
          <span>{ui('라벨 테두리')}</span>
          <input
            type="color"
            aria-label={ui('라벨 테두리 색상')}
            value={ls.borderColor || '#cbd5e1'}
            onChange={(e) => updateLabelStyle({ borderColor: e.target.value })}
          />
        </label>
        <label className="inspector-mini-field">
          <span>{ui('알약형')}</span>
          <button
            type="button"
            className="inspector-icon-mini"
            aria-pressed={ls.pill !== false}
            onClick={() => updateLabelStyle({ pill: ls.pill === false })}
            style={{ width: '100%' }}
          >
            {ls.pill !== false ? ui('둥금') : ui('각짐')}
          </button>
        </label>
      </div>
    </section>
  );
}
