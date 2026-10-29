import { useUiLocale } from '../../i18n/useUiLocale.js';
import { ui } from '../../i18n/locale.js';
import CodeLanguageOptions from '../CodeLanguageOptions.jsx';
import Icon from '../../components/Icon.jsx';
import { codeLanguageAppearance } from './codeLanguageAppearance.js';
import './code-snippet-layout.css';
export default function CodeLanguageBadge({ language = 'javascript', onChange }) {
  useUiLocale();
  const { label: sourceLabel, accent } = codeLanguageAppearance(language);
  const label = ui(sourceLabel);
  return <span className="code-language-badge" style={{ '--code-language-accent': accent }} title={ui('현재 언어: {v0}', { v0: label })}>
    <i aria-hidden="true" /><span aria-hidden={Boolean(onChange)}>{label}</span><Icon className="code-language-chevron" name="chevron" size={10} />
    {onChange && <select className="code-language-select" aria-label={ui('코드 언어 · 현재 {v0}', { v0: label })} value={language} onPointerDown={event => event.stopPropagation()} onChange={event => onChange(event.target.value)}><CodeLanguageOptions value={language} /></select>}
  </span>;
}
