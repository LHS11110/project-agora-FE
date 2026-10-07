import CodeLanguageOptions from '../CodeLanguageOptions.jsx';
import { codeLanguageAppearance } from './codeLanguageAppearance.js';
import './code-snippet-layout.css';
export default function CodeLanguageBadge({ language = 'javascript', onChange }) {
  const { label, accent } = codeLanguageAppearance(language);
  return <span className="code-language-badge" style={{ '--code-language-accent': accent }} title={`현재 언어: ${label}`}>
    <i aria-hidden="true" />{onChange ? <select className="code-language-select" aria-label={`코드 언어 · 현재 ${label}`} value={language} onPointerDown={event => event.stopPropagation()} onChange={event => onChange(event.target.value)}><CodeLanguageOptions value={language} /></select> : <span>{label}</span>}
  </span>;
}
