import { codeLanguageGroups, isCodeLanguage } from './codeLanguages.js';

export default function CodeLanguageOptions({ value }) {
  return <>
    {value && !isCodeLanguage(value) && <option value={value}>{value}</option>}
    {codeLanguageGroups.map(group => <optgroup key={group.label} label={group.label}>
      {group.languages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </optgroup>)}
  </>;
}
