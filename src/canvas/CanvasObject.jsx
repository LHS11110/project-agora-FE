import ConnectorSelectionEffect from '../components/canvas/ConnectorSelectionEffect.jsx';
import { measureConnectorObject } from './connectors/objectMetrics.js';
import SyntaxCode from '../components/code/SyntaxCode.jsx';
import CodeCopyButton from '../components/code/CodeCopyButton.jsx';
import { useEditingBoundary } from './useEditingBoundary.js';
import './image-object.css';
import { scaleObjectElement } from './ScalableObjectContent.jsx';
import CanvasCodeEditor from './CanvasCodeEditor.jsx';
import CodeLanguageOptions from './CodeLanguageOptions.jsx';
import { codeLanguageLabel } from './codeLanguages.js';
import { handleObjectDoubleClick } from './objectDoubleClick.js';
import { cloneElement, useLayoutEffect, useRef } from 'react';
import Icon from '../components/Icon.jsx';
import AuthenticatedImage from '../components/AuthenticatedImage.jsx';
import MarkdownText from '../components/MarkdownText.jsx';
import EditableTable from '../components/EditableTable.jsx';
import SharedMediaContent from '../components/SharedMediaContent.jsx';
import CanvasMathContent from './CanvasMathContent.jsx';
import ResizeHandles from '../components/ResizeHandles.jsx';
import ConnectorArrowheads from '../components/canvas/ConnectorArrowheads.jsx';
import './object-interaction.css';
import './markdown-text.css';
import { shapeArrowGeometry } from '../components/shapeArrowGeometry.js';
import { updateTableValue } from '../components/tableModel.js';
import { stickyNoteColors } from './canvasConstants.js';
import { moveTextPosition, textSpliceBetween } from './collaborativeText.js';

export default function CanvasObject({ id, item, bounds, selected, allowSingleSelectionControls, activeTool, connectionStartId, editing, dirty, remoteEditors = [], connectorCurve, viewSize, token, onStartEditing, onTextChange, onMetadataChange, onFormulaChange, onTableChange, onStopEditing, onSave, onPointerDown, onResizeStart, onArrowBendStart, onPointerMove, onPointerUp, onCopy, onConnectorDoubleClick }) {
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
    ? `함께 편집 중 · ${remoteEditors.slice(0, 2).map((editor) => `${editor.nickname}#${editor.tag_number}`).join(', ')}${remoteEditors.length > 2 ? ` 외 ${remoteEditors.length - 2}명` : ''}`
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
  const editingBoundary = useEditingBoundary(editing && ['text', 'note'].includes(item.kind), () => {
    onStopEditing(id);
    if (item.kind === 'note' && dirty) onSave(id, { silent: true });
  });
  const width = Number(item.width) || ({ image: 0.3, code: 0.32, shape: 0.14, math: 0.2, text: 0.22, note: 0.22, table: 0.42, link: 0.3 }[item.kind] || 0.2);
  const height = Number(item.height) || ({ shape: 0.12, math: 0.09, text: 0.12, note: 0.15, table: 0.32, link: 0.15 }[item.kind] || 0.2);
  const style = { left: `${(Number(item.x) || 0) * 100}%`, top: `${(Number(item.y) || 0) * 100}%`, width: `${width * 100}%`, '--object-color': item.color || '#617d68', '--object-rotation': `${Number(item.rotation) || 0}deg` };
  if (item.height) style.height = `${height * 100}%`;
  const movable = activeTool === 'select' && selected;
  const classes = `canvas-object canvas-object-${item.kind}${movable ? ' movable' : ''}${selected ? ' selected' : ''}${connectionStartId === id ? ' connection-source' : ''}${item.height ? ' has-custom-height' : ''}`;
  const handlers = {
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
    { ref: geometryElementRef, className: `${element.props.className}${resizeHandles ? ' resizeable' : ''}` },
    <>{element.props.children}{resizeHandles && <button type="button" className="object-move-handle" aria-label="선택한 객체 이동" title="잡고 끌어 객체 이동" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onPointerDown(event, id, item); }}><Icon name="move" size={16} /></button>}{resizeHandles}</>), item);


  if (item.kind === 'stroke') return null;
  if (item.kind === 'connector') {
    const vectorStyle = { ...style, left: `${(bounds?.minX ?? 0) * 100}%`, top: `${(bounds?.minY ?? 0) * 100}%`, width: `${Math.max(0.01, (bounds?.maxX ?? 0.2) - (bounds?.minX ?? 0)) * 100}%`, height: `${Math.max(0.01, (bounds?.maxY ?? 0.12) - (bounds?.minY ?? 0)) * 100}%` };
    const geometryWidth = Math.max(1, (bounds.maxX - bounds.minX) * viewSize.width);
    const geometryHeight = Math.max(1, (bounds.maxY - bounds.minY) * viewSize.height);
    const offsetX = bounds.minX * viewSize.width;
    const offsetY = bounds.minY * viewSize.height;
    const curvePath = connectorCurve?.points.map((point, index) => `${index ? 'L' : 'M'}${point.x - offsetX} ${point.y - offsetY}`).join(' ');
    const connectorEnds = [connectorCurve?.start, connectorCurve?.end].filter(Boolean);
    const bendPoints = connectorCurve?.curvePoints || connectorCurve?.points;
    const curveMidpoint = bendPoints?.[Math.floor((bendPoints.length - 1) / 2)];
    const bendHandle = curveMidpoint && selected && allowSingleSelectionControls && movable && !editing
      ? <button type="button" className="shape-arrow-bend-handle" style={{ left: `${(curveMidpoint.x - offsetX) / geometryWidth * 100}%`, top: `${(curveMidpoint.y - offsetY) / geometryHeight * 100}%` }} title="몸통을 드래그해 곡률 조절" aria-label="연결 화살표 몸통 곡률 조절" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onArrowBendStart(event, id, item); }} />
      : null;
    return withResizeHandles(<div key={id} className={`${classes} vector-object-hit`} style={vectorStyle} data-item-id={id} {...handlers} title="한 번 클릭해 선택 · 두 번 클릭해 연결된 객체로 이동">{curvePath && <svg className="connector-hit-path" viewBox={`0 0 ${geometryWidth} ${geometryHeight}`} preserveAspectRatio="none" aria-hidden="true"><path d={curvePath} />{connectorEnds.map((point, index) => <circle key={index} cx={point.x - offsetX} cy={point.y - offsetY} r="9" />)}<ConnectorArrowheads geometry={connectorCurve} offsetX={offsetX} offsetY={offsetY} strokeWidth={Number(item.strokeWidth) || 1.5} /></svg>}{selected && <ConnectorSelectionEffect geometry={connectorCurve} offsetX={offsetX} offsetY={offsetY} width={geometryWidth} height={geometryHeight} color={item.color} strokeWidth={item.strokeWidth} />}{bendHandle}</div>);
  }
  if (item.kind === 'image') return withResizeHandles(<div key={id} className={`${classes} image-object`} style={style} {...handlers}><AuthenticatedImage src={item.src} token={token} alt={item.filename || '공유된 이미지'} fallback={<div className="image-object-fallback"><Icon name="image" size={19} /><span>이미지를 표시할 수 없어요</span></div>} loadingFallback={<div className="image-object-fallback"><Icon name="image" size={19} /><span>이미지를 불러오는 중…</span></div>} /><div className="object-caption"><Icon name="image" size={13} />{item.filename || '공유 이미지'}</div></div>);
  if (item.kind === 'link') return withResizeHandles(<div key={id} className={`${classes} media-link-object${item.mediaType === 'link' ? ' external-link-object' : ' video-link-object'}`} style={style} data-item-id={id} {...handlers}>
    <div className="shared-media-header"><span className="shared-media-drag-handle" title="여기를 끌어 자료를 이동하세요"><Icon name={item.mediaType === 'link' ? 'link' : 'image'} size={13} />{item.mediaType === 'youtube' ? `YouTube · ${item.title || '동영상'}` : item.mediaType === 'video' ? `동영상 · ${item.title || '재생'}` : '링크'}</span></div>
    <SharedMediaContent item={item} interactive={editing} />
  </div>);
  if (item.kind === 'code') return withResizeHandles(<div key={id} className={`${classes} code-object`} style={style} data-item-id={id} {...handlers} onBlur={editingBoundary.onBlur} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); onSave(id); } }}><div className="code-object-head"><span className="code-file-icon"><Icon name="code" size={15} /></span>{editing ? <><input className="code-filename-input" aria-label="코드 파일 이름" value={item.filename || ''} placeholder="idea.js" maxLength={80} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onMetadataChange(id, 'filename', event.target.value)} /><select className="code-language-select" aria-label="코드 언어" value={item.language || 'javascript'} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onMetadataChange(id, 'language', event.target.value)}><CodeLanguageOptions value={item.language || 'javascript'} /></select></> : <><strong>{item.filename || 'snippet.js'}</strong><small>{codeLanguageLabel(item.language || 'text')}</small></>}</div>{editing ? <CanvasCodeEditor key="code-editor" value={item.code || ''} language={item.language || 'javascript'} onChange={value => onTextChange(id, value)} onSave={() => onSave(id)} onStopEditing={() => onStopEditing(id)} /> : <SyntaxCode value={item.code || ''} language={item.language || 'javascript'} title="두 번 클릭해 함께 편집" />}<div className="code-object-foot"><span><i /> {dirty ? '저장되지 않음 · Ctrl + S' : editing ? 'P2P 실시간 편집 · Ctrl+Space 자동완성' : '두 번 클릭해 편집'}</span>{remoteEditorLabel && <small className="collab-presence-label" title={remoteEditorLabel}>{remoteEditorLabel}</small>}<CodeCopyButton value={item.code || ''} /></div></div>);
  if (item.kind === 'note') return withResizeHandles(<div key={id} className={`${classes} sticky-note-object`} style={{ ...style, '--sticky-note-color': item.color || stickyNoteColors[0], '--sticky-note-rotation': `${Number(item.rotation) || -1}deg` }} data-item-id={id} {...handlers} onBlur={editingBoundary.onBlur} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); onSave(id); } }}>
    <div className="sticky-note-head"><span title="끌어서 포스트잇 이동"><Icon name="sticky" size={13} /> 포스트잇</span><input type="color" aria-label="포스트잇 색상" title="포스트잇 색상 변경" value={item.color || stickyNoteColors[0]} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => onMetadataChange(id, 'color', event.target.value)} /></div>
    {editing ? <textarea ref={collaborativeEditorRef} autoFocus aria-label="포스트잇 Markdown 편집" value={item.text || ''} placeholder={'# 메모 제목\n- 할 일\n**중요한 내용**'} onPointerDown={(event) => event.stopPropagation()} onSelect={rememberCollaborativeSelection} onKeyUp={rememberCollaborativeSelection} onClick={rememberCollaborativeSelection} onChange={handleCollaborativeInput} /> : <div className="sticky-note-content" title="두 번 클릭해 Markdown 편집">{item.text ? <MarkdownText source={item.text} /> : <p className="sticky-note-empty">두 번 클릭해 메모를 작성하세요.</p>}</div>}
    <small className={`collab-save-hint${remoteEditorLabel ? ' collab-presence-hint' : ''}`}>{remoteEditorLabel || (dirty ? '자동 저장 대기 중…' : editing ? 'Markdown · 자동 저장' : '두 번 클릭해 편집')}</small>
  </div>);
  if (item.kind === 'table') return withResizeHandles(<div key={id} className={`${classes} canvas-table-object`} style={style} data-item-id={id} {...handlers}><EditableTable item={item} editingActive={editing} enabled={activeTool === 'select' && selected} onStartEditing={() => onStartEditing(id)} onStopEditing={() => onStopEditing(id)} onChange={(location, value) => onTableChange(id, (current) => updateTableValue(current, location, value))} /></div>);
  if (item.kind === 'shape') {
    const arrowGeometry = item.shapeType === 'arrow' ? shapeArrowGeometry(width * viewSize.width, height * viewSize.height, item.bend, item.startHead, item.endHead) : null;
    const bendHandle = arrowGeometry && selected && allowSingleSelectionControls && movable && !editing
      ? <button type="button" className="shape-arrow-bend-handle" style={{ left: `${arrowGeometry.curveMidpoint.x / arrowGeometry.width * 100}%`, top: `${arrowGeometry.curveMidpoint.y / arrowGeometry.height * 100}%` }} title="몸통을 드래그해 곡률 조절" aria-label="화살표 몸통 곡률 조절" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onArrowBendStart(event, id, item); }} />
      : null;
    return withResizeHandles(<div key={id} className={`${classes} shape-object shape-vector-hit shape-${item.shapeType || 'rectangle'}`} style={style} {...handlers}>{bendHandle}</div>);
  }
  if (item.kind === 'text') return withResizeHandles(<div key={id} className={`${classes} text-object${item.format === 'markdown' ? ' markdown-text-object' : ''}`} style={style} data-item-id={id} {...handlers}>{editing ? <><textarea ref={collaborativeEditorRef} autoFocus aria-label={item.format === 'markdown' ? '마크다운 텍스트 편집' : '공동 편집 텍스트'} value={item.text || ''} placeholder={item.format === 'markdown' ? '# 제목\n- 목록\n**강조할 내용**' : '여기에 텍스트를 입력하세요.'} onPointerDown={(event) => event.stopPropagation()} onSelect={rememberCollaborativeSelection} onKeyUp={rememberCollaborativeSelection} onClick={rememberCollaborativeSelection} onChange={handleCollaborativeInput} onBlur={editingBoundary.onBlur} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); onSave(id); } }} /><small className={`collab-save-hint${remoteEditorLabel ? ' collab-presence-hint' : ''}`}>{remoteEditorLabel || (dirty ? '저장되지 않음 · Ctrl + S' : '저장됨')}</small></> : <div title="두 번 클릭해 함께 편집">{item.format === 'markdown' ? <MarkdownText source={item.text || '두 번 클릭해 마크다운 작성'} /> : <p>{item.text || '두 번 클릭해 편집'}</p>}</div>}</div>);
  if (item.kind === 'math') return withResizeHandles(<div key={id} className={`${classes} math-object`} style={style} {...handlers}>
    <CanvasMathContent {...{ id, item, editing, onFormulaChange, onStopEditing }} />
  </div>);
  return null;
}
