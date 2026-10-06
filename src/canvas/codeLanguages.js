export const codeLanguageGroups = [
  { label: '웹', languages: [
    ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['html', 'HTML'],
    ['css', 'CSS'], ['scss', 'SCSS'], ['vue', 'Vue'], ['svelte', 'Svelte'],
  ] },
  { label: '범용·시스템', languages: [
    ['python', 'Python'], ['java', 'Java'], ['kotlin', 'Kotlin'], ['c', 'C'],
    ['cpp', 'C++'], ['csharp', 'C#'], ['go', 'Go'], ['rust', 'Rust'],
    ['swift', 'Swift'], ['dart', 'Dart'], ['ruby', 'Ruby'], ['php', 'PHP'],
    ['scala', 'Scala'], ['lua', 'Lua'], ['perl', 'Perl'], ['elixir', 'Elixir'],
    ['erlang', 'Erlang'], ['haskell', 'Haskell'], ['ocaml', 'OCaml'],
    ['fsharp', 'F#'], ['zig', 'Zig'], ['objectivec', 'Objective-C'],
  ] },
  { label: '데이터·과학', languages: [
    ['sql', 'SQL'], ['r', 'R'], ['julia', 'Julia'], ['matlab', 'MATLAB'],
  ] },
  { label: '스크립트·설정', languages: [
    ['bash', 'Bash / Shell'], ['powershell', 'PowerShell'], ['dockerfile', 'Dockerfile'],
    ['json', 'JSON'], ['yaml', 'YAML'], ['toml', 'TOML'], ['xml', 'XML'],
    ['markdown', 'Markdown'], ['graphql', 'GraphQL'], ['text', '일반 텍스트'],
  ] },
];

const languageLabels = new Map(codeLanguageGroups.flatMap(group => group.languages));
export const isCodeLanguage = value => languageLabels.has(value);
export const codeLanguageLabel = value => languageLabels.get(value) || value || '일반 텍스트';
