import en from './en.js';
export const LOCALE_KEY = 'frelog_locale';
export const SUPPORTED_LOCALES = ['ko', 'en'];
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
  const translated = locale === 'en' ? en[message] ?? message : message;
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
function updateDocument() { if (typeof document !== 'undefined') document.documentElement.lang = currentLocale; }
export function setLocale(value) {
  const next = normalizeLocale(value);
  if (next === currentLocale) return;
  currentLocale = next;
  try { window.localStorage.setItem(LOCALE_KEY, next); } catch { /* Preference remains usable in memory. */ }
  updateDocument();
  listeners.forEach(listener => listener());
}
if (typeof window !== 'undefined') {
  updateDocument();
  window.addEventListener('storage', event => {
    if (event.key !== LOCALE_KEY) return;
    currentLocale = normalizeLocale(event.newValue || window.navigator.language);
    updateDocument(); listeners.forEach(listener => listener());
  });
}
