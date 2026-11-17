import { useId, useState } from 'react';
import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { STYLE_PRESETS, THEME_PALETTES, applyPresetToItem, applyThemePaletteToItem } from '../../../canvas/styling/stylePresets.js';
import {
  DEFAULT_STYLE_TOKENS,
  loadStyleTokens,
  persistStyleTokens,
  createTokenFromItem,
  applyTokenToItem,
} from '../../../canvas/styling/styleTokens.js';
import {
  extractSelectionColors,
  replaceSelectionColorPatch,
} from '../../../canvas/styling/selectionIntersection.js';

export default function StylePresetsAndTokensSection({
  canvasId,
  items,
  selectedObjectIds,
  hasCopiedStyle,
  onCopyStyle,
  onPasteStyle,
  onPatchStyle,
  onPatchAllItems,
}) {
  useUiLocale();
  const fieldId = useId();
  const [tokens, setTokens] = useState(() => loadStyleTokens(canvasId));
  const [tokenName, setTokenName] = useState('');
  const [tokenCategory, setTokenCategory] = useState('complete');

  if (!selectedObjectIds.length) return null;
  const primaryItem = items[selectedObjectIds[0]];
  const selectionColors = extractSelectionColors(items, selectedObjectIds);

  const saveNewToken = () => {
    if (!primaryItem) return;
    const token = createTokenFromItem(primaryItem, tokenName || ui('내 스타일 토큰'), tokenCategory);
    const next = [token, ...tokens];
    setTokens(next);
    persistStyleTokens(canvasId, next);
    setTokenName('');
  };

  const removeToken = (tokenId) => {
    const next = tokens.filter((t) => t.id !== tokenId);
    setTokens(next.length ? next : [...DEFAULT_STYLE_TOKENS]);
    persistStyleTokens(canvasId, next.length ? next : [...DEFAULT_STYLE_TOKENS]);
  };

  return (
    <div className="inspector-style-library">
      <section className="inspector-section">
        <strong className="inspector-label">{ui('스타일 복사 · 붙여넣기')}</strong>
        <div className="inspector-grid-2">
          <button
            type="button"
            className="inspector-secondary-action"
            title="Alt+Ctrl+C"
            onClick={onCopyStyle}
          >
            {ui('스타일 복사 (Alt+Ctrl+C)')}
          </button>
          <button
            type="button"
            className="inspector-secondary-action"
            title="Alt+Ctrl+V"
            disabled={!hasCopiedStyle}
            onClick={onPasteStyle}
          >
            {ui('스타일 적용 (Alt+Ctrl+V)')}
          </button>
        </div>
      </section>

      <section className="inspector-section">
        <strong className="inspector-label">{ui('원클릭 스타일 프리셋')}</strong>
        <div className="inspector-preset-grid">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="inspector-preset-card"
              onClick={() => onPatchStyle(selectedObjectIds, (item) => applyPresetToItem(item, preset.id))}
            >
              <span className="inspector-preset-preview" style={preset.preview}>Aa</span>
              <strong>{ui(preset.name)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <strong className="inspector-label">{ui('테마 팔레트')}</strong>
        <div className="inspector-palette-list">
          {THEME_PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              className="inspector-palette-row"
              onClick={() => onPatchStyle(selectedObjectIds, (item) => applyThemePaletteToItem(item, palette.id))}
            >
              <span>{ui(palette.name)}</span>
              <span className="inspector-palette-swatches">
                {palette.colors.map((hex) => <i key={hex} style={{ background: hex }} />)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <strong className="inspector-label">{ui('스타일 토큰 · 변수')}</strong>
        <div className="inspector-grid-2">
          <input
            id={`${fieldId}-token-name`}
            name="style-token-name"
            type="text"
            aria-label={ui('새 토큰 이름')}
            placeholder={ui('토큰 이름 (예: 강조 카드)')}
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
          />
          <select
            id={`${fieldId}-token-category`}
            name="style-token-category"
            aria-label={ui('토큰 유형')}
            value={tokenCategory}
            onChange={(e) => setTokenCategory(e.target.value)}
          >
            <option value="complete">{ui('전체 스타일')}</option>
            <option value="color">{ui('색상 · 선')}</option>
            <option value="typography">{ui('타이포')}</option>
            <option value="effect">{ui('효과 · 필터')}</option>
          </select>
        </div>
        <button type="button" className="inspector-secondary-action" onClick={saveNewToken}>
          {ui('현재 스타일을 토큰으로 저장')}
        </button>

        <div className="inspector-layer-stack">
          {tokens.map((tok) => (
            <div key={tok.id} className="inspector-token-row">
              <span className="inspector-token-swatch" style={{ background: tok.swatch }} />
              <span style={{ flex: 1, fontSize: 10, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tok.name}
              </span>
              <button
                type="button"
                className="inspector-icon-mini"
                title={ui('선택 객체에 토큰 적용')}
                aria-label={ui('토큰 적용')}
                onClick={() => onPatchStyle(selectedObjectIds, (item) => applyTokenToItem(item, tok))}
              >
                ✓
              </button>
              <button
                type="button"
                className="inspector-icon-mini"
                title={ui('이 토큰을 쓰는 모든 객체 동기화')}
                aria-label={ui('토큰 일괄 업데이트')}
                onClick={() => onPatchAllItems?.((id, item) => {
                  const used = (item?.brush || '').includes(`"${tok.id}"`);
                  return used ? applyTokenToItem(item, tok) : null;
                })}
              >
                ↻
              </button>
              {!DEFAULT_STYLE_TOKENS.some((d) => d.id === tok.id) && (
                <button
                  type="button"
                  className="inspector-icon-mini"
                  title={ui('토큰 삭제')}
                  aria-label={ui('토큰 삭제')}
                  onClick={() => removeToken(tok.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <strong className="inspector-label">{ui('선택 영역 색상 일괄 변경')}</strong>
        {selectionColors.length === 0 && (
          <small className="inspector-hint">{ui('추출된 색상이 없습니다.')}</small>
        )}
        <div className="inspector-selection-colors">
          {selectionColors.map((entry) => (
            <div key={entry.color} className="inspector-selection-color-row">
              <input
                id={`${fieldId}-batch-color-${entry.color}`}
                name={`style-batch-color-${entry.color}`}
                type="color"
                aria-label={ui('선택 색상 일괄 교체')}
                value={entry.color}
                onChange={(e) => {
                  const nextColor = e.target.value;
                  onPatchStyle(selectedObjectIds, (item) => replaceSelectionColorPatch(item, entry.color, nextColor));
                }}
              />
              <code>{entry.color}</code>
              <span style={{ fontSize: 9, color: 'var(--ink-muted)' }}>×{entry.count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
