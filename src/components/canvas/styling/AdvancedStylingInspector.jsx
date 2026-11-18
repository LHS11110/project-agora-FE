import { memo, useEffect, useMemo, useState } from 'react';
import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { analyzeSelectionIntersection } from '../../../canvas/styling/selectionIntersection.js';
import LayoutGeometrySection from './LayoutGeometrySection.jsx';
import FillLayersSection from './FillLayersSection.jsx';
import AdvancedStrokeSection from './AdvancedStrokeSection.jsx';
import EffectsAndFiltersSection from './EffectsAndFiltersSection.jsx';
import TypographyAdvancedSection from './TypographyAdvancedSection.jsx';
import ConnectorAdvancedSection from './ConnectorAdvancedSection.jsx';
import StylePresetsAndTokensSection from './StylePresetsAndTokensSection.jsx';

const MAX_MOUNT_STAGE = 5;

function AdvancedStylingInspector({
  canvasId,
  items,
  selectedObjectIds,
  hasCopiedStyle,
  onCopyStyle,
  onPasteStyle,
  onPatchStyle,
  onPatchAllItems,
  onFontSizeChange,
  onApplyAutoLayout,
}) {
  useUiLocale();
  const [tab, setTab] = useState('all');
  const [mountStage, setMountStage] = useState(0);

  // Stagger inspector section mounts across animation frames so Blink never
  // lays out hundreds of controls synchronously inside a single 120 FPS budget.
  useEffect(() => {
    let rafId = 0;
    let stage = 0;
    const step = () => {
      stage += 1;
      setMountStage(stage);
      if (stage < MAX_MOUNT_STAGE) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const editableIds = useMemo(
    () => (selectedObjectIds || []).filter((id) => Boolean(items[id])),
    [items, selectedObjectIds],
  );
  const intersection = useMemo(
    () => (mountStage >= 1 || editableIds.length > 1
      ? analyzeSelectionIntersection(items, editableIds)
      : { isMulti: false, capabilities: {} }),
    [editableIds, items, mountStage],
  );

  if (!editableIds.length) return null;

  const caps = intersection.capabilities || {};

  const primaryItem = items[editableIds[0]];
  const canApplyAutoLayout = editableIds.length === 1 && ['frame', 'shape'].includes(primaryItem?.kind);

  return (
    <div className="inspector-advanced-styling" data-selection-count={editableIds.length}>
      <section className="inspector-section">
        <strong className="inspector-label">
          {ui('상세 디자인 · 스타일 편집')}
          {intersection.isMulti && (
            <span className="inspector-mixed-badge">
              {ui('{count}개 공통 속성', { count: editableIds.length })}
            </span>
          )}
        </strong>
        <div className="inspector-style-tabs" role="tablist" aria-label={ui('스타일 편집 분류')}>
          {[
            ['all', ui('전체')],
            ['appearance', ui('채우기·효과')],
            ['library', ui('프리셋·토큰')],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`inspector-style-tab${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {mountStage >= 1 && tab === 'all' && (
        <LayoutGeometrySection
          items={items}
          targetIds={editableIds}
          intersection={intersection}
          canApplyAutoLayout={canApplyAutoLayout}
          onPatchStyle={onPatchStyle}
          onApplyAutoLayout={onApplyAutoLayout}
        />
      )}

      {mountStage >= 2 && (
        <>
          {(tab === 'all' || tab === 'appearance') && caps.fill && (
            <FillLayersSection
              items={items}
              targetIds={editableIds}
              onPatchStyle={onPatchStyle}
            />
          )}

          {(tab === 'all' || tab === 'appearance') && caps.stroke && (
            <AdvancedStrokeSection
              items={items}
              targetIds={editableIds}
              onPatchStyle={onPatchStyle}
            />
          )}
        </>
      )}

      {mountStage >= 3 && (tab === 'all' || tab === 'appearance') && caps.connector && (
        <ConnectorAdvancedSection
          items={items}
          targetIds={editableIds}
          onPatchStyle={onPatchStyle}
        />
      )}

      {mountStage >= 4 && (
        <>
          {(tab === 'all' || tab === 'appearance') && (caps.effects || caps.filters) && (
            <EffectsAndFiltersSection
              items={items}
              targetIds={editableIds}
              onPatchStyle={onPatchStyle}
            />
          )}

          {tab === 'all' && caps.typography && (
            <TypographyAdvancedSection
              items={items}
              targetIds={editableIds}
              onPatchStyle={onPatchStyle}
              onFontSizeChange={onFontSizeChange}
            />
          )}
        </>
      )}

      {mountStage >= 5 && (tab === 'all' || tab === 'library') && (
        <StylePresetsAndTokensSection
          canvasId={canvasId}
          items={items}
          selectedObjectIds={editableIds}
          hasCopiedStyle={hasCopiedStyle}
          onCopyStyle={onCopyStyle}
          onPasteStyle={onPasteStyle}
          onPatchStyle={onPatchStyle}
          onPatchAllItems={onPatchAllItems}
        />
      )}
    </div>
  );
}

export default memo(AdvancedStylingInspector);
