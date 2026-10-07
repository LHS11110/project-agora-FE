import CanvasBackgroundControls from '../../canvas/background/CanvasBackgroundControls.jsx';
import UserAvatar from '../account/UserAvatar.jsx';
import ObjectRecoveryControls from '../../canvas/diagnostics/ObjectRecoveryControls.jsx';
import ObjectClipboardControls from '../../canvas/clipboard/ObjectClipboardControls.jsx';
import UserGroupControls from '../../canvas/userGroups/UserGroupControls.jsx';
import ShapeFillControls from '../../canvas/ShapeFillControls.jsx';
import ConnectorPointControls from './ConnectorPointControls.jsx';
import './inspector-actions.css';
import ContentRenderControls from '../../canvas/content/ContentRenderControls.jsx';
import { isTextContent } from '../../canvas/content/contentPresentation.js';
import ConnectorLabelControls from './ConnectorLabelControls.jsx';
import ConnectorEndpointInfo from './ConnectorEndpointInfo.jsx';
import PenStyleControls from '../../canvas/PenStyleControls.jsx';
import { hasIndependentContentSize } from '../../canvas/objectSize.js';
import ObjectSizeControls from '../../canvas/ObjectSizeControls.jsx';
import ShapePicker from '../../canvas/ShapePicker.jsx';
import EraserSizeControl from '../../canvas/EraserSizeControl.jsx';
import CanvasColorPicker from '../../canvas/CanvasColorPicker.jsx';
import Icon from '../Icon.jsx';
import ArrowHeadControls from '../ArrowHeadControls.jsx';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../tableModel.js';
import { MAX_STROKE_WIDTH, MAX_ZOOM_SENSITIVITY, MIN_STROKE_WIDTH, MIN_ZOOM_SENSITIVITY, stickyNoteColors } from '../../canvas/canvasConstants.js';

export default function CanvasInspectorPanel({
  activeTool,
  updateContentSetting,
  canvasId,
  canvasParticipants,
  changeSelectionGroup,
  changeStrokeWidth,
  eraserWidth,
  changeEraserWidth,
  changeTableCount,
  changeTableSize,
  changeTheme,
  changeZoomSensitivity,
  color,
  connection,
  connectorColor,
  connectorEndHead,
  connectorStartHead,
  connectorToEdit,
  connectorWidth,
  items,
  onNavigateObject,
  noteColor,
  primarySelectedItemId,
  selectItems,
  selectedArrow,
  selectedConnector,
  selectedItem,
  objectClipboard, clipboardBlocked, deleteItem,
  user, token, updateUserGroup,
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
  shapeArrowEndHead,
  shapeArrowStartHead,
  shapeType,
  shapeFillColor, setShapeFillColor, updateShapeFill,
  showGrid,
  strokeWidth,
  penBrush, penOpacity, changePenBrush, changePenOpacity,
  tableConfig,
  theme,
  toggleGrid,
  updateArrowHead,
  updateConnectorAppearance,
  updateItemRotation,
  updateObjectDimensions,
  updateObjectFontSize,
  updateNewConnectorHead,
  updateNewShapeArrowHead,
  updateShapeArrowBend,
  zoomSensitivity
}) {
  return (
      <aside className={`canvas-sidepanel canvas-inspector${activeTool === 'select' ? ' server-settings-mode' : ' tool-settings-mode'}`}><div className="inspector-heading"><div><span className="section-kicker">{activeTool === 'select' ? 'WORKSPACE' : 'TOOL SETTINGS'}</span><h2>{activeTool === 'select' ? '환경 설정' : `${({ 'user-group': '사용자 그룹', pen: '드로잉', laser: '레이저 포인터', eraser: '지우개', connect: '연결', shape: '도형', text: '텍스트', note: '포스트잇', math: '수식', table: '테이블', code: '코드', link: '동영상·링크' })[activeTool] || '도구'} 설정`}</h2></div>{activeTool === 'select' && <button className="icon-button" onClick={() => setShowSettings(true)} aria-label="캔버스 세부 설정"><Icon name="settings" size={18} /></button>}</div>
        {activeTool === 'select' && <ObjectRecoveryControls items={items} onDelete={deleteItem} />}
        {activeTool === 'select' && <ObjectClipboardControls actions={objectClipboard} selectedCount={selectedObjectIds.length} blocked={clipboardBlocked} />}
        {selectedItem?.kind === 'user-group' && <UserGroupControls key={primarySelectedItemId} item={selectedItem} token={token} user={user} onChange={patch => updateUserGroup(primarySelectedItemId, patch)} />}
        {selectedItem?.kind === 'shape' && selectedItem.shapeType !== 'arrow' && <ShapeFillControls value={selectedItem.fill} onChange={value => updateShapeFill(primarySelectedItemId, value)} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} />}
        {activeTool === 'shape' && shapeType !== 'arrow' && <ShapeFillControls value={shapeFillColor} onChange={setShapeFillColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} />}
        {selectedConnector && <ConnectorLabelControls item={selectedConnector} onChange={(field, value) => updateConnectorAppearance(primarySelectedItemId, field, value)} />}
        {isTextContent(selectedItem) && <ContentRenderControls item={selectedItem} onChange={(field, value) => updateContentSetting(primarySelectedItemId, field, value)} />}
        {selectedConnector && <ConnectorEndpointInfo connector={selectedConnector} items={items} onNavigate={onNavigateObject} />}
        {activeTool === 'select' && <>
        <section className="inspector-section"><div className="inspector-label">화면 모드</div><div className="theme-switch" role="group" aria-label="테마 선택"><button className={theme === 'light' ? 'active' : ''} aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}><Icon name="sun" size={16} />라이트</button><button className={theme === 'dark' ? 'active' : ''} aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}><Icon name="moon" size={16} />다크</button></div></section>
        <section className="inspector-section"><div className="inspector-switch-row"><span><strong>좌표 격자</strong><small>2차 평면 가이드라인</small></span><button className={`toggle-switch${showGrid ? ' on' : ''}`} role="switch" aria-checked={showGrid} onClick={toggleGrid}><i /></button></div><div className="axis-preview"><span>X축</span><i /><span>Y축</span><i className="axis-preview-origin" /></div></section>
        <section className="inspector-section zoom-sensitivity-section"><div className="zoom-sensitivity-heading"><strong>줌 감도</strong><span>{Math.round(zoomSensitivity * 100)}%</span></div><input type="range" min={MIN_ZOOM_SENSITIVITY} max={MAX_ZOOM_SENSITIVITY} step="0.1" value={zoomSensitivity} onChange={changeZoomSensitivity} aria-label="줌 감도" /><small>휠과 확대·축소 버튼 반응 속도</small></section>
        {(selectedObjectIds.length > 1 || selectedObjectIds.some((id) => items[id]?.groupId)) && <section className="inspector-section selection-actions-section"><div className="selection-actions-heading"><strong>{selectedObjectIds.length}개 오브젝트 선택됨</strong><button type="button" onClick={() => selectItems([])}>선택 해제</button></div><small className="inspector-hint">빈 공간을 드래그해 여러 개를 선택하고, Shift를 누른 채 개별 선택을 더할 수 있어요.</small>{selectedObjectIds.some((id) => ['text', 'code'].includes(items[id]?.kind)) && <small className="inspector-hint">텍스트와 코드는 Ctrl + S로 저장하며, 포스트잇은 변경 후 자동 저장합니다.</small>}<div className="selection-actions-buttons"><button type="button" className="button button-dark" disabled={!selectionIsSingleGroup && selectedObjectIds.filter((id) => !['stroke', 'connector'].includes(items[id]?.kind)).length < 2} onClick={() => changeSelectionGroup(!selectionIsSingleGroup)}>{selectionIsSingleGroup ? '그룹 해제' : '그룹화'}</button></div></section>}
        </>}
        {selectedObjectIds.length === 1 && hasIndependentContentSize(selectedItem) && <ObjectSizeControls item={selectedItem} onFontSizeChange={value => updateObjectFontSize(primarySelectedItemId, value)} onDimensionChange={(field, value) => updateObjectDimensions(primarySelectedItemId, field, value)} />}
        {activeTool !== 'select' && <section className="inspector-section tool-settings-summary"><strong className="inspector-label">선택한 도구</strong><small className="inspector-hint">캔버스에서 사용할 도구의 설정을 조정하세요. 커서 도구를 선택하면 워크스페이스 설정으로 돌아갑니다.</small></section>}
        {activeTool === 'pen' && <><section className="inspector-section"><strong className="inspector-label">펜 스타일</strong><PenStyleControls brush={penBrush} opacity={penOpacity} onBrushChange={changePenBrush} onOpacityChange={changePenOpacity} /></section><section className="inspector-section"><span className="inspector-label">선 색상</span><CanvasColorPicker color={color} onChange={setColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label="드로잉 색상" /></section><section className="inspector-section stroke-width-section"><div className="zoom-sensitivity-heading"><strong>선 굵기</strong><span>{strokeWidth}px</span></div><input type="range" min={MIN_STROKE_WIDTH} max={MAX_STROKE_WIDTH} step="1" value={strokeWidth} onChange={changeStrokeWidth} aria-label="드로잉 선 굵기" /><small>새로 그리는 선에 적용됩니다.</small></section></>}
        {activeTool === 'user-group' && <section className="inspector-section"><strong className="inspector-label">사용자 그룹 배치</strong><small className="inspector-hint">캔버스의 원하는 위치를 클릭하세요. 생성한 그룹을 선택하면 사용자와 색상을 설정할 수 있습니다.</small></section>}
        {activeTool === 'laser' && <section className="inspector-section"><strong className="inspector-label">레이저 포인터</strong><small className="inspector-hint">드래그해 가리키면 흔적이 1.6초 동안 서서히 사라집니다. 다른 참여자에게도 실시간으로 보여요.</small></section>}{activeTool === 'eraser' && <section className="inspector-section"><strong className="inspector-label">드로잉 지우개</strong><EraserSizeControl value={eraserWidth} onChange={changeEraserWidth} /><small className="inspector-hint">지우려는 선 위를 드래그하면 닿은 부분만 지워집니다. 드로잉은 개체로 선택되지 않습니다.</small></section>}
        {activeTool === 'shape' && <><section className="inspector-section"><span className="inspector-label">도형 테두리 색상</span><CanvasColorPicker color={color} onChange={setColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label="도형 색상" /></section><section className="inspector-section"><span className="inspector-label">도형 종류</span><ShapePicker value={shapeType} onChange={setShapeType} />{shapeType === 'arrow' && <><ArrowHeadControls item={{ startHead: shapeArrowStartHead, endHead: shapeArrowEndHead }} onChange={updateNewShapeArrowHead} /><small className="inspector-hint">이 모양은 새 화살표에 적용됩니다.</small></>}<small className="inspector-hint">캔버스를 클릭해 도형을 놓으세요.</small></section></>}
        {activeTool === 'note' && <section className="inspector-section"><span className="inspector-label">포스트잇 색상</span><div className="sticky-note-colors">{stickyNoteColors.map((swatch) => <button key={swatch} type="button" style={{ '--sticky-swatch': swatch }} className={noteColor === swatch ? 'selected' : ''} onClick={() => setNoteColor(swatch)} aria-label={`포스트잇 색상 ${swatch}`} aria-pressed={noteColor === swatch} />)}</div><CanvasColorPicker color={noteColor} onChange={setNoteColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label="포스트잇 색상" /><small className="inspector-hint">캔버스를 클릭해 Markdown 포스트잇을 놓으세요.</small></section>}
        {activeTool === 'link' && <section className="inspector-section"><strong className="inspector-label">동영상·링크 공유</strong><small className="inspector-hint">캔버스를 클릭하고 YouTube, 동영상 주소 또는 웹 링크를 입력하세요.</small></section>}
        {(activeTool === 'connect' || (activeTool === 'select' && selectedConnector)) && <section className="inspector-section connector-style-section"><strong className="inspector-label">{connectorToEdit ? '선택한 화살표 스타일' : '새 연결 스타일'}</strong><CanvasColorPicker color={connectorToEdit?.color || connectorColor} onChange={value => connectorToEdit ? updateConnectorAppearance(primarySelectedItemId, 'color', value) : setConnectorColor(value)} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label="연결 화살표 색상" /><label className="connector-width-control"><span>굵기 <b>{Number(connectorToEdit?.strokeWidth) || connectorWidth}px</b></span><input type="range" min="0.8" max="4" step="0.2" value={Number(connectorToEdit?.strokeWidth) || connectorWidth} onChange={(event) => connectorToEdit ? updateConnectorAppearance(primarySelectedItemId, 'strokeWidth', event.target.value) : setConnectorWidth(Number(event.target.value))} aria-label="연결 화살표 굵기" /></label><ArrowHeadControls item={connectorToEdit || { startHead: connectorStartHead, endHead: connectorEndHead }} onChange={(field, value) => connectorToEdit ? updateArrowHead(primarySelectedItemId, field, value) : updateNewConnectorHead(field, value)} /><small className="inspector-hint">화살표는 회색으로 시작하며, 연결 도구에서 새 연결의 색과 굵기를 설정할 수 있어요.</small>{selectedConnector && <small className="inspector-hint">가운데 조절점을 드래그해 몸통을 원하는 방향으로 휘어보세요.</small>}</section>}
        {selectedConnector && <section className="inspector-section"><ConnectorPointControls item={selectedConnector} onChange={count => updateConnectorAppearance(primarySelectedItemId, 'bendPointCount', count)} /><label className="connector-width-control"><span>곡률 <b>{Math.round((Number(selectedConnector.bend) || 0) * 100)}%</b></span><input type="range" min="0" max="1.5" step="0.01" value={Number(selectedConnector.bend) || 0} onChange={event => updateConnectorAppearance(primarySelectedItemId, 'bend', event.target.value)} aria-label="선택한 연결 화살표 곡률" /></label><button type="button" className="inspector-secondary-action" onClick={() => updateConnectorAppearance(primarySelectedItemId, 'bend', 0)}><Icon name="reset" size={13} /><span>곡률 초기화</span></button><small className="inspector-hint">곡률은 휘는 정도, 곡선 방향은 휘는 방향을 바꿉니다. 장애물이 있으면 해당 방향으로 우회합니다.</small></section>}
        {activeTool === 'select' && selectedArrow && <section className="inspector-section"><strong className="inspector-label">화살표 곡률 및 머리 모양</strong><small className="inspector-hint">몸통 가운데 조절점을 드래그해 원하는 방향으로 휘어보세요.</small><button type="button" className="inspector-secondary-action" onClick={() => updateShapeArrowBend(primarySelectedItemId, 0)}><Icon name="reset" size={13} /><span>직선으로 만들기</span></button><ArrowHeadControls item={selectedArrow} onChange={(field, value) => updateArrowHead(primarySelectedItemId, field, value)} /></section>}
        {activeTool === 'select' && selectedItem && <section className="inspector-section rotation-section"><div className="zoom-sensitivity-heading"><strong>{selectedConnector ? '곡선 방향' : '객체 회전'}</strong><span>{Math.round(Number(selectedItem.rotation) || 0)}°</span></div>{selectedConnector && <input type="range" min="-180" max="180" step="1" value={Math.round(Number(selectedItem.rotation) || 0)} onChange={(event) => updateItemRotation(primarySelectedItemId, event.target.value)} aria-label="선택한 화살표 곡선 방향" />}{!selectedConnector && <small className="inspector-hint">선택 객체 위쪽 핸들을 드래그해 마우스 방향을 따라 회전하세요.</small>}<button type="button" onClick={() => updateItemRotation(primarySelectedItemId, 0)}>{selectedConnector ? '방향 초기화' : '회전 초기화'}</button></section>}
        {(activeTool === 'table' || (activeTool === 'select' && selectedTable)) && <section className="inspector-section"><strong className="inspector-label">{activeTool === 'table' ? '새 테이블 설정' : '테이블 설정'}</strong><div className="table-config-grid"><label>행 수<input type="number" min="1" max={MAX_TABLE_ROWS} value={activeTool === 'table' ? tableConfig.rows : selectedTable.rows?.length || 1} onChange={(event) => changeTableCount('rows', event)} /></label><label>열 수<input type="number" min="1" max={MAX_TABLE_COLUMNS} value={activeTool === 'table' ? tableConfig.columns : selectedTable.columns?.length || 1} onChange={(event) => changeTableCount('columns', event)} /></label><label>너비 %<input type="number" min="10" max="100" value={activeTool === 'table' ? tableConfig.width : Math.round((selectedTable.width || 0.42) * 100)} onChange={(event) => changeTableSize('width', event)} /></label><label>높이 %<input type="number" min="10" max="100" value={activeTool === 'table' ? tableConfig.height : Math.round((selectedTable.height || 0.32) * 100)} onChange={(event) => changeTableSize('height', event)} /></label></div><small className="inspector-hint">{activeTool === 'table' ? '설정 후 캔버스를 클릭해 놓으세요.' : '셀이나 컬럼 이름을 두 번 클릭해 Markdown으로 편집하세요.'}</small></section>}
        {(activeTool === 'text' || activeTool === 'code') && <section className="inspector-section"><strong className="inspector-label">{activeTool === 'text' ? '내용 작성' : '코드 작성'}</strong><small className="inspector-hint">캔버스를 클릭해 내용을 작성하고, 객체 선택 후 표시 방식을 변경하세요.</small></section>}
        {activeTool === 'select' && <>
        <section className="inspector-section inspector-stats"><div><span>캔버스 ID</span><strong>#{canvasId}</strong></div><div><span>오브젝트</span><strong>{Object.values(items).filter(item => item?.type !== 'chat_room').length}</strong></div><div><span>설정 revision</span><strong>{settings?.settings_revision ?? '—'}</strong></div></section>
        {activeTool === 'select' && <CanvasBackgroundControls {...{ backgroundColor, setBackgroundColor, favoriteColors, saveFavoriteColor, theme }} />}<section className="inspector-members"><div className="member-panel-title"><strong>참여자</strong><span>{canvasParticipants.length}명</span></div>{canvasParticipants.slice(0, 5).map((person, index) => <div className="member-row" key={`${person.nickname}-${person.tag_number}`}><UserAvatar user={person} token={token} className="avatar-small" /><span><strong>{person.nickname} <small>#{person.tag_number}</small></strong><small>{index === 0 ? '캔버스 멤버' : '참여자'}</small></span></div>)}</section>
        </>}
        <div className="sidepanel-bottom"><span className={`online-indicator ${connection}`} role="status" aria-live="polite"><i /> {connection === 'connected' ? '연결됨' : connection === 'connecting' ? '연결 중' : '연결 해제'}</span></div>
      </aside>
  );
}
