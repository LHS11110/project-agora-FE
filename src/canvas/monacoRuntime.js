import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2.js';
export { codeModelUri, registerModelCompletions } from './completions/registerModelCompletions.js';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import { registerCodeTheme } from './codeTheme.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

// Monaco's package entry point eagerly registers every language and language
// service. Load just the selected tokenizer/service so opening the editor does
// not download the full language catalog.
const languageModules = import.meta.glob('/node_modules/monaco-editor/esm/vs/languages/definitions/*/register.js');
const featureModules = import.meta.glob('/node_modules/monaco-editor/esm/vs/languages/features/*/register.js');

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === 'json') return new JsonWorker();
    if (['css', 'scss', 'less'].includes(label)) return new CssWorker();
    if (['html', 'handlebars', 'razor'].includes(label)) return new HtmlWorker();
    if (['typescript', 'javascript'].includes(label)) return new TypeScriptWorker();
    return new EditorWorker();
  },
};

registerCodeTheme(monaco);
const aliases = { text: 'plaintext', bash: 'shell', sh: 'shell', js: 'javascript', ts: 'typescript', py: 'python', yml: 'yaml', 'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', objectivec: 'objective-c', vue: 'html', svelte: 'html' };
const definitionFolders = { c: 'cpp' };
const featureByLanguage = {
  javascript: 'typescript', typescript: 'typescript',
  json: 'json', html: 'html', css: 'css', scss: 'css', less: 'css',
};
const pendingLanguages = new Map();
const pendingFeatures = new Map();

function normalizedLanguage(language) {
  return aliases[language] || language || 'plaintext';
}

/** Load only the tokenizer and semantic service needed by this code block. */
export async function ensureEditorLanguage(language) {
  const id = normalizedLanguage(language);
  if (!monaco.languages.getLanguages().some(entry => entry.id === id) && id !== 'plaintext') {
    const folder = definitionFolders[id] || id;
    const key = `/node_modules/monaco-editor/esm/vs/languages/definitions/${folder}/register.js`;
    const loader = languageModules[key];
    if (loader) {
      if (!pendingLanguages.has(folder)) pendingLanguages.set(folder, loader());
      await pendingLanguages.get(folder);
    }
    // Some requested dialects do not have a bundled tokenizer. Preserve the
    // editor's plain-text editing and custom completion behavior for them.
    if (!monaco.languages.getLanguages().some(entry => entry.id === id)) {
      monaco.languages.register({ id });
      monaco.languages.setLanguageConfiguration(id, { brackets: [['{', '}'], ['[', ']'], ['(', ')']] });
    }
  }

  const feature = featureByLanguage[id];
  if (feature) {
    const key = `/node_modules/monaco-editor/esm/vs/languages/features/${feature}/register.js`;
    const loader = featureModules[key];
    if (loader && !pendingFeatures.has(feature)) pendingFeatures.set(feature, loader());
    await pendingFeatures.get(feature);
  }
  return id;
}

export function editorLanguage(language) {
  const id = normalizedLanguage(language);
  if (!monaco.languages.getLanguages().some(entry => entry.id === id) && id !== 'plaintext') {
    // Ensure callers that do not need a tokenizer still get an editor model.
    monaco.languages.register({ id });
    monaco.languages.setLanguageConfiguration(id, { brackets: [['{', '}'], ['[', ']'], ['(', ')']] });
  }
  return monaco.languages.getLanguages().some(entry => entry.id === id) ? id : 'plaintext';
}
export { monaco };
