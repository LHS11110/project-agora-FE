import { codeLanguageLabel } from '../../canvas/codeLanguages.js';
import CodeCopyButton from '../code/CodeCopyButton.jsx';
import SyntaxCode from '../code/SyntaxCode.jsx';

export default function MarkdownCodeBlock({ language = 'text', code }) {
  return <div className="markdown-code-block">
    <div className="markdown-code-heading"><span>{codeLanguageLabel(language)}</span><CodeCopyButton value={code} /></div>
    <SyntaxCode value={code} language={language} />
  </div>;
}
