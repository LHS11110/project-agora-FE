import { Fragment, useEffect, useState } from 'react';
import '../../canvas/code-block-theme.css';

function tokenKind(type, text, rest) {
  if (/comment/.test(type)) return 'comment';
  if (/string|regexp/.test(type)) return 'string';
  if (/number/.test(type)) return 'number';
  if (/keyword/.test(type)) return 'keyword';
  if (/type|tag/.test(type)) return 'type';
  if (/attribute/.test(type)) return 'attribute';
  if (/operator/.test(type)) return 'operator';
  if (/invalid/.test(type)) return 'invalid';
  if (/identifier|predefined/.test(type) && /^\s*\(/.test(rest) && /^\w+$/.test(text)) return 'function';
  if (/delimiter/.test(type)) return 'punctuation';
  return 'plain';
}

export default function SyntaxCode({ value = '', language = 'text', title }) {
  const source = String(value);
  const [highlight, setHighlight] = useState(null);
  useEffect(() => {
    let cancelled = false;
    // Full source remains visible; very large blocks use ordinary text.
    if (source.length > 200000) return undefined;
    import('../../canvas/monacoRuntime.js').then(async ({ monaco, editorLanguage }) => {
      const id = editorLanguage(language);
      await monaco.editor.colorize(source, id, { theme: 'frelog-night', tabSize: 2 });
      if (!cancelled) setHighlight({ source, language, tokens: monaco.editor.tokenize(source, id) });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [source, language]);
  const current = highlight?.source === source && highlight.language === language ? highlight : null;
  return <pre className="syntax-code-preview" title={title}><code>{current ? source.split(/\r\n?|\n/).map((line, lineIndex, lines) => <Fragment key={lineIndex}>
    {(current.tokens[lineIndex] || [{ offset: 0, type: '' }]).map((token, index, tokens) => {
      const end = tokens[index + 1]?.offset ?? line.length;
      const text = line.slice(token.offset, end);
      return <span key={index} className={`syntax-${tokenKind(token.type, text, line.slice(end))}`}>{text}</span>;
    })}{lineIndex < lines.length - 1 ? '\n' : ''}
  </Fragment>) : source}</code></pre>;
}
