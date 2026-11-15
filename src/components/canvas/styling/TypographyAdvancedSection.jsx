import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { FONT_FAMILIES, FONT_WEIGHTS, readObjectStyle, writeObjectStylePatch } from '../../../canvas/styling/objectStyleModel.js';
import { objectFontSize, MIN_OBJECT_FONT_SIZE, MAX_OBJECT_FONT_SIZE } from '../../../canvas/objectSize.js';

export default function TypographyAdvancedSection({ items, targetIds, onPatchStyle, onFontSizeChange }) {
  useUiLocale();
  if (!targetIds.length) return null;
  const primaryItem = items[targetIds[0]];
  const style = readObjectStyle(primaryItem);
  const t = style.typography;
  const fontSize = Math.round(objectFontSize(primaryItem) * 10) / 10;

  const updateTypo = (patch) => {
    onPatchStyle(targetIds, (item) => writeObjectStylePatch(item, (cur) => ({
      ...cur,
      typography: { ...cur.typography, explicit: true, ...patch },
    })));
  };

  return (
    <section className="inspector-section inspector-style-typo">
      <strong className="inspector-label">{ui('타이포그래피 (Typography)')}</strong>
      <div className="inspector-grid-2">
        <label className="inspector-mini-field" style={{ gridColumn: '1 / -1' }}>
          <span>{ui('폰트 패밀리')}</span>
          <select
            aria-label={ui('폰트 패밀리')}
            value={t.fontFamily}
            onChange={(e) => updateTypo({ fontFamily: e.target.value })}
          >
            {FONT_FAMILIES.map((opt) => (
              <option key={opt.label} value={opt.value}>{ui(opt.label)}</option>
            ))}
          </select>
        </label>
        <label className="inspector-mini-field">
          <span>{ui('굵기')}</span>
          <select
            aria-label={ui('폰트 굵기')}
            value={t.fontWeight}
            onChange={(e) => updateTypo({ fontWeight: Number(e.target.value) })}
          >
            {FONT_WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="inspector-mini-field">
          <span>{ui('크기 (px)')}</span>
          <input
            type="number"
            min={MIN_OBJECT_FONT_SIZE}
            max={MAX_OBJECT_FONT_SIZE}
            step="1"
            aria-label={ui('타이포 글자 크기')}
            value={fontSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= MIN_OBJECT_FONT_SIZE && v <= MAX_OBJECT_FONT_SIZE) {
                onFontSizeChange?.(targetIds, v);
              }
            }}
          />
        </label>
        <label className="inspector-mini-field">
          <span>{ui('행간 (Line Height)')}</span>
          <input
            type="number"
            min="0.8"
            max="3"
            step="0.05"
            aria-label={ui('행간')}
            value={t.lineHeight}
            onChange={(e) => updateTypo({ lineHeight: Math.max(0.8, Math.min(3, Number(e.target.value) || 1.5)) })}
          />
        </label>
        <label className="inspector-mini-field">
          <span>{ui('자간 (px)')}</span>
          <input
            type="number"
            min="-4"
            max="24"
            step="0.5"
            aria-label={ui('자간')}
            value={t.letterSpacing}
            onChange={(e) => updateTypo({ letterSpacing: Math.max(-4, Math.min(24, Number(e.target.value) || 0)) })}
          />
        </label>
        <label className="inspector-mini-field">
          <span>{ui('단락 간격 (px)')}</span>
          <input
            type="number"
            min="0"
            max="64"
            step="1"
            aria-label={ui('단락 간격')}
            value={t.paragraphSpacing}
            onChange={(e) => updateTypo({ paragraphSpacing: Math.max(0, Math.min(64, Number(e.target.value) || 0)) })}
          />
        </label>
        <label className="inspector-mini-field">
          <span>{ui('텍스트 정렬')}</span>
          <select
            aria-label={ui('텍스트 정렬')}
            value={t.textAlign}
            onChange={(e) => updateTypo({ textAlign: e.target.value })}
          >
            <option value="left">{ui('왼쪽')}</option>
            <option value="center">{ui('가운데')}</option>
            <option value="right">{ui('오른쪽')}</option>
            <option value="justify">{ui('양쪽 맞춤')}</option>
          </select>
        </label>
        <label className="inspector-mini-field">
          <span>{ui('영역 초과 처리')}</span>
          <select
            aria-label={ui('텍스트 초과 처리')}
            value={t.overflowMode}
            onChange={(e) => updateTypo({ overflowMode: e.target.value })}
          >
            <option value="visible">{ui('기본 / 스크롤')}</option>
            <option value="truncate">{ui('말줄임표 (... )')}</option>
            <option value="auto-fit">{ui('자동 크기 맞춤')}</option>
          </select>
        </label>
        <label className="inspector-mini-field">
          <span>{ui('글자 색상')}</span>
          <input
            type="color"
            aria-label={ui('타이포 글자 색상')}
            value={t.textColor || '#22242a'}
            onChange={(e) => updateTypo({ textColor: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
