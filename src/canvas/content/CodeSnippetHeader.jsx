import Icon from '../../components/Icon.jsx';
import CodeLanguageBadge from './CodeLanguageBadge.jsx';
import { codeLanguageAppearance } from './codeLanguageAppearance.js';
export default function CodeSnippetHeader({ id, item, editing, onMetadataChange }) {
  const language = item.language || 'javascript';
  return <div className="code-object-head code-snippet-header" data-editing={editing} style={{ '--code-language-accent': codeLanguageAppearance(language).accent }}>
    <div className="code-file-heading"><Icon name="code" size={15} />{editing ? <input className="code-filename-input" aria-label="코드 파일 이름" maxLength={80} value={item.filename || ''} placeholder="파일 이름" onPointerDown={event => event.stopPropagation()} onChange={event => onMetadataChange(id, 'filename', event.target.value)} /> : <strong title={item.filename || '코드 스니펫'}>{item.filename || '코드 스니펫'}</strong>}</div>
    <CodeLanguageBadge language={language} onChange={editing ? value => onMetadataChange(id, 'language', value) : undefined} />
  </div>;
}
