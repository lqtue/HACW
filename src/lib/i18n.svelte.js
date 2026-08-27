import { browser } from '$app/environment';

const KEY = 'hacw_lang';

// Eight languages ship: vi + en are written by hand, the other six come from
// content/translate-<lang>.tsv (scripts/i18n-import.mjs). `?lang=ko` sets and
// remembers one — that is how the /screens board and a per-language QR code work.
const CODES = ['vi', 'en', 'ko', 'zh', 'ja', 'th', 'fr', 'de'];
function initial() {
  if (!browser) return 'vi';
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked && CODES.includes(asked)) {
    localStorage.setItem(KEY, asked);
    return asked;
  }
  return localStorage.getItem(KEY) || 'vi';
}
export const i18n = $state({ lang: initial() });

// Keep <html lang> in step with the chosen language so the browser's built-in
// page translate detects the right source and offers to translate the rest.
if (browser) document.documentElement.lang = i18n.lang;

export function setLang(code) {
  i18n.lang = code;
  if (browser) {
    localStorage.setItem(KEY, code);
    document.documentElement.lang = code;
  }
}

// Resolve a bilingual content field { vi, en } (or a plain string) to the current language.
export function t(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[i18n.lang] ?? field.vi ?? '';
}
