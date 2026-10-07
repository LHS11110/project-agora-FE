import { completionKeywords } from './keywords.js';
import { completionSnippets } from './snippets.js';
import { codeLanguageLabel } from '../codeLanguages.js';

let nextModel = 0;
// No file extension: switching JS/TS keeps the worker's language settings in
// control instead of forcing the original language through its file suffix.
export const codeModelUri = monaco => monaco.Uri.parse(`frelog://code/${++nextModel}/snippet`);

/** Scope providers to one model so aliases and different canvases never mix. */
export function registerModelCompletions(monaco, model, getLanguage) {
  let cachedVersion = -1, identifiers = [];
  return monaco.languages.registerCompletionItemProvider({ scheme: 'frelog', pattern: model.uri.path }, {
    provideCompletionItems(current, position, _context, token) {
      if (current !== model || token.isCancellationRequested) return { suggestions: [] };
      const language = getLanguage();
      if (language === 'text') return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const prefix = word.word.toLowerCase();
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const keywords = completionKeywords[language] || [];
      const snippets = completionSnippets[language] || [];
      const detail = `${codeLanguageLabel(language)} · FreLog`;
      const suggestions = [];
      for (const [label, insertText, documentation] of snippets) {
        if (prefix && !label.toLowerCase().startsWith(prefix)) continue;
        suggestions.push({ label, insertText, documentation, detail: `${detail} · 템플릿`, kind: monaco.languages.CompletionItemKind.Snippet, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: `0_${label}` });
      }
      for (const label of keywords) {
        if (prefix && !label.toLowerCase().startsWith(prefix)) continue;
        suggestions.push({ label, insertText: label, detail: `${detail} · 키워드/기본 이름`, kind: monaco.languages.CompletionItemKind.Keyword, range, sortText: `1_${label}` });
      }
      if (cachedVersion !== model.getVersionId()) {
        const end = Math.min(model.getLineCount(), 2000);
        const source = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: end, endColumn: model.getLineMaxColumn(end) }).slice(0, 200000);
        identifiers = [...new Set(source.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [])].slice(0, 1000);
        cachedVersion = model.getVersionId();
      }
      const reserved = new Set(keywords);
      for (const label of identifiers) {
        if (reserved.has(label) || label === word.word || (prefix && !label.toLowerCase().startsWith(prefix))) continue;
        suggestions.push({ label, insertText: label, detail: '현재 코드의 단어', kind: monaco.languages.CompletionItemKind.Text, range, sortText: `2_${label}` });
      }
      return { suggestions };
    },
  });
}
