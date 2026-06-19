import { browser } from '$app/environment';

const KEY = 'hacw_lang';

// Official languages: vi + en. Other languages -> users rely on Google Translate.
export const i18n = $state({ lang: (browser && localStorage.getItem(KEY)) || 'vi' });

export function setLang(code) {
  i18n.lang = code;
  if (browser) localStorage.setItem(KEY, code);
}

// Resolve a bilingual content field { vi, en } (or a plain string) to the current language.
export function t(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[i18n.lang] ?? field.vi ?? '';
}
