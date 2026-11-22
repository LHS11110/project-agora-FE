import ItemSubset from '../../canvas/ItemSubset.js';
import { useId, useMemo, useRef } from 'react';
import Icon from '../Icon.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import '../../canvas/runtimeEn.js';
import { isHideableObject, readObjectVisibility } from '../../canvas/styling/objectStyleModel.js';
import { getObjectRevealPhase } from '../../canvas/portfolio/animationReveal.js';

const KIND_LABELS = {
  shape: '도형',
  text: '텍스트',
  note: '포스트잇',
  image: '이미지',
  table: '테이블',
  chart: '그래프',
  connector: '연결선',
  stroke: '드로잉',
  frame: '프레임',
  code: '코드',
  math: '수식',
  pdf: 'PDF',
  link: '링크',
  question: '문제',
  value: '값',
  project: '프로젝트',
  'user-group': '그룹',
};

function describeItem(id, item) {
  const kindLabel = ui(KIND_LABELS[item?.kind] || '객체');
  const raw = String(item?.title || item?.text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return `${kindLabel} #${String(id).slice(-4)}`;
  const snippet = raw.length > 18 ? `${raw.slice(0, 18)}…` : raw;
  return `${kindLabel} · ${snippet}`;
}

/**
 * Inspector section controlling hide/show state and reveal-after-animation for selected objects.
 */
export function ObjectVisibilityControls({
  ids = [],
  items = {},
  disabled = false,
  previewHidden = false,
  onTogglePreviewHidden,
  onToggleHidden,
  onToggleRevealAfterAnimation,
  onRevealAfterAnimation,
}) {
  useUiLocale();
  const fieldId = useId();
  const hideableIds = ids.filter((id) => isHideableObject(items[id]));
  if (!hideableIds.length) return null;

  const hiddenCount = hideableIds.filter((id) => readObjectVisibility(items[id]).hidden).length;
  const allHidden = hiddenCount === hideableIds.length;
  const revealCount = hideableIds.filter((id) => readObjectVisibility(items[id]).revealAfterAnimation).length;
  const allReveal = revealCount === hideableIds.length;
  const currentlyInvisibleCount = hideableIds.filter((id) => {
    const phase = getObjectRevealPhase(items[id]).phase;
    return phase === 'hidden' || phase === 'delayed';
  }).length;

  return (
    <section className="inspector-section object-visibility-controls" aria-label={ui('객체 표시 / 숨김')}>
      <div className="object-visibility-heading">
        <strong>
          <Icon name={hiddenCount > 0 ? 'eyeOff' : 'eye'} size={14} />
          <span>{ui('객체 표시 / 숨김')}</span>
        </strong>
        <small>{hiddenCount} / {hideableIds.length}</small>
      </div>
      <div className="object-visibility-actions">
        <button
          type="button"
          disabled={disabled}
          className="inspector-secondary-action"
          aria-pressed={allHidden}
          onClick={() => onToggleHidden?.(hideableIds, !allHidden)}
        >
          <Icon name={allHidden ? 'eye' : 'eyeOff'} size={14} />
          <span>{ui(allHidden ? '객체 표시' : '객체 숨김')}</span>
        </button>
        {hiddenCount > 0 && !allHidden && (
          <button
            type="button"
            disabled={disabled}
            className="inspector-secondary-action"
            onClick={() => onToggleHidden?.(hideableIds, false)}
          >
            <span>{ui('모두 표시')}</span>
          </button>
        )}
      </div>
      <label className="object-reveal-toggle">
        <input
          id={`${fieldId}-reveal-after-animation`}
          name="object-reveal-after-animation"
          type="checkbox"
          disabled={disabled}
          checked={allReveal}
          onChange={(event) => onToggleRevealAfterAnimation?.(hideableIds, event.target.checked)}
        />
        <span>{ui('애니메이션 재생 후 표시')}</span>
      </label>
      {currentlyInvisibleCount > 0 && (
        <button
          type="button"
          disabled={disabled}
          className="inspector-secondary-action object-reveal-play-btn"
          onClick={() => onRevealAfterAnimation?.(hideableIds)}
        >
          <Icon name="arrow" size={13} />
          <span>{ui('지금 애니메이션으로 표시')}</span>
        </button>
      )}
      {hiddenCount > 0 && onTogglePreviewHidden && (
        <label className="object-reveal-toggle">
          <input
            id={`${fieldId}-preview-hidden`}
            name="object-preview-hidden"
            type="checkbox"
            checked={previewHidden}
            onChange={() => onTogglePreviewHidden()}
          />
          <span>{ui('숨긴 객체 미리보기')}</span>
        </label>
      )}
      {hiddenCount > 0 && (
        <small className="inspector-hint">
          {ui(
            allReveal
              ? '초기에는 숨겨져 있다가 애니메이션을 재생하면 화면에 나타난 상태로 유지됩니다.'
              : '숨긴 객체는 일반 보기와 발표에서 보이지 않으며, 아래 숨겨진 객체 목록에서 언제든 다시 표시할 수 있습니다.'
          )}
        </small>
      )}
    </section>
  );
}

/**
 * Always-reachable inspector directory of hidden canvas objects so hidden items are never lost.
 */
export function HiddenObjectsManager({
  items = {},
  canWriteItem = () => true,
  previewHidden = false,
  onTogglePreviewHidden,
  onSelectObject,
  onToggleHidden,
  onRevealAfterAnimation,
  onUnhideAll,
  onRevealAllAfterAnimation,
}) {
  useUiLocale();
  const subset = useRef(null);
  if (!subset.current) subset.current = new ItemSubset(item => isHideableObject(item) && readObjectVisibility(item).hidden);
  const candidates = subset.current.update(items);
  const hiddenEntries = useMemo(() => candidates.slice().sort(([a], [b]) => String(a).localeCompare(String(b))), [candidates]);

  if (!hiddenEntries.length) return null;

  const editableIds = hiddenEntries
    .filter(([, item]) => !item.locked && canWriteItem(item))
    .map(([id]) => id);
  const invisibleEditableIds = editableIds.filter((id) => {
    const phase = getObjectRevealPhase(items[id]).phase;
    return phase === 'hidden' || phase === 'delayed';
  });

  return (
    <section className="inspector-section hidden-objects-section" aria-label={ui('숨겨진 객체')}>
      <div className="object-visibility-heading">
        <strong>
          <Icon name="eyeOff" size={14} />
          <span>{ui('숨겨진 객체 ({count})', { count: hiddenEntries.length })}</span>
        </strong>
      </div>
      {onTogglePreviewHidden && (
        <div className="inspector-switch-row">
          <span><strong>{ui('숨김 객체 미리보기')}</strong></span>
          <button
            type="button"
            className={`toggle-switch${previewHidden ? ' on' : ''}`}
            role="switch"
            aria-label={ui('숨김 객체 미리보기')}
            aria-checked={previewHidden}
            onClick={onTogglePreviewHidden}
          >
            <i />
          </button>
        </div>
      )}
      <div className="hidden-objects-list">
        {hiddenEntries.map(([id, item]) => {
          const reveal = getObjectRevealPhase(item);
          const writable = !item.locked && canWriteItem(item);
          const statusText = reveal.phase === 'revealed'
            ? '애니메이션 후 표시됨'
            : reveal.phase === 'animating'
            ? '애니메이션 재생 중'
            : reveal.phase === 'delayed'
            ? '재생 대기 중'
            : reveal.revealAfterAnimation
            ? '애니메이션 재생 시 표시'
            : '숨김 중';
          return (
            <div key={id} className="hidden-object-row">
              <div className="hidden-object-meta">
                <strong title={describeItem(id, item)}>{describeItem(id, item)}</strong>
                <small>{ui(statusText)}</small>
              </div>
              <div className="hidden-object-row-actions">
                <button
                  type="button"
                  className="hidden-object-mini-btn"
                  title={ui('미리보기로 선택하고 이동')}
                  onClick={() => onSelectObject?.(id)}
                >
                  {ui('선택')}
                </button>
                <button
                  type="button"
                  className="hidden-object-mini-btn"
                  disabled={!writable}
                  title={ui('애니메이션 재생 후 표시')}
                  onClick={() => onRevealAfterAnimation?.([id])}
                >
                  {ui('애니 표시')}
                </button>
                <button
                  type="button"
                  className="hidden-object-mini-btn"
                  disabled={!writable}
                  title={ui('숨김 해제 후 즉시 표시')}
                  onClick={() => onToggleHidden?.([id], false)}
                >
                  {ui('표시')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="object-visibility-actions">
        {invisibleEditableIds.length > 0 && (
          <button
            type="button"
            className="inspector-secondary-action"
            onClick={() => onRevealAllAfterAnimation?.(invisibleEditableIds)}
          >
            <Icon name="arrow" size={13} />
            <span>{ui('애니메이션으로 모두 표시')}</span>
          </button>
        )}
        <button
          type="button"
          className="inspector-secondary-action"
          disabled={!editableIds.length}
          onClick={() => onUnhideAll?.(editableIds)}
        >
          <Icon name="eye" size={13} />
          <span>{ui('모두 표시')}</span>
        </button>
      </div>
    </section>
  );
}
