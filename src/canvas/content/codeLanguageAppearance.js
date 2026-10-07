import { codeLanguageLabel } from '../codeLanguages.js';
const accents = {
  javascript: '#f4d66c', typescript: '#8cbcff', python: '#8ecdf0', java: '#f5ad83',
  kotlin: '#c6a0ff', c: '#a7c8e8', cpp: '#90b8f5', csharp: '#c3a5f4', go: '#77d8e4',
  rust: '#efb094', ruby: '#f2a0ac', php: '#bab3f5', swift: '#ffb486', dart: '#82d8ec',
  html: '#ffb391', css: '#9fc2ff', scss: '#efacd0', vue: '#91dfb8', svelte: '#ffb59a',
  sql: '#f0cf86', bash: '#a8d994', powershell: '#9fc5ff', json: '#ecd98c', yaml: '#f0b0b9',
};
const fallback = ['#a8d7e8', '#c8b4ef', '#b9d99a', '#efc095', '#edaecc'];
export function codeLanguageAppearance(language = 'javascript') {
  let hash = 0;
  for (const letter of language) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return { label: codeLanguageLabel(language), accent: accents[language] || fallback[hash % fallback.length] };
}
