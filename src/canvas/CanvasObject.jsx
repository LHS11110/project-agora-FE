import CanvasImageContent from './CanvasImageContent.jsx';
import { supportsObjectCorners } from './objectCorners.js';
import './object-corners.css';
import EditingSurface from './content/EditingSurface.jsx';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { canvasObjectPropsEqual } from './canvasRenderEquality.js';
import { objectShadowStyle } from './objectShadow.js';
import { strokeSelectionGeometry } from './strokeSelection.js';
import './object-shadow.css';
import PdfDocumentContent from './pdf/PdfDocumentContent.jsx';
import UserGroupContent from './userGroups/UserGroupContent.jsx';
import ConnectorBendHandles from '../components/canvas/ConnectorBendHandles.jsx';
import UnifiedTextContent from './content/UnifiedTextContent.jsx';
import BlueprintNode from './runtime/BlueprintNode.jsx';
import { contentMode, isTextContent } from './content/contentPresentation.js';
import ConnectorLabel from '../components/canvas/ConnectorLabel.jsx';
import ConnectorSelectionEffect from '../components/canvas/ConnectorSelectionEffect.jsx';
import { measureConnectorObject } from './connectors/objectMetrics.js';
import { useEditingBoundary } from './useEditingBoundary.js';
import './image-object.css';
import { scaleObjectElement } from './ScalableObjectContent.jsx';
import { handleObjectDoubleClick } from './objectDoubleClick.js';
import { cloneElement, memo, useMemo, useLayoutEffect, useRef } from 'react';
import Icon from '../components/Icon.jsx';
import MarkdownText from '../components/MarkdownText.jsx';
import EditableTable from '../components/EditableTable.jsx';
import ChartView from './charts/ChartView.jsx';
import SharedMediaContent from '../components/SharedMediaContent.jsx';
import ResizeHandles from '../components/ResizeHandles.jsx';
import ConnectorArrowheads from '../components/canvas/ConnectorArrowheads.jsx';
import './object-interaction.css';
import './markdown-text.css';
import { shapeArrowGeometry } from '../components/shapeArrowGeometry.js';
import { updateTableValue } from '../components/tableModel.js';
import { stickyNoteColors } from './canvasConstants.js';
import { moveTextPosition, textSpliceBetween } from './collaborativeText.js';

function CanvasObjectView({ id, item, bounds, selected, allowSingleSelectionControls, activeTool, connectionStartId, editing, dirty, remoteEditors = [], connectorCurve, viewSize, token, runtimeStore, onStartEditing, onTextChange, onTextColorChange, onMetadataChange, onFormulaChange, onTableChange, onStopEditing, onSave, onPointerDown, onResizeStart, onArrowBendStart, onPointerMove, onPointerUp, onCopy, onConnectorDoubleClick }) {
  useUiLocale();
  const collaborativeValue = String(item.kind === 'code' ? item.code || '' : item.text || '');
  const geometryElementRef = useRef(null);
  useLayoutEffect(() => {
    const element = geometryElementRef.current;
    if (!element || ['stroke', 'connector'].includes(item.kind)) return undefined;
    const measure = () => measureConnectorObject(item, element);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [item]);
  const collaborativeEditorRef = useRef(null);
  const selectingPointerRef = useRef(false);
  const collaborativeSelectionRef = useRef(null);
  const displayedCollaborativeValueRef = useRef(collaborativeValue);
  const remoteEditorLabel = remoteEditors.length
    ? ui("함께 편집 중 · {v0}{v1}", {
  v0: remoteEditors.slice(0, 2).map(editor => `${editor.nickname}#${editor.tag_number}`).join(', '),
  v1: remoteEditors.length > 2 ? ui(" 외 {v0}명", {
    v0: remoteEditors.length - 2
  }) : ''
})
    : '';
  const rememberCollaborativeSelection = (event) => {
    const editor = event.currentTarget;
    displayedCollaborativeValueRef.current = editor.value;
    collaborativeSelectionRef.current = {
      start: editor.selectionStart,
      end: editor.selectionEnd,
      direction: editor.selectionDirection || 'none',
    };
  };
  const handleCollaborativeInput = (event) => {
    const editor = event.currentTarget;
    displayedCollaborativeValueRef.current = editor.value;
    collaborativeSelectionRef.current = {
      start: editor.selectionStart,
      end: editor.selectionEnd,
      direction: editor.selectionDirection || 'none',
    };
    onTextChange(id, editor.value);
  };
  useLayoutEffect(() => {
    const editor = collaborativeEditorRef.current;
    const previousValue = displayedCollaborativeValueRef.current;
    if (editor && document.activeElement === editor && previousValue !== collaborativeValue) {
      const change = textSpliceBetween(previousValue, collaborativeValue);
      const selection = collaborativeSelectionRef.current;
      if (selection) {
        const start = Math.max(0, Math.min(collaborativeValue.length, moveTextPosition(selection.start, change)));
        const end = Math.max(0, Math.min(collaborativeValue.length, moveTextPosition(selection.end, change)));
        editor.setSelectionRange(start, end, selection.direction);
        collaborativeSelectionRef.current = { start, end, direction: selection.direction };
      }
    }
    displayedCollaborativeValueRef.current = collaborativeValue;
  }, [collaborativeValue]);
  const editingBoundary = useEditingBoundary(editing && item.kind === 'note', () => {
    onStopEditing(id);
    if (item.kind === 'note' && dirty) onSave(id, { silent: true });
  });
  const width = Number(item.width) || ({ image: 0.3, code: 0.32, shape: 0.14, math: 0.2, text: 0.22, note: 0.22, table: 0.42, link: 0.3 }[item.kind] || 0.2);
  const height = Number(item.height) || ({ shape: 0.12, math: 0.09, text: 0.12, note: 0.15, table: 0.32, link: 0.15 }[item.kind] || 0.2);
  const style = { ...objectShadowStyle(item), left: `${(Number(item.x) || 0) * 100}%`, top: `${(Number(item.y) || 0) * 100}%`, width: `${width * 100}%`, '--object-color': item.color || '#617d68', '--object-rotation': `${Number(item.rotation) || 0}deg` };
  if (item.height) style.height = `${height * 100}%`;
  const movable = activeTool === 'select' && selected;
  const classes = `canvas-object canvas-object-${item.kind}${movable ? ' movable' : ''}${selected ? ' selected' : ''}${connectionStartId === id ? ' connection-source' : ''}${item.height ? ' has-custom-height' : ''}`;
  const handlers = {
    ...(supportsObjectCorners(item) && item.cornerStyle ? { 'data-corner-style': item.cornerStyle } : {}),
    ref: editingBoundary.ref,
    'data-item-id': id,
    onDoubleClickCapture: (event) => handleObjectDoubleClick(event, { id, item, activeTool, editing, onStartEditing, onConnectorDoubleClick }),
    onPointerDownCapture: (event) => {
      if (event.target.closest?.('[data-object-action]')) { selectingPointerRef.current = false; return; }
      if (editing || event.target.closest?.('.canvas-code-editor')) { selectingPointerRef.current = false; return; }
      selectingPointerRef.current = activeTool === 'select' && !selected && event.button === 0
        && !event.shiftKey;
      if (!selectingPointerRef.current) return;
      event.preventDefault(); event.stopPropagation();
      onPointerDown(event, id, item);
    },
    onClickCapture: (event) => {
      if (event.target.closest?.('[data-object-action]')) { selectingPointerRef.current = false; return; }
      if (editing || event.target.closest?.('.canvas-code-editor')) { selectingPointerRef.current = false; return; }
      if (!selectingPointerRef.current && (editing || !event.target.closest?.('a'))) return;
      selectingPointerRef.current = false;
      event.preventDefault(); event.stopPropagation();
    },
    onPointerDown: (event) => { if (editing) { event.stopPropagation(); return; } onPointerDown(event, id, item); },
    onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onLostPointerCapture: onPointerUp,
  };
  const resizeHandles = selected && allowSingleSelectionControls && movable && !editing && item.kind !== 'connector'
    ? <ResizeHandles onPointerDown={(event, handle) => onResizeStart(event, id, item, handle)} />
    : null;
  // Keep content mounted when selection adds controls, preserving double-click targets.
  const withResizeHandles = (element) => scaleObjectElement(cloneElement(element,
    { ref: node => { geometryElementRef.current = node; editingBoundary.ref.current = node; }, className: `${element.props.className}${resizeHandles ? ' resizeable' : ''}` },
    <>{element.props.children}{resizeHandles && <button type="button" className="object-move-handle" aria-label={ui("선택한 객체 이동")} title={ui("잡고 끌어 객체 이동")} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onPointerDown(event, id, item); }}><Icon name="move" size={16} /></button>}{resizeHandles}</>), item);


  if (item.kind === 'shape' && ['executor', 'output'].includes(item.runtimeRole)) return withResizeHandles(<div className={`${classes} blueprint-object`} style={style} {...handlers}><BlueprintNode id={id} item={item} store={runtimeStore} selected={selected} /></div>);
  if (item.kind === 'pdf') return withResizeHandles(<div className={`${classes} pdf-object`} style={style} {...handlers}><PdfDocumentContent item={item} token={token} interactive={selected && activeTool === 'select'} /></div>);
  if (item.kind === 'user-group') return withResizeHandles(<div className={`${classes} user-group-object`} style={style} {...handlers}><UserGroupContent item={item} token={token} /></div>);
  if (item.kind === 'stroke') {
    const geometry = strokeSelectionGeometry(item, viewSize);
    if (!geometry) return null;
    const strokeStyle = { ...style, left: `${geometry.x / viewSize.width * 100}%`, top: `${geometry.y / viewSize.height * 100}%`, width: `${geometry.width / viewSize.width * 100}%`, height: `${geometry.height / viewSize.height * 100}%` };
    const point = geometry.points[0];
    return withResizeHandles(<div className={classes} style={strokeStyle} {...handlers} aria-label={ui("드로잉 객체")}>
      <svg className="stroke-selection-path" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
        {geometry.points.length === 1 ? <circle cx={point.x} cy={point.y} r=".1" strokeWidth={geometry.hitWidth} />
          : <polyline points={geometry.points.map(p => `${p.x},${p.y}`).join(' ')} strokeWidth={geometry.hitWidth} />}
      </svg>
    </div>);
  }
  if (item.kind === 'connector') {
    const vectorStyle = { ...style, left: `${(bounds?.minX ?? 0) * 100}%`, top: `${(bounds?.minY ?? 0) * 100}%`, width: `${Math.max(0.01, (bounds?.maxX ?? 0.2) - (bounds?.minX ?? 0)) * 100}%`, height: `${Math.max(0.01, (bounds?.maxY ?? 0.12) - (bounds?.minY ?? 0)) * 100}%` };
    const geometryWidth = Math.max(1, (bounds.maxX - bounds.minX) * viewSize.width);
    const geometryHeight = Math.max(1, (bounds.maxY - bounds.minY) * viewSize.height);
    const offsetX = bounds.minX * viewSize.width;
    const offsetY = bounds.minY * viewSize.height;
    if (!connectorCurve?.points?.length) return <div className={`${classes} broken-connector-object`} style={vectorStyle} {...handlers}>{ui("연결 경로를 표시할 수 없습니다")}</div>;
    const curvePath = connectorCurve?.points.map((point, index) => `${index ? 'L' : 'M'}${point.x - offsetX} ${point.y - offsetY}`).join(' ');
    const connectorEnds = [connectorCurve?.start, connectorCurve?.end].filter(Boolean);
    const bendHandle = selected && allowSingleSelectionControls && movable && !editing
      ? <ConnectorBendHandles geometry={connectorCurve} offsetX={offsetX} offsetY={offsetY} width={geometryWidth} height={geometryHeight} onStart={(event, index) => onArrowBendStart(event, id, item, index)} />
      : null;
    return withResizeHandles(<div key={id} className={`${classes} vector-object-hit`} style={vectorStyle} data-item-id={id} {...handlers} title={ui("한 번 클릭해 선택 · 두 번 클릭해 연결된 객체로 이동")}>{curvePath && <svg className="connector-hit-path" viewBox={`0 0 ${geometryWidth} ${geometryHeight}`} preserveAspectRatio="none" aria-hidden="true"><path d={curvePath} />{connectorEnds.map((point, index) => <circle key={index} cx={point.x - offsetX} cy={point.y - offsetY} r="9" />)}<ConnectorArrowheads visualStyle={item.visualStyle} seed={id} geometry={connectorCurve} offsetX={offsetX} offsetY={offsetY} strokeWidth={Number(item.strokeWidth) || 1.5} /></svg>}{selected && <ConnectorSelectionEffect geometry={connectorCurve} offsetX={offsetX} offsetY={offsetY} width={geometryWidth} height={geometryHeight} color={item.color} strokeWidth={item.strokeWidth} />}<ConnectorLabel item={item} geometry={connectorCurve} offsetX={offsetX} offsetY={offsetY} />{bendHandle}</div>);
  }
  if (item.kind === 'image') return withResizeHandles(<div key={id} className={`${classes} image-object${item.imageFrameEnabled === false ? ' image-frame-hidden' : ''}`} style={style} {...handlers}><CanvasImageContent item={item} token={token} />{item.imageFrameEnabled !== false && <div className="object-caption"><Icon name="image" size={13} />{item.filename || ui("공유 이미지")}</div>}</div>);
  if (item.kind === 'link') return withResizeHandles(<div key={id} className={`${classes} media-link-object${item.mediaType === 'link' ? ' external-link-object' : ' video-link-object'}`} style={style} data-item-id={id} {...handlers}>
    <div className="shared-media-header"><span className="shared-media-drag-handle" title={ui("여기를 끌어 자료를 이동하세요")}><Icon name={item.mediaType === 'link' ? 'link' : 'image'} size={13} />{item.mediaType === 'youtube' ? `YouTube · ${item.title || ui("동영상")}` : item.mediaType === 'video' ? ui("동영상 · {v0}", {
  v0: item.title || ui("재생")
}) : ui("링크")}</span></div>
    <SharedMediaContent item={item} interactive={editing} />
  </div>);
  if (isTextContent(item)) {
    const mode = contentMode(item);
    const textColor = item.kind === 'text' && mode !== 'code' && /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : undefined;
    return withResizeHandles(<div key={id} className={`${classes} unified-content-object ${mode === 'code' ? 'code-object' : 'text-object'}${mode === 'markdown' ? ' markdown-text-object' : ''}`} style={{ ...style, color: textColor, '--text-color': textColor }} {...handlers}>
      <UnifiedTextContent {...{ id, item, editing, dirty, remoteEditorLabel, onTextChange, onTextColorChange, onFormulaChange, onMetadataChange, onSave, onStopEditing, runtimeStore }} />
    </div>);
  }
  if (item.kind === 'note') return withResizeHandles(<div key={id} className={`${classes} sticky-note-object`} style={{ ...style, '--sticky-note-color': item.color || stickyNoteColors[0], '--sticky-note-rotation': `${Number(item.rotation) || -1}deg` }} data-item-id={id} {...handlers} onBlur={editingBoundary.onBlur} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); onSave(id); } }}>
    <div className="sticky-note-head"><span title={ui("끌어서 포스트잇 이동")}><Icon name="sticky" size={13} />{" " + ui("포스트잇") + ""}</span><input type="color" aria-label={ui("포스트잇 색상")} title={ui("포스트잇 색상 변경")} value={item.color || stickyNoteColors[0]} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onMetadataChange(id, 'color', event.target.value)} /></div>
    <EditingSurface editing={editing} renderPreview={() => <div className="sticky-note-content" title={ui("두 번 클릭해 Markdown 편집")}>{item.text ? <MarkdownText source={item.text} /> : <p className="sticky-note-empty">{ui("두 번 클릭해 메모를 작성하세요.")}</p>}</div>}>
      <textarea className="sticky-note-input" ref={collaborativeEditorRef} autoFocus aria-label={ui("포스트잇 Markdown 편집")} value={item.text || ''} placeholder={ui("# 메모 제목\n- 할 일\n**중요한 내용**")} onPointerDown={(event) => event.stopPropagation()} onSelect={rememberCollaborativeSelection} onKeyUp={rememberCollaborativeSelection} onClick={rememberCollaborativeSelection} onChange={handleCollaborativeInput} />
    </EditingSurface>
  </div>);
  if (item.kind === 'table') return withResizeHandles(<div key={id} className={`${classes} canvas-table-object`} style={style} data-item-id={id} {...handlers}><EditableTable item={item} editingActive={editing} enabled={activeTool === 'select' && selected} onStartEditing={() => onStartEditing(id)} onStopEditing={() => onStopEditing(id)} onChange={(location, value) => onTableChange(id, (current) => updateTableValue(current, location, value))} /></div>);
  if (item.kind === 'chart') return withResizeHandles(<div key={id} className={`${classes} canvas-chart-object`} style={style} data-item-id={id} {...handlers}><ChartView item={item} /></div>);
  if (item.kind === 'shape') {
    const arrowGeometry = item.shapeType === 'arrow' ? shapeArrowGeometry(width * viewSize.width, height * viewSize.height, item.bend, item.startHead, item.endHead, item) : null;
    const bendHandle = arrowGeometry && selected && allowSingleSelectionControls && movable && !editing
      ? arrowGeometry.controlHandles.map((point, index) => <button key={index} type="button" className="shape-arrow-bend-handle" style={{ left: `${point.x / arrowGeometry.width * 100}%`, top: `${point.y / arrowGeometry.height * 100}%` }} title={ui("드래그해 곡선 조절")} aria-label={ui("화살표 곡선 조절점 {v0}", {
  v0: index + 1
})} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onArrowBendStart(event, id, item, index); }} />)
      : null;
    return withResizeHandles(<div key={id} className={`${classes} shape-object shape-vector-hit shape-${item.shapeType || 'rectangle'}`} style={style} {...handlers}>{bendHandle}</div>);
  }
  return null;
}

export default memo(CanvasObjectView, canvasObjectPropsEqual);
