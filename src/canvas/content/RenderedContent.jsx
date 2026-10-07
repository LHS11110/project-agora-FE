import './unified-content.css';
import MarkdownText from '../../components/MarkdownText.jsx';
import MathFormula from '../../components/MathFormula.jsx';
import SyntaxCode from '../../components/code/SyntaxCode.jsx';
export default function RenderedContent({ value, mode = 'plain', language = 'plaintext' }) {
  if (mode === 'markdown') return <MarkdownText source={value} />;
  if (mode === 'latex') return <div className="unified-latex-preview"><MathFormula formula={value} display /></div>;
  if (mode === 'code') return <SyntaxCode value={value} language={language} />;
  return <p className="unified-plain-preview">{value}</p>;
}
