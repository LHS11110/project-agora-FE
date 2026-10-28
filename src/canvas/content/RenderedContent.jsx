import './unified-content.css';
import MarkdownText from '../../components/MarkdownText.jsx';
import MathFormula from '../../components/MathFormula.jsx';
import SyntaxCode from '../../components/code/SyntaxCode.jsx';
import ColorText from './ColorText.jsx';
export default function RenderedContent({ value, mode = 'plain', language = 'plaintext', colorRanges = [] }) {
  if (mode === 'markdown') return <MarkdownText source={value} colorRanges={colorRanges} />;
  if (mode === 'latex') return <div className="unified-latex-preview"><MathFormula formula={value} display /></div>;
  if (mode === 'code') return <SyntaxCode value={value} language={language} />;
  return <p className="unified-plain-preview"><ColorText value={value} ranges={colorRanges} /></p>;
}
