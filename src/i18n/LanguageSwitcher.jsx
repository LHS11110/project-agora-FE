import { useId } from 'react';
import { setLocale, UI_LANGUAGES, ui } from './locale.js';
import { useUiLocale } from './useUiLocale.js';
import './language-switcher.css';

export default function LanguageSwitcher() {
  const locale = useUiLocale();
  const selectId = useId();
  return (
    <label className="language-switcher">
      <span aria-hidden="true">◎</span>
      <select id={selectId} name="ui-locale" aria-label={locale === 'ko' ? '언어 / Language' : ui('언어')}
        value={locale} onChange={event => setLocale(event.target.value)}>
        {Object.entries(UI_LANGUAGES).map(([code, { label, tag }]) => (
          <option key={code} value={code} lang={tag}>{label}</option>
        ))}
      </select>
    </label>
  );
}
