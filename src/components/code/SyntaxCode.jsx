import { Fragment, memo, useMemo } from 'react';
import '../../canvas/code-block-theme.css';

const TOKEN_CACHE_LIMIT = 400;
const tokenCache = new Map();

const KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'def', 'defer', 'delete', 'do', 'elif', 'else', 'enum', 'except',
  'export', 'extends', 'false', 'finally', 'fn', 'for', 'from', 'func', 'function', 'go',
  'if', 'impl', 'import', 'in', 'instanceof', 'interface', 'is', 'lambda', 'let', 'loop',
  'match', 'mod', 'mut', 'new', 'None', 'null', 'or', 'package', 'pass', 'private', 'pub',
  'public', 'raise', 'return', 'select', 'self', 'static', 'struct', 'super', 'switch',
  'this', 'throw', 'trait', 'true', 'True', 'False', 'try', 'type', 'typeof', 'undefined',
  'use', 'using', 'val', 'var', 'void', 'where', 'while', 'with', 'yield', 'and', 'not',
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN',
  'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'CREATE', 'TABLE', 'AS',
]);

const TOKEN_RE = /\/\/[^\r\n]*|#[^\r\n]*|"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|`(?:\\.|[^`\\\r\n])*`|\b(?:0[xXbBoO][\da-fA-F_]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|[A-Za-z_$][\w$]*|[()[\]{}.,:;]|==?=|!==?|[<>]=?|=>|\+\+|--|&&|\|\||[+\-*/%&|^~!?=]+|\s+/g;

function cacheKey(language, source) {
  return `${language}\0${source}`;
}

function getCachedTokens(language, source) {
  const key = cacheKey(language, source);
  const hit = tokenCache.get(key);
  if (!hit) return null;
  tokenCache.delete(key);
  tokenCache.set(key, hit);
  return hit;
}

function putCachedTokens(language, source, lines) {
  const key = cacheKey(language, source);
  if (tokenCache.has(key)) tokenCache.delete(key);
  else if (tokenCache.size >= TOKEN_CACHE_LIMIT) {
    const oldest = tokenCache.keys().next().value;
    if (oldest !== undefined) tokenCache.delete(oldest);
  }
  tokenCache.set(key, lines);
}

function tokenizeLine(line, inBlockComment) {
  const spans = [];
  let idx = 0;
  const len = line.length;
  if (inBlockComment) {
    const end = line.indexOf('*/');
    if (end < 0) {
      if (len) spans.push({ kind: 'comment', text: line });
      return { spans, inBlockComment: true };
    }
    spans.push({ kind: 'comment', text: line.slice(0, end + 2) });
    idx = end + 2;
  }

  while (idx < len) {
    if (line[idx] === '/' && line[idx + 1] === '*') {
      const end = line.indexOf('*/', idx + 2);
      if (end < 0) {
        spans.push({ kind: 'comment', text: line.slice(idx) });
        return { spans, inBlockComment: true };
      }
      spans.push({ kind: 'comment', text: line.slice(idx, end + 2) });
      idx = end + 2;
      continue;
    }
    TOKEN_RE.lastIndex = idx;
    const match = TOKEN_RE.exec(line);
    if (!match) {
      spans.push({ kind: 'plain', text: line.slice(idx) });
      break;
    }
    if (match.index > idx) {
      spans.push({ kind: 'plain', text: line.slice(idx, match.index) });
    }
    const text = match[0];
    idx = TOKEN_RE.lastIndex;
    let kind = 'plain';
    const first = text[0];
    if (first === ' ' || first === '\t') {
      kind = 'plain';
    } else if (text.startsWith('//') || first === '#') {
      kind = 'comment';
    } else if (first === '"' || first === "'" || first === '`') {
      kind = 'string';
    } else if (first >= '0' && first <= '9') {
      kind = 'number';
    } else if ('()[]{}.,:;'.includes(text)) {
      kind = 'punctuation';
    } else if ('=!<>+-*/%&|^~?'.includes(first)) {
      kind = 'operator';
    } else if (KEYWORDS.has(text)) {
      kind = 'keyword';
    } else if (/^\s*\(/.test(line.slice(idx))) {
      kind = 'function';
    } else if (first >= 'A' && first <= 'Z') {
      kind = 'type';
    }
    spans.push({ kind, text });
  }
  return { spans, inBlockComment: false };
}

function tokenizeCode(source, language) {
  if (source.length > 200000) return null;
  const cached = getCachedTokens(language, source);
  if (cached) return cached;
  const rawLines = source.split(/\r\n?|\n/);
  const result = new Array(rawLines.length);
  let inBlockComment = false;
  for (let i = 0; i < rawLines.length; i++) {
    const out = tokenizeLine(rawLines[i], inBlockComment);
    result[i] = out.spans;
    inBlockComment = out.inBlockComment;
  }
  putCachedTokens(language, source, result);
  return result;
}

const SyntaxCode = memo(function SyntaxCode({ value = '', language = 'text', title }) {
  const source = String(value);
  const lines = useMemo(() => tokenizeCode(source, language), [source, language]);
  return (
    <pre className="syntax-code-preview" title={title}>
      <code>
        {lines
          ? lines.map((spans, lineIndex) => (
            <Fragment key={lineIndex}>
              {spans.map((span, idx) => (
                span.kind === 'plain'
                  ? span.text
                  : <span key={idx} className={`syntax-${span.kind}`}>{span.text}</span>
              ))}
              {lineIndex < lines.length - 1 ? '\n' : ''}
            </Fragment>
          ))
          : source}
      </code>
    </pre>
  );
});

export default SyntaxCode;
