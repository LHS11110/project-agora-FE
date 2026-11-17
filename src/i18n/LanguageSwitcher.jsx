import { useId } from 'react';
import { setLocale } from './locale.js';
import { useUiLocale } from './useUiLocale.js';
import './language-switcher.css';
export default function LanguageSwitcher() {
  const locale = useUiLocale();
  const selectId = useId();
  return <label className="language-switcher"><span aria-hidden="true">◎</span><select id={selectId} name="ui-locale" aria-label="언어 / Language" value={locale} onChange={event => setLocale(event.target.value)}><option value="ko" lang="ko">한국어</option><option value="en" lang="en">English</option></select></label>;
}
