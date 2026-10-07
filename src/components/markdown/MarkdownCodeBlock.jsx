import { useRef, useEffect, useState } from 'react';
import { codeLanguageLabel } from '../../canvas/codeLanguages.js';

export default function MarkdownCodeBlock({ language = 'text', code }) {
  const [status, setStatus] = useState('');
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setStatus('복사됨'); }
    catch { setStatus('복사 실패'); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 1800);
  };
  return <div className="markdown-code-block">
    <div className="markdown-code-heading"><span>{codeLanguageLabel(language)}</span><button type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); copy(); }} aria-label="마크다운 코드 복사">{status || '복사'}</button></div>
    <pre><code>{code}</code></pre>
  </div>;
}
