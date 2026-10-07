import CodeSnippetHeader from './CodeSnippetHeader.jsx';
import InlineContentInput from './InlineContentInput.jsx';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import CodeCopyButton from '../../components/code/CodeCopyButton.jsx';
import RenderedContent from './RenderedContent.jsx';
import { contentMode, contentSource } from './contentPresentation.js';
import './unified-content.css';
export default function UnifiedTextContent({ id, item, editing, dirty, remoteEditorLabel, onTextChange, onFormulaChange, onMetadataChange, onSave, onStopEditing }) {
  const mode = contentMode(item), value = contentSource(item);
  return <>
    {mode === 'code' && <CodeSnippetHeader key="content-header" {...{ id, item, editing, onMetadataChange }} />}
    <div key="content-body" className="unified-content-body">{editing ? mode === 'code'
      ? <CanvasCodeEditor key="code-editor" value={value} language={item.language || 'javascript'} onChange={next => item.kind === 'math' ? onFormulaChange(id, next) : onTextChange(id, next)} onSave={() => onSave(id)} onStopEditing={() => onStopEditing(id)} />
      : <InlineContentInput key="inline-input" value={value} mode={mode} onChange={next => item.kind === 'math' ? onFormulaChange(id, next) : onTextChange(id, next)} onSave={() => onSave(id)} onStopEditing={() => onStopEditing(id)} />
      : value ? <RenderedContent value={value} mode={mode} language={item.language || 'javascript'} /> : <p className="unified-content-empty">두 번 클릭해 내용을 작성하세요</p>}</div>
    {mode === 'code' ? <div className="code-object-foot"><span>{remoteEditorLabel || (dirty ? '저장 대기 중' : '두 번 클릭해 편집')}</span><CodeCopyButton value={value} /></div> : editing && <small className="collab-save-hint">{remoteEditorLabel || (dirty ? '저장 대기 중 · Ctrl / ⌘ + S' : '자동 저장')}</small>}
  </>;
}
