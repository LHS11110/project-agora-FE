import '../../canvas/runtimeEn.js';
import PortfolioControls from '../../canvas/portfolio/PortfolioControls.jsx';
import ObjectLockControls from '../../canvas/locks/ObjectLockControls.jsx';
import ObjectGroupControls from '../../canvas/permissions/ObjectGroupControls.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import LogicPortControls from './LogicPortControls.jsx';
import ShapeGeometryControls from '../../canvas/ShapeGeometryControls.jsx';
import ObjectCornerControls from '../../canvas/ObjectCornerControls.jsx';
import { selectionCornerState } from '../../canvas/objectCorners.js';
import ObjectNumericControls from '../../canvas/ObjectNumericControls.jsx';
import { SizeInput } from '../../canvas/ObjectSizeControls.jsx';
import ObjectShadowControls from '../../canvas/ObjectShadowControls.jsx';
import GraphicsQualityControls from '../../canvas/GraphicsQualityControls.jsx';
import { useEffect, useId, useMemo, useState } from 'react';
import ObjectDepthControls from '../../canvas/ObjectDepthControls.jsx';
import CanvasBackgroundControls from '../../canvas/background/CanvasBackgroundControls.jsx';
import ObjectRecoveryControls from '../../canvas/diagnostics/ObjectRecoveryControls.jsx';
import ObjectClipboardControls from '../../canvas/clipboard/ObjectClipboardControls.jsx';
import UserGroupControls from '../../canvas/userGroups/UserGroupControls.jsx';
import UserGroupToolSettings from '../../canvas/userGroups/UserGroupToolSettings.jsx';
import VectorStyleSelector from './styling/VectorStyleSelector.jsx';
import ShapeBorderControls from '../../canvas/ShapeBorderControls.jsx';
import ShapeFillControls from '../../canvas/ShapeFillControls.jsx';
import ConnectorPointControls from './ConnectorPointControls.jsx';
import './inspector-actions.css';
import ContentRenderControls from '../../canvas/content/ContentRenderControls.jsx';
import { isTextContent, contentMode } from '../../canvas/content/contentPresentation.js';
import ConnectorLabelControls from './ConnectorLabelControls.jsx';
import ConnectorEndpointInfo from './ConnectorEndpointInfo.jsx';
import PenStyleControls from '../../canvas/PenStyleControls.jsx';
import { hasIndependentContentSize, supportsObjectFontSize } from '../../canvas/objectSize.js';
import ObjectSizeControls from '../../canvas/ObjectSizeControls.jsx';
import ShapePicker from '../../canvas/ShapePicker.jsx';
import EraserSizeControl from '../../canvas/EraserSizeControl.jsx';
import EraserModeControl from '../../canvas/EraserModeControl.jsx';
import ChartControls from '../../canvas/charts/ChartControls.jsx';
import { isVolumeShape } from '../../canvas/volumeGeometry.js';
import CanvasColorPicker from '../../canvas/CanvasColorPicker.jsx';
import AdvancedStylingInspector from './styling/AdvancedStylingInspector.jsx';
import { HiddenObjectsManager, ObjectVisibilityControls } from './ObjectVisibilityControls.jsx';
import Icon from '../Icon.jsx';
import ArrowHeadControls from '../ArrowHeadControls.jsx';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../tableModel.js';
import { LASER_COLOR, MAX_STROKE_WIDTH, MAX_ZOOM_SENSITIVITY, MIN_STROKE_WIDTH, MIN_ZOOM_SENSITIVITY, stickyNoteColors } from '../../canvas/canvasConstants.js';

const KIND_EDIT_LABELS = {
  image: '이미지 편집', shape: '도형 편집', text: '텍스트 편집', note: '포스트잇 편집',
  code: '코드 편집', math: '수식 편집', table: '테이블 편집', chart: '그래프 편집',
  frame: '프레임 편집', connector: '연결 편집', question: '문제 편집', project: '프로젝트 편집',
  value: '값 편집', pdf: 'PDF 편집', link: '링크 편집', 'user-group': '그룹 편집', stroke: '드로잉 편집',
};

export default function CanvasInspectorPanel({
  activeTool,
  canvasId,
  graphicsQuality, changeGraphicsQuality,
  updateContentSetting,
  updateChartItem,
  changeSelectionGroup,
  changeStrokeWidth,
  eraserWidth,
  changeEraserWidth,
  eraserMode,
  changeEraserMode,
  changeTableCount,
  changeTableSize,
  changeTheme,
  changeZoomSensitivity,
  color,
  connectorColor,
  connectorEndHead,
  connectorStartHead, connectorHeadSize,
  connectorToEdit,
  connectorWidth,
  items,
  spatialIndex,
  onNavigateObject,
  onOpenComments,
  noteColor,
  primarySelectedItemId,
  selectItems,
  selectedArrow,
  selectedConnector,
  selectedItem,
  objectClipboard, clipboardBlocked, canWriteItem = () => true, canWriteCanvas = true, deleteItem,
  laserColor, setLaserColor, onSaveAnchor,
  user, token, updateUserGroup, canvasParticipants = [], onInsertUserGroup, userGroupTemplate, onUserGroupTemplateChange,
  selectedObjectIds,
  selectedTable,
  selectionIsSingleGroup,
  setColor,
  favoriteColors,
  saveFavoriteColor,
  setConnectorColor,
  setConnectorWidth,
  setNoteColor,
  setShapeType,
  setShowSettings,
  backgroundColor,
  setBackgroundColor,
  settings,
  capabilities,
  updateItemGroups,
  shapeArrowEndHead,
  shapeArrowStartHead, shapeArrowHeadSize,
  shapeType,
  shapeFillColor, setShapeFillColor, updateShapeFill,
  shapeFillOpacity, setShapeFillOpacity, shapeSketchFillOpacity, setShapeSketchFillOpacity, shapeVertexCount, shapeCornerStyle, updateNewShapeGeometry,
  shapeVisualStyle, setShapeVisualStyle, shapeStrokeEnabled, setShapeStrokeEnabled, shapeBorderWidth, setShapeBorderWidth, updateShapeAppearance,
  connectorVisualStyle, setConnectorVisualStyle,
  portfolioActions, portfolioViewing, portfolioFrames,
  showGrid, gridSpacing=20, changeGridSpacing, snapToGrid=false, toggleSnapToGrid, showXAxis, showYAxis, toggleXAxis, toggleYAxis,
  strokeWidth,
  penBrush, penOpacity, changePenBrush, changePenOpacity,
  tableConfig,
  theme,
  toggleGrid,
  updateArrowHead,
  updateConnectorAppearance,
  updateItemRotation, updateItemDepth, updateItemLocked, updateItemHidden, previewHiddenObjects = false, onTogglePreviewHidden, onToggleRevealAfterAnimation, onRevealAfterAnimation, onUnhideAll, onRevealAllAfterAnimation, onSelectHiddenObject, updateItemShadow, updateImageFrame, updateObjectCornerStyle, updateObjectColor,
  updateObjectDimensions,
  updateObjectFontSize,
  hasCopiedStyle,
  onCopyStyle,
  onPasteStyle,
  onPatchStyle,
  onPatchAllItems,
  onApplyAutoLayout,
  updateNewConnectorHead,
  updateNewShapeArrowHead,
  updateShapeArrowBend,
  zoomSensitivity
}) {
  useUiLocale();
  const fieldId = useId();
  const [showEnvInSelection, setShowEnvInSelection] = useState(false);
  const hasSelection = activeTool === 'select' && selectedObjectIds.length > 0;
  useEffect(() => { if (!hasSelection) setShowEnvInSelection(false); }, [hasSelection]);
  const selectedShapes = useMemo(() => (hasSelection ? selectedObjectIds.map(id => [id, items[id]]).filter(([, item]) => item?.kind === 'shape' && !item.runtimeRole) : []), [hasSelection, selectedObjectIds, items]);
  const selectedShapeIds = useMemo(() => selectedShapes.map(([id]) => id), [selectedShapes]);
  const editableShape = selectedShapeIds.length > 0 ? selectedShapes[0][1] : null;
  const nonArrowShapeIds = useMemo(() => selectedShapes.filter(([, item]) => item.shapeType !== 'arrow').map(([id]) => id), [selectedShapes]);
  const primaryNonArrowShape = useMemo(() => selectedShapes.find(([, item]) => item.shapeType !== 'arrow')?.[1] || null, [selectedShapes]);
  const cornerState = useMemo(() => (hasSelection ? selectionCornerState(selectedObjectIds, items) : { targetIds: [], value: null }), [hasSelection, selectedObjectIds, items]);
  const showBatchCornerControls = cornerState.targetIds.length > 0 && !(selectedObjectIds.length === 1 && selectedShapes.length === 1);
  const selectedTextIds = useMemo(() => (hasSelection ? selectedObjectIds.filter(id => { const item = items[id]; return item?.kind === 'text' && ['plain', 'markdown'].includes(contentMode(item)); }) : []), [hasSelection, selectedObjectIds, items]);
  const primarySelectedText = selectedTextIds.length > 0 ? items[selectedTextIds[0]] : null;
  const selectedNoteIds = useMemo(() => (hasSelection ? selectedObjectIds.filter(id => items[id]?.kind === 'note') : []), [hasSelection, selectedObjectIds, items]);
  const primarySelectedNote = selectedNoteIds.length > 0 ? items[selectedNoteIds[0]] : null;
  const selectionSummary=useMemo(()=>{let grouped=false,savedText=false,groupable=0;for(const id of selectedObjectIds){const item=items[id];grouped ||= Boolean(item?.groupId);savedText ||= ['text','code'].includes(item?.kind);if(!['stroke','connector'].includes(item?.kind))groupable++;}return {grouped,savedText,groupable};},[selectedObjectIds,items]);
  const shadowItems = useMemo(() => {
    let patched = null;
    for (const id of selectedObjectIds) {
      const it = items[id];
      if (it?.kind === 'user-group' && it.shadowEnabled === undefined) {
        if (!patched) patched = { ...items };
        patched[id] = { ...it, shadowEnabled: false };
      }
    }
    return patched || items;
  }, [items, selectedObjectIds]);
  const hasLockedSelection = hasSelection && selectedObjectIds.some(id => items[id]?.locked === true || !canWriteItem(items[id]));
  const headingTitle = activeTool !== 'select'
    ? ui('{tool} 설정', {tool:ui(({ anchor:'앵커',frame:'프레임',project:'프로젝트 관리',notebook:'주피터 노트북',terminal:'터미널','continuous-value':'연속 값','discrete-value':'이산 값','user-group': '사용자 그룹', pen: '드로잉', laser: '레이저 포인터', eraser: '지우개', connect: '연결', shape: '도형', chart: '그래프', question: '문제', text: '텍스트', note: '포스트잇', math: '수식', table: '테이블', code: '코드', link: '동영상·링크' })[activeTool] || ui("도구"))})
    : !hasSelection
    ? ui('환경 설정')
    : selectedObjectIds.length === 1
    ? ui(KIND_EDIT_LABELS[selectedItem?.kind] || '객체 편집')
    : ui('객체 {count}개 편집', { count: selectedObjectIds.length });
  const envSections = <>
    <ObjectRecoveryControls items={items} spatialIndex={spatialIndex} onDelete={deleteItem} />
    <GraphicsQualityControls value={graphicsQuality} onChange={changeGraphicsQuality} />
    <section className="inspector-section"><div className="inspector-label">{ui("화면 모드")}</div><div className="theme-switch" role="group" aria-label={ui("테마 선택")}><button className={theme === 'light' ? 'active' : ''} aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}><Icon name="sun" size={16} />{ui("라이트")}</button><button className={theme === 'dark' ? 'active' : ''} aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}><Icon name="moon" size={16} />{ui("다크")}</button></div></section>
    <section className="inspector-section coordinate-guide-controls">{[['x','가로 격자 간격'],['y','세로 격자 간격']].map(([axis,label])=><label key={axis} className="inspector-switch-row"><span><strong>{ui(label)}</strong></span><input id={`${fieldId}-grid-spacing-${axis}`} name={`grid-spacing-${axis}`} className="inspector-grid-spacing" aria-label={ui(label)} type="number" min="1" max="10000" step="1" value={typeof gridSpacing==='object'?gridSpacing[axis]:gridSpacing} onChange={event=>{if(event.target.value&&event.target.validity.valid)changeGridSpacing?.(Number(event.target.value),axis);}}/></label>)}<div className="inspector-switch-row"><span><strong>{ui("격자에 맞춰 배치")}</strong></span><button className={`toggle-switch${snapToGrid?' on':''}`} role="switch" aria-label={ui("격자에 맞춰 배치")} aria-checked={snapToGrid} onClick={toggleSnapToGrid}><i/></button></div><div className="inspector-switch-row"><span><strong>{ui("좌표 격자")}</strong></span><button className={`toggle-switch${showGrid ? ' on' : ''}`} role="switch" aria-label={ui("좌표 격자")} aria-checked={showGrid} onClick={toggleGrid}><i /></button></div><div className="inspector-switch-row"><span><strong>{ui("X축 표시")}</strong></span><button className={`toggle-switch${showXAxis ? ' on' : ''}`} role="switch" aria-label={ui("X축 표시")} aria-checked={showXAxis} onClick={toggleXAxis}><i /></button></div><div className="inspector-switch-row"><span><strong>{ui("Y축 표시")}</strong></span><button className={`toggle-switch${showYAxis ? ' on' : ''}`} role="switch" aria-label={ui("Y축 표시")} aria-checked={showYAxis} onClick={toggleYAxis}><i /></button></div></section>
    <section className="inspector-section zoom-sensitivity-section"><div className="zoom-sensitivity-heading"><strong>{ui("줌 감도")}</strong><span>{Math.round(zoomSensitivity * 100)}%</span></div><input id={`${fieldId}-zoom-sensitivity`} name="zoom-sensitivity" type="range" min={MIN_ZOOM_SENSITIVITY} max={MAX_ZOOM_SENSITIVITY} step="0.1" value={zoomSensitivity} onChange={changeZoomSensitivity} aria-label={ui("줌 감도")} /><small>{ui("휠과 확대·축소 버튼 반응 속도")}</small></section>
    <CanvasBackgroundControls {...{ backgroundColor, setBackgroundColor, favoriteColors, saveFavoriteColor, theme }} />
  </>;
  return (
      <aside className={`canvas-sidepanel canvas-inspector${activeTool === 'select' ? (hasSelection ? ' server-settings-mode object-editing-mode' : ' server-settings-mode') : ' tool-settings-mode'}`}>
        <div className="inspector-heading">
          <div><h2>{headingTitle}</h2></div>
          {activeTool === 'select' && <div className="inspector-heading-actions">
            {hasSelection && <button type="button" className={`inspector-env-toggle${showEnvInSelection ? ' active' : ''}`} aria-pressed={showEnvInSelection} onClick={() => setShowEnvInSelection(current => !current)} title={ui(showEnvInSelection ? '캔버스 환경 설정 접기' : '캔버스 환경 설정 보기')}>{ui('환경 설정')}</button>}
            <button className="icon-button" onClick={() => setShowSettings(true)} aria-label={ui("캔버스 세부 설정")}><Icon name="settings" size={18} /></button>
          </div>}
        </div>
        {hasSelection && <div className="inspector-object-editor">
          {(selectedObjectIds.length > 1 || selectionSummary.grouped) && <section className="inspector-section selection-actions-section"><div className="selection-actions-heading"><strong>{selectedObjectIds.length}{ui("개 오브젝트 선택됨")}</strong><button type="button" onClick={() => selectItems([])}>{ui("선택 해제")}</button></div><small className="inspector-hint">{ui("빈 공간을 드래그해 여러 개를 선택하고, Shift를 누른 채 개별 선택을 더할 수 있어요.")}</small>{selectionSummary.savedText && <small className="inspector-hint">{ui("텍스트와 코드는 Ctrl + S로 저장하며, 포스트잇은 변경 후 자동 저장합니다.")}</small>}<div className="selection-actions-buttons"><button type="button" className="button button-dark" disabled={!selectionIsSingleGroup && selectionSummary.groupable < 2} onClick={() => changeSelectionGroup(!selectionIsSingleGroup)}>{selectionIsSingleGroup ? ui("그룹 해제") : ui("그룹화")}</button></div></section>}
          <button type="button" className="inspector-secondary-action" onClick={() => onSaveAnchor(selectedObjectIds)}><Icon name="anchor" size={14} /><span>{ui('위치 저장')}</span></button>
          <ObjectLockControls ids={selectedObjectIds} items={items} disabled={selectedObjectIds.some(id => !canWriteItem(items[id]))} onChange={updateItemLocked} />
          <ObjectGroupControls ids={selectedObjectIds} items={items} settings={settings} capabilities={capabilities} disabled={hasLockedSelection} onChange={updateItemGroups} />
          <ObjectVisibilityControls
            ids={selectedObjectIds}
            items={items}
            disabled={hasLockedSelection}
            previewHidden={previewHiddenObjects}
            onTogglePreviewHidden={onTogglePreviewHidden}
            onToggleHidden={updateItemHidden}
            onToggleRevealAfterAnimation={onToggleRevealAfterAnimation}
            onRevealAfterAnimation={onRevealAfterAnimation}
          />
          {selectedObjectIds.length === 1 && selectedItem && <button type="button" className="inspector-secondary-action" disabled={!canWriteItem(selectedItem)} onClick={() => onOpenComments(primarySelectedItemId)}><Icon name="chat" size={14} /><span>{ui('객체 댓글')}</span></button>}
          {(['executor', 'output'].includes(selectedItem?.runtimeRole) || (isTextContent(selectedItem) && contentMode(selectedItem) === 'code')) && <section className="inspector-section"><strong className="inspector-label">{ui('블루프린트 실행')}</strong><p className="inspector-hint">{ui('실행 객체 → 코드 객체 → 결과 객체 순서로 연결하세요. 실행 객체의 코드 실행 버튼을 눌러 실행합니다.')}</p><p className="inspector-hint">{ui('연결 화살표의 방향을 따릅니다. 결과 객체끼리 연결하면 같은 출력을 여러 곳에서 볼 수 있습니다.')}</p></section>}
          <ObjectClipboardControls actions={objectClipboard} selectedCount={selectedObjectIds.length} blocked={clipboardBlocked} />
          <fieldset className="object-property-fields" disabled={hasLockedSelection}>
            {selectedItem?.kind === 'chart' && <ChartControls key={primarySelectedItemId} item={selectedItem} onChange={patch => updateChartItem(primarySelectedItemId, patch)} />}
            {portfolioActions && <PortfolioControls items={items} selectedIds={selectedObjectIds} canWriteItem={canWriteItem} frames={portfolioFrames} actions={portfolioActions} viewing={portfolioViewing} activeTool={activeTool} />}
            {showBatchCornerControls && <ObjectCornerControls item={selectedItem || items[cornerState.targetIds[0]]} value={cornerState.value} count={cornerState.targetIds.length} onChange={value => updateObjectCornerStyle(cornerState.targetIds, value)} />}
            {selectedItem?.kind === 'user-group' && <UserGroupControls key={primarySelectedItemId} item={selectedItem} token={token} user={user} canvasParticipants={canvasParticipants} settings={settings} onChange={patch => updateUserGroup(primarySelectedItemId, patch)} />}
            {editableShape && <>
              <section className="inspector-section"><strong className="inspector-label">{ui("선택한 도형 스타일")}</strong><VectorStyleSelector value={editableShape.visualStyle} onChange={value => updateShapeAppearance(selectedShapeIds, 'visualStyle', value)} /></section>
              <ShapeBorderControls width={editableShape.strokeWidth} onWidthChange={value => updateShapeAppearance(selectedShapeIds, 'strokeWidth', value)} enabled={editableShape.strokeEnabled !== false} color={editableShape.color} onEnabledChange={value => updateShapeAppearance(selectedShapeIds, 'strokeEnabled', value)} onColorChange={value => updateShapeAppearance(selectedShapeIds, 'color', value)} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} />
            </>}
            {primaryNonArrowShape && <ShapeFillControls inkOpacity={primaryNonArrowShape.sketchFillOpacity} onInkOpacityChange={value => updateShapeAppearance(nonArrowShapeIds, 'sketchFillOpacity', value)} opacity={primaryNonArrowShape.fillOpacity} visualStyle={primaryNonArrowShape.visualStyle} onOpacityChange={value => updateShapeAppearance(nonArrowShapeIds, 'fillOpacity', value)} value={primaryNonArrowShape.fill} onChange={value => updateShapeFill(nonArrowShapeIds, value)} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} />}
            {selectedShapes.length === 1 && <ShapeGeometryControls item={selectedShapes[0][1]} onChange={(field, value) => updateShapeAppearance([selectedShapes[0][0]], field, value)} />}
            {selectedShapes.length === 1 && isVolumeShape(editableShape.shapeType) && <section className="inspector-section"><strong className="inspector-label">{ui('입체 표현')}</strong><div className="theme-switch" role="group" aria-label={ui('입체 표현')}><button type="button" className={editableShape.volumeStyle !== 'wireframe' ? 'active' : ''} aria-pressed={editableShape.volumeStyle !== 'wireframe'} onClick={() => updateShapeAppearance([selectedShapes[0][0]], 'volumeStyle', 'solid')}>{ui('면 표시')}</button><button type="button" className={editableShape.volumeStyle === 'wireframe' ? 'active' : ''} aria-pressed={editableShape.volumeStyle === 'wireframe'} onClick={() => updateShapeAppearance([selectedShapes[0][0]], 'volumeStyle', 'wireframe')}>{ui('윤곽선')}</button></div></section>}
            {selectedConnector && <LogicPortControls item={selectedConnector} items={items} onChange={(field, value) => updateConnectorAppearance(primarySelectedItemId, field, value)} />}
            {selectedConnector && <ConnectorLabelControls item={selectedConnector} onChange={(field, value) => updateConnectorAppearance(primarySelectedItemId, field, value)} />}
            {isTextContent(selectedItem) && <ContentRenderControls item={selectedItem} onChange={(field, value) => updateContentSetting(primarySelectedItemId, field, value)} />}
            {selectedTextIds.length > 0 && <section className="inspector-section">
              <strong className="inspector-label">{ui('텍스트 색상')}</strong>
              <CanvasColorPicker color={primarySelectedText?.color || '#22242a'} onChange={nextColor => updateObjectColor(selectedTextIds, nextColor)} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label={ui('텍스트 색상')} />
              {primarySelectedText?.color && <button type="button" className="inspector-secondary-action" onClick={() => updateObjectColor(selectedTextIds, '')}><Icon name="reset" size={13} /><span>{ui('기본 색상으로 되돌리기')}</span></button>}
              <small className="inspector-hint">{ui('전체 색상을 바로 바꾸거나 텍스트를 더블 클릭해 글자별 색상을 바꿀 수 있어요.')}</small>
            </section>}
            {selectedNoteIds.length > 0 && <section className="inspector-section">
              <span className="inspector-label">{ui("포스트잇 색상")}</span>
              <div className="sticky-note-colors">{stickyNoteColors.map((swatch) => <button key={swatch} type="button" style={{ '--sticky-swatch': swatch }} className={primarySelectedNote?.color === swatch ? 'selected' : ''} onClick={() => updateObjectColor(selectedNoteIds, swatch)} aria-label={ui("포스트잇 색상 {v0}", { v0: swatch })} aria-pressed={primarySelectedNote?.color === swatch} />)}</div>
              <CanvasColorPicker color={primarySelectedNote?.color || stickyNoteColors[0]} onChange={nextColor => updateObjectColor(selectedNoteIds, nextColor)} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label={ui("포스트잇 색상")} />
            </section>}
            {selectedConnector && <ConnectorEndpointInfo connector={selectedConnector} items={items} onNavigate={onNavigateObject} />}
            <ObjectDepthControls ids={selectedObjectIds} items={items} onChange={updateItemDepth} />
            <ObjectShadowControls ids={selectedObjectIds} items={shadowItems} onChange={updateItemShadow} />
            {selectedObjectIds.length === 1 && selectedItem && <ObjectNumericControls item={selectedItem} onChange={(field, value) => updateObjectDimensions(primarySelectedItemId, field, value)} onRotationChange={value => updateItemRotation(primarySelectedItemId, value)} />}
            {selectedObjectIds.length === 1 && supportsObjectFontSize(selectedItem) && <ObjectSizeControls item={selectedItem} fontOnly={!hasIndependentContentSize(selectedItem)} onFontSizeChange={value => updateObjectFontSize(primarySelectedItemId, value)} onDimensionChange={(field, value) => updateObjectDimensions(primarySelectedItemId, field, value)} />}
            {selectedConnector && <section className="inspector-section connector-style-section"><strong className="inspector-label">{ui("선택한 화살표 스타일")}</strong><VectorStyleSelector variant="connector" value={selectedConnector.visualStyle || 'standard'} onChange={value => updateConnectorAppearance(primarySelectedItemId, 'visualStyle', value)} /><CanvasColorPicker color={selectedConnector.color || connectorColor} onChange={value => updateConnectorAppearance(primarySelectedItemId, 'color', value)} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label={ui("연결 화살표 색상")} /><label className="connector-width-control"><span>{"" + ui("굵기") + " "}<b>{Number(selectedConnector.strokeWidth) || connectorWidth}px</b></span><input id={`${fieldId}-connector-width`} name="connector-stroke-width" type="range" min="0.8" max="4" step="0.2" value={Number(selectedConnector.strokeWidth) || connectorWidth} onChange={(event) => updateConnectorAppearance(primarySelectedItemId, 'strokeWidth', event.target.value)} aria-label={ui("연결 화살표 굵기")} /></label><ArrowHeadControls item={selectedConnector} onChange={(field, value) => updateArrowHead(primarySelectedItemId, field, value)} /><small className="inspector-hint">{ui("가운데 조절점을 드래그해 몸통을 원하는 방향으로 휘어보세요.")}</small></section>}
            {selectedConnector && <section className="inspector-section"><div className="object-size-controls"><SizeInput label={ui("연결 선 굵기")} value={Number(selectedConnector.strokeWidth) || 1.5} min={.8} max={4} step={.1} onCommit={value => updateConnectorAppearance(primarySelectedItemId, 'strokeWidth', value)} /><SizeInput label={ui("곡률")} value={Math.round((Number(selectedConnector.bend) || 0) * 100)} min={0} max={150} unit="%" onCommit={value => updateConnectorAppearance(primarySelectedItemId, 'bend', value / 100)} /></div><ConnectorPointControls item={selectedConnector} onChange={count => updateConnectorAppearance(primarySelectedItemId, 'bendPointCount', count)} /><label className="connector-width-control"><span>{"" + ui("곡률") + " "}<b>{Math.round((Number(selectedConnector.bend) || 0) * 100)}%</b></span><input id={`${fieldId}-connector-bend`} name="connector-bend" type="range" min="0" max="1.5" step="0.01" value={Number(selectedConnector.bend) || 0} onChange={event => updateConnectorAppearance(primarySelectedItemId, 'bend', event.target.value)} aria-label={ui("선택한 연결 화살표 곡률")} /></label><button type="button" className="inspector-secondary-action" onClick={() => updateConnectorAppearance(primarySelectedItemId, 'bend', 0)}><Icon name="reset" size={13} /><span>{ui("곡률 초기화")}</span></button><small className="inspector-hint">{ui("곡률은 휘는 정도, 곡선 방향은 휘는 방향을 바꿉니다. 장애물이 있으면 해당 방향으로 우회합니다.")}</small></section>}
            {selectedArrow && <section className="inspector-section"><strong className="inspector-label">{ui("화살표 곡률 및 머리 모양")}</strong><ConnectorPointControls item={selectedArrow} onChange={count => updateShapeArrowBend(primarySelectedItemId, count, 'bendPointCount')} /><small className="inspector-hint">{ui("몸통 가운데 조절점을 드래그해 원하는 방향으로 휘어보세요.")}</small><button type="button" className="inspector-secondary-action" onClick={() => updateShapeArrowBend(primarySelectedItemId, 0)}><Icon name="reset" size={13} /><span>{ui("직선으로 만들기")}</span></button><ArrowHeadControls item={selectedArrow} onChange={(field, value) => updateArrowHead(primarySelectedItemId, field, value)} /></section>}
            {selectedItem && <section className="inspector-section rotation-section"><div className="zoom-sensitivity-heading"><strong>{selectedConnector ? ui("곡선 방향") : ui("객체 회전")}</strong><span>{Math.round(Number(selectedItem.rotation) || 0)}°</span></div>{selectedConnector && <input id={`${fieldId}-connector-rotation`} name="connector-rotation" type="range" min="-180" max="180" step="1" value={Math.round(Number(selectedItem.rotation) || 0)} onChange={(event) => updateItemRotation(primarySelectedItemId, event.target.value)} aria-label={ui("선택한 화살표 곡선 방향")} />}{!selectedConnector && <small className="inspector-hint">{ui("선택 객체 위쪽 핸들을 드래그해 마우스 방향을 따라 회전하세요.")}</small>}<button type="button" className="inspector-secondary-action" onClick={() => updateItemRotation(primarySelectedItemId, 0)}><Icon name="reset" size={13} /><span>{selectedConnector ? ui("방향 초기화") : ui("회전 초기화")}</span></button></section>}
            {!selectedItem && selectedObjectIds.length > 1 && <section className="inspector-section rotation-section"><strong className="inspector-label">{ui("객체 회전")}</strong><button type="button" className="inspector-secondary-action" onClick={() => updateItemRotation(selectedObjectIds, 0)}><Icon name="reset" size={13} /><span>{ui("회전 초기화")}</span></button></section>}
            {selectedTable && <section className="inspector-section"><strong className="inspector-label">{ui("테이블 설정")}</strong><div className="table-config-grid"><label>{ui("행 수")}<input id={`${fieldId}-selected-table-rows`} name="selected-table-rows" type="number" min="1" max={MAX_TABLE_ROWS} value={selectedTable.rows?.length || 1} onChange={(event) => changeTableCount('rows', event)} /></label><label>{ui("열 수")}<input id={`${fieldId}-selected-table-cols`} name="selected-table-columns" type="number" min="1" max={MAX_TABLE_COLUMNS} value={selectedTable.columns?.length || 1} onChange={(event) => changeTableCount('columns', event)} /></label><label>{ui("너비 %")}<input id={`${fieldId}-selected-table-width`} name="selected-table-width" type="number" min="10" max="100" value={Math.round((selectedTable.width || 0.42) * 100)} onChange={(event) => changeTableSize('width', event)} /></label><label>{ui("높이 %")}<input id={`${fieldId}-selected-table-height`} name="selected-table-height" type="number" min="10" max="100" value={Math.round((selectedTable.height || 0.32) * 100)} onChange={(event) => changeTableSize('height', event)} /></label></div><small className="inspector-hint">{ui("셀이나 컬럼 이름을 두 번 클릭해 Markdown으로 편집하세요.")}</small></section>}
            <AdvancedStylingInspector
              canvasId={canvasId}
              items={items}
              selectedObjectIds={selectedObjectIds}
              hasCopiedStyle={hasCopiedStyle}
              onCopyStyle={onCopyStyle}
              onPasteStyle={onPasteStyle}
              onPatchStyle={onPatchStyle}
              onPatchAllItems={onPatchAllItems}
              onFontSizeChange={(ids, value) => ids.forEach(id => updateObjectFontSize(id, value))}
              onApplyAutoLayout={onApplyAutoLayout}
            />
          </fieldset>
        </div>}
        {activeTool === 'select' && (
          <HiddenObjectsManager
            items={items}
            canWriteItem={canWriteItem}
            previewHidden={previewHiddenObjects}
            onTogglePreviewHidden={onTogglePreviewHidden}
            onSelectObject={onSelectHiddenObject || onNavigateObject}
            onToggleHidden={updateItemHidden}
            onRevealAfterAnimation={onRevealAfterAnimation}
            onUnhideAll={onUnhideAll}
            onRevealAllAfterAnimation={onRevealAllAfterAnimation}
          />
        )}
        {activeTool === 'select' && (!hasSelection || showEnvInSelection) && envSections}
        {activeTool === 'select' && !hasSelection && portfolioActions && portfolioFrames.length > 0 && <PortfolioControls items={items} selectedIds={selectedObjectIds} canWriteItem={canWriteItem} frames={portfolioFrames} actions={portfolioActions} viewing={portfolioViewing} activeTool={activeTool} />}
        {activeTool !== 'select' && <>
          {(['executor', 'execution-output', 'code'].includes(activeTool)) && <section className="inspector-section"><strong className="inspector-label">{ui('블루프린트 실행')}</strong><p className="inspector-hint">{ui('실행 객체 → 코드 객체 → 결과 객체 순서로 연결하세요. 실행 객체의 코드 실행 버튼을 눌러 실행합니다.')}</p><p className="inspector-hint">{ui('연결 화살표의 방향을 따릅니다. 결과 객체끼리 연결하면 같은 출력을 여러 곳에서 볼 수 있습니다.')}</p></section>}
          {activeTool === 'frame' && portfolioActions && <PortfolioControls items={items} selectedIds={selectedObjectIds} canWriteItem={canWriteItem} frames={portfolioFrames} actions={portfolioActions} viewing={portfolioViewing} activeTool={activeTool} />}
          {activeTool === 'shape' && <>
            <section className="inspector-section"><strong className="inspector-label">{ui("새 도형 스타일")}</strong><VectorStyleSelector value={shapeVisualStyle} onChange={setShapeVisualStyle} /></section>
            <ShapeBorderControls width={shapeBorderWidth} onWidthChange={setShapeBorderWidth} enabled={shapeStrokeEnabled} color={color} onEnabledChange={setShapeStrokeEnabled} onColorChange={setColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} />
            {shapeType !== 'arrow' && <ShapeFillControls inkOpacity={shapeSketchFillOpacity} onInkOpacityChange={setShapeSketchFillOpacity} opacity={shapeFillOpacity} visualStyle={shapeVisualStyle} onOpacityChange={setShapeFillOpacity} value={shapeFillColor} onChange={setShapeFillColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} />}
            <ShapeGeometryControls item={{ shapeType, vertexCount: shapeVertexCount, cornerStyle: shapeCornerStyle }} onChange={updateNewShapeGeometry} />
          </>}
          {activeTool === 'pen' && <><section className="inspector-section"><strong className="inspector-label">{ui("펜 스타일")}</strong><PenStyleControls brush={penBrush} opacity={penOpacity} onBrushChange={changePenBrush} onOpacityChange={changePenOpacity} /></section><section className="inspector-section"><span className="inspector-label">{ui("선 색상")}</span><CanvasColorPicker color={color} onChange={setColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label={ui("드로잉 색상")} /></section><section className="inspector-section stroke-width-section"><div className="zoom-sensitivity-heading"><strong>{ui("선 굵기")}</strong><span>{strokeWidth}px</span></div><input id={`${fieldId}-pen-stroke-width`} name="pen-stroke-width" type="range" min={MIN_STROKE_WIDTH} max={MAX_STROKE_WIDTH} step="1" value={strokeWidth} onChange={changeStrokeWidth} aria-label={ui("드로잉 선 굵기")} /><small>{ui("새로 그리는 선에 적용됩니다.")}</small></section></>}
          {activeTool === 'user-group' && <UserGroupToolSettings settings={settings} canvasParticipants={canvasParticipants} user={user} token={token} onInsert={onInsertUserGroup} onTemplateChange={onUserGroupTemplateChange} />}
          {activeTool === 'question' && <section className="inspector-section"><strong className="inspector-label">{ui('문제 객체')}</strong><small className="inspector-hint">{ui('캔버스를 클릭하거나 드래그해 크기를 정해 놓으세요.')}</small><small className="inspector-hint">{ui('캔버스에 문제를 놓고 객관식 또는 주관식으로 작성하세요. 공동 답안과 수동 채점 결과는 참가자들과 공유합니다.')}</small></section>}
          {activeTool === 'chart' && <section className="inspector-section"><strong className="inspector-label">{ui('그래프 추가')}</strong><small className="inspector-hint">{ui('캔버스를 클릭하거나 드래그해 크기를 정해 놓으세요.')}</small></section>}
          {activeTool === 'laser' && <section className="inspector-section"><strong className="inspector-label">{ui("레이저 포인터")}</strong><small className="inspector-hint">{ui("드래그해 가리키면 흔적이 1.6초 동안 서서히 사라집니다. 다른 참여자에게도 실시간으로 보여요.")}</small></section>}
          {activeTool === 'laser' && setLaserColor && <section className="inspector-section"><span className="inspector-label">{ui("레이저 색상")}</span><CanvasColorPicker color={laserColor} onChange={setLaserColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label={ui("레이저 색상")} /><button type="button" className="inspector-secondary-action" onClick={() => setLaserColor(LASER_COLOR)}>{ui("기본 색상으로 되돌리기")}</button></section>}
          {activeTool === 'eraser' && <section className="inspector-section"><strong className="inspector-label">{ui("드로잉 지우개")}</strong><EraserModeControl value={eraserMode} onChange={changeEraserMode} /><EraserSizeControl value={eraserWidth} onChange={changeEraserWidth} /></section>}
          {activeTool === 'shape' && <section className="inspector-section"><span className="inspector-label">{ui("도형 종류")}</span><ShapePicker value={shapeType} onChange={setShapeType} />{shapeType === 'arrow' && <><ArrowHeadControls item={{ headSize: shapeArrowHeadSize, startHead: shapeArrowStartHead, endHead: shapeArrowEndHead, visualStyle: shapeVisualStyle }} onChange={updateNewShapeArrowHead} /><small className="inspector-hint">{ui("이 모양은 새 화살표에 적용됩니다.")}</small></>}<small className="inspector-hint">{ui("캔버스를 클릭하거나 드래그해 도형을 놓으세요.")}</small></section>}
          {activeTool === 'note' && <section className="inspector-section"><span className="inspector-label">{ui("포스트잇 색상")}</span><div className="sticky-note-colors">{stickyNoteColors.map((swatch) => <button key={swatch} type="button" style={{ '--sticky-swatch': swatch }} className={noteColor === swatch ? 'selected' : ''} onClick={() => setNoteColor(swatch)} aria-label={ui("포스트잇 색상 {v0}", { v0: swatch })} aria-pressed={noteColor === swatch} />)}</div><CanvasColorPicker color={noteColor} onChange={setNoteColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label={ui("포스트잇 색상")} /><small className="inspector-hint">{ui("캔버스를 클릭하거나 드래그해 Markdown 포스트잇을 놓으세요.")}</small></section>}
          {activeTool === 'link' && <section className="inspector-section"><strong className="inspector-label">{ui("동영상·링크 공유")}</strong><small className="inspector-hint">{ui("캔버스를 클릭하거나 드래그하고 YouTube, 동영상 주소 또는 웹 링크를 입력하세요.")}</small></section>}
          {activeTool === 'connect' && <section className="inspector-section connector-style-section"><strong className="inspector-label">{ui("새 연결 스타일")}</strong><VectorStyleSelector variant="connector" value={connectorVisualStyle} onChange={setConnectorVisualStyle} /><CanvasColorPicker color={connectorColor} onChange={setConnectorColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label={ui("연결 화살표 색상")} /><label className="connector-width-control"><span>{"" + ui("굵기") + " "}<b>{connectorWidth}px</b></span><input id={`${fieldId}-new-connector-width`} name="new-connector-stroke-width" type="range" min="0.8" max="4" step="0.2" value={connectorWidth} onChange={(event) => setConnectorWidth(Number(event.target.value))} aria-label={ui("연결 화살표 굵기")} /></label><ArrowHeadControls item={{ headSize: connectorHeadSize, startHead: connectorStartHead, endHead: connectorEndHead, visualStyle: connectorVisualStyle }} onChange={updateNewConnectorHead} /><small className="inspector-hint">{ui("화살표는 회색으로 시작하며, 연결 도구에서 새 연결의 색과 굵기를 설정할 수 있어요.")}</small></section>}
          {activeTool === 'table' && <section className="inspector-section"><strong className="inspector-label">{ui("새 테이블 설정")}</strong><div className="table-config-grid"><label>{ui("행 수")}<input id={`${fieldId}-new-table-rows`} name="new-table-rows" type="number" min="1" max={MAX_TABLE_ROWS} value={tableConfig.rows} onChange={(event) => changeTableCount('rows', event)} /></label><label>{ui("열 수")}<input id={`${fieldId}-new-table-cols`} name="new-table-columns" type="number" min="1" max={MAX_TABLE_COLUMNS} value={tableConfig.columns} onChange={(event) => changeTableCount('columns', event)} /></label><label>{ui("너비 %")}<input id={`${fieldId}-new-table-width`} name="new-table-width" type="number" min="10" max="100" value={tableConfig.width} onChange={(event) => changeTableSize('width', event)} /></label><label>{ui("높이 %")}<input id={`${fieldId}-new-table-height`} name="new-table-height" type="number" min="10" max="100" value={tableConfig.height} onChange={(event) => changeTableSize('height', event)} /></label></div><small className="inspector-hint">{ui("설정 후 캔버스를 클릭하거나 드래그해 놓으세요.")}</small></section>}
          {(activeTool === 'text' || activeTool === 'code') && <section className="inspector-section"><strong className="inspector-label">{activeTool === 'text' ? ui("내용 작성") : ui("코드 작성")}</strong><small className="inspector-hint">{ui("캔버스를 클릭하거나 드래그해 내용을 작성하고, 객체 선택 후 표시 방식을 변경하세요.")}</small></section>}
        </>}
      </aside>
  );
}
