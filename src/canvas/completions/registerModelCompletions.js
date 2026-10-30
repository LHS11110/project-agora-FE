import { ui } from '../../i18n/locale.js';
import { snippetPreview, vocabularyPresentation } from './presentation.js';
import { completionKeywords } from './keywords.js';
import { completionSnippets } from './snippets.js';
import { codeLanguageLabel } from '../codeLanguages.js';

let nextModel = 0;
// No file extension: switching JS/TS keeps the worker's language settings in
// control instead of forcing the original language through its file suffix.
export const codeModelUri = monaco => monaco.Uri.parse(`frelog://code/${++nextModel}/snippet`);

/** Scope providers to one model so aliases and different canvases never mix. */
export function registerModelCompletions(monaco, model, getLanguage) {
  let cachedVersion = -1, identifiers = [], localFunctions=new Set(),localClasses=new Set();
  return monaco.languages.registerCompletionItemProvider({ scheme: 'frelog', pattern: model.uri.path }, {
    provideCompletionItems(current, position, _context, token) {
      if (current !== model || token.isCancellationRequested || model.isDisposed?.()) return { suggestions: [] };
      const language = getLanguage();
      if (language === 'text') return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const prefix = word.word.toLowerCase();
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const keywords = completionKeywords[language] || [];
      const snippets = completionSnippets[language] || [];
      const detail = codeLanguageLabel(language);
      const snippetLabels=new Set(snippets.map(([label])=>label));
      const suggestions = [];
      for (const [label, insertText, documentation] of snippets) {
        if (prefix && !label.toLowerCase().startsWith(prefix)) continue;
        const preview=snippetPreview(insertText), first=preview.split('\n')[0];
        suggestions.push({ label:{label,detail:first.startsWith(label)?first.slice(label.length):'',description:ui('템플릿')}, insertText, documentation:{value:`\`\`\`${language}\n${preview}\n\`\`\`\n\n${ui('Tab으로 삽입하고 다음 입력칸으로 이동하세요.')}`,isTrusted:false,supportHtml:false}, detail:`${ui(documentation)} · ${detail}`, kind: monaco.languages.CompletionItemKind.Snippet, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, sortText: `0_${label}` });
      }
      // Native language services already supply semantic names and keywords.
      if(['javascript','typescript','html','css','scss','json'].includes(language))return {suggestions};
      for (const label of keywords) {
        if(snippetLabels.has(label))continue;
        if (prefix && !label.toLowerCase().startsWith(prefix)) continue;
        const category=vocabularyPresentation(language,label);
        suggestions.push({ label:{label,description:ui(category.description)}, insertText:label, kind: monaco.languages.CompletionItemKind[category.kind], range, sortText: `1_${label}` });
      }
      if (cachedVersion !== model.getVersionId()) {
        const end = Math.min(model.getLineCount(), 2000);
        const source = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: end, endColumn: model.getLineMaxColumn(end) }).slice(0, 200000);
        identifiers = [...new Set(source.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [])].slice(0, 1000);
        localFunctions=new Set([...source.matchAll(/(?:^|\n)\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/g)].map(match=>match[1]));
        localClasses=new Set([...source.matchAll(/(?:^|\n)\s*class\s+([A-Za-z_]\w*)/g)].map(match=>match[1]));
        cachedVersion = model.getVersionId();
      }
      const reserved = new Set(keywords);
      for (const label of identifiers) {
        if (reserved.has(label) || label === word.word || (prefix && !label.toLowerCase().startsWith(prefix))) continue;
        suggestions.push({ label:{label,description:ui('현재 코드')}, insertText:label, kind:monaco.languages.CompletionItemKind[language==='python'&&localFunctions.has(label)?'Function':language==='python'&&localClasses.has(label)?'Class':'Text'], range, sortText: `2_${label}` });
      }
      return { suggestions };
    },
  });
}
