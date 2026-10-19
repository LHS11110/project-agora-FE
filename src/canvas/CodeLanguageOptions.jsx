import { useUiLocale } from '../i18n/useUiLocale.js';
import { ui } from '../i18n/locale.js';
import { codeLanguageGroups, isCodeLanguage } from './codeLanguages.js';

export default function CodeLanguageOptions({ value }) {
  useUiLocale();
  return <>
    {value && !isCodeLanguage(value) && <option value={value}>{value}</option>}
    {codeLanguageGroups.map(group => <optgroup key={group.label} label={ui(group.label)}>
      {group.languages.map(([id, label]) => <option key={id} value={id}>{ui(label)}</option>)}
    </optgroup>)}
  </>;
}
