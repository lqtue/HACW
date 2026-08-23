// The language options, shared by the onboarding picker and the passport switcher.
// vi/en have built-in locale files (`display`); the rest display English and ride the
// browser's page-translate (CLAUDE.md: built locales are vi/en only). Ordered by Hội An
// arrival volume. The greeting is the label — a visitor recognises their own.
export const LANGS = [
  { code: 'vi', hello: 'Xin chào', name: 'Tiếng Việt', display: 'vi' },
  { code: 'en', hello: 'Hello', name: 'English', display: 'en' },
  { code: 'ko', hello: '안녕하세요', name: '한국어' },
  { code: 'zh', hello: '你好', name: '中文' },
  { code: 'ja', hello: 'こんにちは', name: '日本語' },
  { code: 'th', hello: 'สวัสดี', name: 'ไทย' },
  { code: 'fr', hello: 'Bonjour', name: 'Français' },
  { code: 'de', hello: 'Hallo', name: 'Deutsch' }
];

/** Display locale a language choice maps to: vi stays vi, everything else is en. */
export const displayFor = (l) => l.display ?? 'en';
