import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { BLEND_MODES, readObjectStyle, writeObjectStylePatch, normalizeFillLayer } from '../../../canvas/styling/objectStyleModel.js';

export default function FillLayersSection({ items, targetIds, onPatchStyle }) {
  useUiLocale();
  if (!targetIds.length) return null;
  const primaryItem = items[targetIds[0]];
  const style = readObjectStyle(primaryItem);
  const layers = style.fills || [];

  const commitFills = (buildNextLayers) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => {
      const nextFills = buildNextLayers(cur.fills || [], cur).map((layer, idx) => normalizeFillLayer(layer, idx));
      return { ...cur, explicitFills: true, fills: nextFills };
    }));
  };

  const addLayer = (type = 'linear') => {
    commitFills((current) => [
      ...current,
      normalizeFillLayer(
        type === 'solid'
          ? { id: `fill-${Date.now()}`, type: 'solid', color: '#6366f1', opacity: 0.45, blendMode: 'normal' }
          : {
              id: `fill-${Date.now()}`,
              type: 'linear',
              angle: 135,
              stops: [{ color: '#818cf8', pos: 0 }, { color: '#f472b6', pos: 100 }],
              opacity: 0.9,
              blendMode: 'normal',
            },
        current.length
      ),
    ]);
  };

  const updateLayer = (index, patch) => {
    commitFills((current) => current.map((layer, idx) => (idx === index ? { ...layer, ...patch } : layer)));
  };

  const removeLayer = (index) => {
    commitFills((current) => current.filter((_, idx) => idx !== index));
  };

  const moveLayer = (index, delta) => {
    commitFills((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  return (
    <section className="inspector-section inspector-style-fills">
      <div className="inspector-layer-head">
        <strong className="inspector-label">{ui('다중 채우기 (Fill Layers)')}</strong>
        <button
          type="button"
          className="inspector-icon-mini"
          aria-label={ui('채우기 레이어 추가')}
          title={ui('채우기 레이어 추가')}
          onClick={() => addLayer(layers.length ? 'linear' : 'solid')}
        >
          +
        </button>
      </div>

      {layers.length === 0 && (
        <small className="inspector-hint">{ui('단색, 선형·원형·각도 그라디언트, 이미지 채우기를 여러 층으로 겹쳐 보세요.')}</small>
      )}

      <div className="inspector-layer-stack">
        {layers.map((layer, idx) => (
          <div key={layer.id || idx} className="inspector-layer-card">
            <div className="inspector-layer-head">
              <button
                type="button"
                className="inspector-icon-mini"
                aria-label={ui('레이어 표시 전환')}
                aria-pressed={layer.visible !== false}
                onClick={() => updateLayer(idx, { visible: layer.visible === false })}
              >
                {layer.visible === false ? '○' : '●'}
              </button>
              <select
                aria-label={ui('채우기 유형')}
                value={layer.type}
                onChange={(e) => {
                  const type = e.target.value;
                  if (type === 'solid') updateLayer(idx, { type, color: layer.stops?.[0]?.color || '#d8e8dc' });
                  else if (type === 'image') updateLayer(idx, { type, url: layer.url || '', size: 'cover' });
                  else updateLayer(idx, {
                    type,
                    angle: layer.angle ?? 135,
                    stops: layer.stops || [{ color: layer.color || '#6366f1', pos: 0 }, { color: '#ec4899', pos: 100 }],
                  });
                }}
              >
                <option value="solid">{ui('단색 (Solid)')}</option>
                <option value="linear">{ui('선형 그라디언트')}</option>
                <option value="radial">{ui('원형 그라디언트')}</option>
                <option value="conic">{ui('각도 그라디언트')}</option>
                <option value="image">{ui('이미지 / GIF')}</option>
              </select>
              <button type="button" className="inspector-icon-mini" aria-label={ui('위로')} onClick={() => moveLayer(idx, -1)}>↑</button>
              <button type="button" className="inspector-icon-mini" aria-label={ui('아래로')} onClick={() => moveLayer(idx, 1)}>↓</button>
              <button type="button" className="inspector-icon-mini" aria-label={ui('채우기 레이어 삭제')} onClick={() => removeLayer(idx)}>×</button>
            </div>

            {layer.type === 'solid' && (
              <div className="inspector-grid-2">
                <label className="inspector-mini-field">
                  <span>{ui('색상')}</span>
                  <input
                    type="color"
                    aria-label={ui('레이어 색상')}
                    value={layer.color}
                    onChange={(e) => updateLayer(idx, { color: e.target.value })}
                  />
                </label>
                <label className="inspector-mini-field">
                  <span>{ui('Hex')}</span>
                  <input
                    type="text"
                    aria-label={ui('레이어 Hex')}
                    value={layer.color}
                    onChange={(e) => {
                      if (/^#[0-9a-f]{6}$/i.test(e.target.value.trim())) updateLayer(idx, { color: e.target.value.trim() });
                    }}
                  />
                </label>
              </div>
            )}

            {['linear', 'radial', 'conic'].includes(layer.type) && (
              <>
                {layer.type !== 'radial' && (
                  <div className="inspector-mini-field">
                    <span>{ui('각도')} ({layer.angle}°)</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      aria-label={ui('그라디언트 각도')}
                      value={layer.angle}
                      onChange={(e) => updateLayer(idx, { angle: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className="inspector-grid-2">
                  {(layer.stops || []).map((stop, sIdx) => (
                    <label key={sIdx} className="inspector-mini-field">
                      <span>{ui('색상 점')} {sIdx + 1} ({stop.pos}%)</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="color"
                          aria-label={ui('그라디언트 색상')}
                          value={stop.color}
                          onChange={(e) => {
                            const nextStops = layer.stops.map((st, j) => (j === sIdx ? { ...st, color: e.target.value } : st));
                            updateLayer(idx, { stops: nextStops });
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          aria-label={ui('그라디언트 위치')}
                          value={stop.pos}
                          onChange={(e) => {
                            const nextStops = layer.stops.map((st, j) => (j === sIdx ? { ...st, pos: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : st));
                            updateLayer(idx, { stops: nextStops });
                          }}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            {layer.type === 'image' && (
              <div className="inspector-grid-2">
                <label className="inspector-mini-field" style={{ gridColumn: '1 / -1' }}>
                  <span>{ui('이미지 · GIF 주소')}</span>
                  <input
                    type="text"
                    aria-label={ui('이미지 채우기 URL')}
                    placeholder="https://... or /api/..."
                    value={layer.url || ''}
                    onChange={(e) => updateLayer(idx, { url: e.target.value })}
                  />
                </label>
                <label className="inspector-mini-field" style={{ gridColumn: '1 / -1' }}>
                  <span>{ui('채우기 방식')}</span>
                  <select
                    aria-label={ui('이미지 채우기 방식')}
                    value={layer.size || 'cover'}
                    onChange={(e) => updateLayer(idx, { size: e.target.value })}
                  >
                    <option value="cover">{ui('꽉 채우기 (Cover)')}</option>
                    <option value="contain">{ui('비율 맞춤 (Contain)')}</option>
                    <option value="tile">{ui('타일 반복 (Tile)')}</option>
                  </select>
                </label>
              </div>
            )}

            <div className="inspector-grid-2">
              <label className="inspector-mini-field">
                <span>{ui('투명도')} ({Math.round(layer.opacity * 100)}%)</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label={ui('레이어 투명도')}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) => updateLayer(idx, { opacity: Number(e.target.value) / 100 })}
                />
              </label>
              <label className="inspector-mini-field">
                <span>{ui('블렌드')}</span>
                <select
                  aria-label={ui('레이어 블렌드 모드')}
                  value={layer.blendMode}
                  onChange={(e) => updateLayer(idx, { blendMode: e.target.value })}
                >
                  {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
