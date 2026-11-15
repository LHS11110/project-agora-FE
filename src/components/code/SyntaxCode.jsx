import { Fragment, useEffect, useState } from 'react';
import '../../canvas/code-block-theme.css';

const TOKEN_CACHE_LIMIT = 400;
const tokenCache = new Map();
const primedLanguages = new Map();
let monacoRuntimePromise = null;

function loadMonacoRuntime() {
  if (!monacoRuntimePromise) {
    monacoRuntimePromise = import('../../canvas/monacoRuntime.js').catch((err) => {
      monacoRuntimePromise = null;
      throw err;
    });
  }
  return monacoRuntimePromise;
}

function primeLanguageTokenizer(monaco, id) {
  if (!primedLanguages.has(id)) {
    // Monaco registers Monarch factories lazily; priming once per language enables tokenize().
    primedLanguages.set(id, monaco.editor.colorize('', id, { theme: 'frelog-night', tabSize: 2 }).catch(() => {
      primedLanguages.delete(id);
    }));
  }
  return primedLanguages.get(id);
}

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

function putCachedTokens(language, source, tokens) {
  const key = cacheKey(language, source);
  if (tokenCache.has(key)) tokenCache.delete(key);
  else if (tokenCache.size >= TOKEN_CACHE_LIMIT) {
    const oldest = tokenCache.keys().next().value;
    if (oldest !== undefined) tokenCache.delete(oldest);
  }
  tokenCache.set(key, tokens);
}

function isStageInteracting() {
  return typeof document !== 'undefined'
    && Boolean(document.querySelector('.canvas-stage.camera-moving, .canvas-stage.camera-coasting, .canvas-stage.panning'));
}

function scheduleLowPriorityWork(fn) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 240 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 16);
  return () => clearTimeout(id);
}

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
  const [highlight, setHighlight] = useState(() => {
    const cached = source.length <= 200000 ? getCachedTokens(language, source) : null;
    return cached ? { source, language, tokens: cached } : null;
  });
  useEffect(() => {
    let cancelled = false;
    let cancelScheduled = null;
    let retryTimer = 0;
    // Full source remains visible; very large blocks use ordinary text.
    if (source.length > 200000) return undefined;
    const cached = getCachedTokens(language, source);
    if (cached) {
      setHighlight({ source, language, tokens: cached });
      return undefined;
    }

    const commitTokens = (tokens) => {
      if (cancelled) return;
      if (isStageInteracting()) {
        retryTimer = setTimeout(() => commitTokens(tokens), 180);
        return;
      }
      setHighlight({ source, language, tokens });
    };

    const runTokenize = () => {
      if (cancelled) return;
      if (isStageInteracting()) {
        retryTimer = setTimeout(() => {
          cancelScheduled = scheduleLowPriorityWork(runTokenize);
        }, 180);
        return;
      }
      loadMonacoRuntime().then(async ({ monaco, ensureEditorLanguage, editorLanguage }) => {
        await ensureEditorLanguage(language);
        if (cancelled) return;
        const id = editorLanguage(language);
        await primeLanguageTokenizer(monaco, id);
        if (cancelled) return;
        const tokens = monaco.editor.tokenize(source, id);
        putCachedTokens(language, source, tokens);
        commitTokens(tokens);
      }).catch(() => {});
    };

    cancelScheduled = scheduleLowPriorityWork(runTokenize);
    return () => {
      cancelled = true;
      cancelScheduled?.();
      if (retryTimer) clearTimeout(retryTimer);
    };
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
