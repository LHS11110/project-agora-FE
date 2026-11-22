import en from './en.js';
import canvasMessages from './canvasMessages.js';
export const LOCALE_KEY = 'frelog_locale';
export const UI_LANGUAGES = {
  ko: { label: '한국어', tag: 'ko' },
  en: { label: 'English', tag: 'en' },
  zh: { label: '简体中文', tag: 'zh-Hans' },
  ja: { label: '日本語', tag: 'ja' },
  fr: { label: 'Français', tag: 'fr' },
};
export const SUPPORTED_LOCALES = Object.keys(UI_LANGUAGES);
const canvasLanguageIndex = ['zh', 'ja', 'fr'];

export function intlLocale(locale) {
  return locale === 'en' ? 'en-US' : locale === 'ko' ? 'ko-KR' : UI_LANGUAGES[locale]?.tag;
}
export function normalizeLocale(value) {
  const language = String(value || '').toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(language) ? language : 'ko';
}
export function readLocale(storage, browserLanguage) {
  try {
    const saved = storage?.getItem(LOCALE_KEY);
    if (SUPPORTED_LOCALES.includes(saved)) return saved;
  } catch { /* Browser storage can be disabled. */ }
  return normalizeLocale(browserLanguage);
}
export function translate(message, locale = 'ko', values = {}) {
  if (typeof message !== 'string') return message;
  const index = canvasLanguageIndex.indexOf(locale);
  const local = index >= 0 && Object.hasOwn(canvasMessages, message) ? canvasMessages[message][index] : undefined;
  const english = (index >= 0 || locale === 'en') && Object.hasOwn(en, message) ? en[message] : undefined;
  const translated = local ?? english ?? message;
  return translated.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
function initialLocale() {
  if (typeof window === 'undefined') return 'ko';
  try { return readLocale(window.localStorage, window.navigator.language); }
  catch { return normalizeLocale(window.navigator.language); }
}
let currentLocale = initialLocale();
const listeners = new Set();
export const getLocale = () => currentLocale;
export const subscribeLocale = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const ui = (message, values) => translate(message, currentLocale, values);
function updateDocument() { if (typeof document !== 'undefined') document.documentElement.lang = UI_LANGUAGES[currentLocale].tag; }
export function setLocale(value) {
  const next = normalizeLocale(value);
  try { window.localStorage.setItem(LOCALE_KEY, next); } catch { /* Preference remains usable in memory. */ }
  if (next === currentLocale) return;
  currentLocale = next;
  updateDocument();
  listeners.forEach(listener => listener());
}
if (typeof window !== 'undefined') {
  updateDocument();
  window.addEventListener('storage', event => {
    if (event.key !== LOCALE_KEY) return;
    const next = normalizeLocale(event.newValue || window.navigator.language);
    if (next === currentLocale) return;
    currentLocale = next;
    updateDocument();
    listeners.forEach(listener => listener());
  });
}
