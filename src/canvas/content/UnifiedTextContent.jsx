import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import CodeSnippetHeader from './CodeSnippetHeader.jsx';
import EditingSurface from './EditingSurface.jsx';
import InlineContentInput from './InlineContentInput.jsx';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import CodeCopyButton from '../../components/code/CodeCopyButton.jsx';
import RenderedContent from './RenderedContent.jsx';
import { contentMode, contentSource } from './contentPresentation.js';
import { textColorRanges } from './textColors.js';
import './unified-content.css';
export default function UnifiedTextContent({ id, item, editing, onTextChange, onTextColorChange, onFormulaChange, onMetadataChange, onSave, onStopEditing, runtimeStore }) {
  useUiLocale();
  const mode = contentMode(item), value = contentSource(item), colorRanges = textColorRanges(item);
  return <>
    {mode === 'code' && <CodeSnippetHeader key="content-header" {...{ id, item, editing, onMetadataChange }} />}
    <div key="content-body" className="unified-content-body"><EditingSurface key={mode} editing={editing} className={mode === 'code' ? 'is-code' : ''} renderPreview={() => value ? <RenderedContent value={value} mode={mode} language={item.language || 'javascript'} colorRanges={colorRanges} /> : <p className="unified-content-empty">{ui("두 번 클릭해 내용을 작성하세요")}</p>}>
      {mode === 'code'
      ? <CanvasCodeEditor key="code-editor" inline value={value} language={item.language || 'javascript'} onChange={next => item.kind === 'math' ? onFormulaChange(id, next) : onTextChange(id, next)} onSave={() => onSave(id)} onStopEditing={() => onStopEditing(id)} />
      : <InlineContentInput key="inline-input" fitContainer value={value} mode={mode} colorRanges={colorRanges} onColorChange={item.kind === 'text' && ['plain', 'markdown'].includes(mode) && onTextColorChange ? (start, end, color) => onTextColorChange(id, start, end, color) : undefined} onChange={next => item.kind === 'math' ? onFormulaChange(id, next) : onTextChange(id, next)} onSave={() => onSave(id)} onStopEditing={() => onStopEditing(id)} />}
    </EditingSurface></div>
    {mode === 'code' && <div className="code-object-foot"><CodeCopyButton value={value} /></div>}
  </>;
}
