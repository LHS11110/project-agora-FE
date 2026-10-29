import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useEditingBoundary } from './useEditingBoundary.js';
import { useEffect, useRef, useState } from 'react';
import { moveTextPosition, textSpliceBetween } from './collaborativeText.js';
import './canvas-code-editor.css';

/** One model per open block; remote updates preserve selections and view state. */
export default function CanvasCodeEditor({ value = '', language = 'javascript', inline = false, onChange, onSave, onStopEditing }) {
  useUiLocale();
  const boundary = useEditingBoundary(true, onStopEditing, { pointerOnly: true });
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const runtimeRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const latest = useRef({ value, language, onChange, onSave, onStopEditing });
  latest.current = { value, language, onChange, onSave, onStopEditing };
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let disposed = false;
    let editor, model, observer;
    const subscriptions = [];
    import('./monacoRuntime.js').then(runtime => {
      if (disposed) return;
      runtimeRef.current = runtime;
      const { monaco, editorLanguage } = runtime;
      model = monaco.editor.createModel(String(latest.current.value), editorLanguage(latest.current.language), runtime.codeModelUri(monaco));
      model.setEOL(monaco.editor.EndOfLineSequence.LF);
      subscriptions.push(runtime.registerModelCompletions(monaco, model, () => latest.current.language));
      const appearance = getComputedStyle(hostRef.current);
      editor = monaco.editor.create(hostRef.current, {
        model, theme: 'frelog-night', automaticLayout: true,
        fontSize: 13, lineHeight: 20,
        ...(inline ? { fontFamily: appearance.fontFamily, fontSize: parseFloat(appearance.fontSize) || 13, lineHeight: parseFloat(appearance.lineHeight) || 21, letterSpacing: 0 } : {}),
        fontLigatures: false, tabSize: 2, insertSpaces: true,
        minimap: { enabled: false }, scrollBeyondLastLine: false,
        lineNumbersMinChars: 3, padding: { top: inline ? 12 : 10, bottom: inline ? 12 : 10 },
        wordWrap: 'off', folding: !inline, glyphMargin: false,
        ...(inline ? { lineNumbers: 'off', lineDecorationsWidth: 12, overviewRulerLanes: 0, overviewRulerBorder: false, hideCursorInOverviewRuler: true, guides: { indentation: false, bracketPairs: false }, renderWhitespace: 'none', renderValidationDecorations: 'off' } : {}),
        quickSuggestions: { other: true, comments: false, strings: false },
        suggestOnTriggerCharacters: true, snippetSuggestions: 'top',
        wordBasedSuggestions: 'currentDocument', tabCompletion: 'on',
        renderLineHighlight: inline ? 'none' : 'line', bracketPairColorization: { enabled: !inline },
        autoClosingBrackets: 'always', autoClosingQuotes: 'always',
        formatOnPaste: true, formatOnType: true,
        fixedOverflowWidgets: inline,
        overflowWidgetsDomNode: inline ? hostRef.current.closest('.canvas-app-page') || document.body : undefined,
        mouseWheelZoom: false,
        // Keep browser native editing contexts from retargeting pointer/focus events.
        editContext: false,
        scrollbar: { alwaysConsumeMouseWheel: true, ...(inline ? { useShadows: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8 } : {}) },
        ariaLabel: ui('공동 편집 코드 에디터'),
      });
      editorRef.current = editor;
      subscriptions.push(editor.onDidChangeModelContent(() => {
        if (!applyingRemoteRef.current) latest.current.onChange?.(model.getValue());
      }));
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => latest.current.onSave?.());
      // Monaco measures CSS pixels. Observing the host handles object resizing
      // without rebuilding the editor or discarding the undo stack.
      observer = new ResizeObserver(() => editor.layout());
      observer.observe(hostRef.current);
      setStatus('ready');
      editor.focus();
    }).catch(() => { if (!disposed) setStatus('failed'); });
    return () => {
      disposed = true;
      observer?.disconnect();
      subscriptions.forEach(subscription => subscription.dispose());
      editor?.dispose(); model?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const runtime = runtimeRef.current;
    if (!editor || !runtime) return;
    const model = editor.getModel();
    const next = String(value).replace(/\r\n?/g, '\n');
    const previous = model.getValue();
    if (previous === next) return;
    const change = textSpliceBetween(previous, next);
    const selections = (editor.getSelections() || []).map(selection => ({
      anchor: model.getOffsetAt(selection.getSelectionStart()),
      cursor: model.getOffsetAt(selection.getPosition()),
    }));
    const start = model.getPositionAt(change.index);
    const end = model.getPositionAt(change.index + change.deleteCount);
    applyingRemoteRef.current = true;
    try {
      editor.pushUndoStop();
      editor.executeEdits('frelog-remote', [{ range: new runtime.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: change.insertText }], () => selections.map(selection => {
        const anchor = model.getPositionAt(Math.max(0, Math.min(next.length, moveTextPosition(selection.anchor, change))));
        const cursor = model.getPositionAt(Math.max(0, Math.min(next.length, moveTextPosition(selection.cursor, change))));
        return new runtime.monaco.Selection(anchor.lineNumber, anchor.column, cursor.lineNumber, cursor.column);
      }));
      editor.pushUndoStop();
    } finally { applyingRemoteRef.current = false; }
  }, [value, status]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && runtimeRef.current) runtimeRef.current.monaco.editor.setModelLanguage(model, runtimeRef.current.editorLanguage(language));
  }, [language, status]);

  // Monaco moves focus between its input, widgets and native editing context.
  // Only an explicit pointer outside the object closes the editing session.
  return <div ref={boundary.ref} className={`canvas-code-editor${inline ? ' is-inline' : ''}`} data-status={status} onBlur={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onKeyDown={event => {
    event.stopPropagation();
    if (status !== 'ready' && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); onSave?.(); }
  }}>
    <div ref={hostRef} className="canvas-code-editor-host" />
    {status === 'loading' && <div className="canvas-code-editor-loading" role="status">{ui("코드 에디터를 불러오는 중…")}</div>}
    {status === 'failed' && <><p role="status">{ui("에디터를 불러오지 못했습니다. 기본 입력창에서 계속 편집할 수 있어요.")}</p><textarea className="canvas-code-editor-fallback" autoFocus aria-label={ui("코드 편집")} value={value} onChange={event => onChange?.(event.target.value)} /></>}
  </div>;
}
