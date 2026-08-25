// The language options, shared by the onboarding picker and the passport switcher.
// vi/en have built-in locale files (`display`); the rest display English and ride the
// browser's page-translate (CLAUDE.md: built locales are vi/en only). Ordered by Hội An
// arrival volume. The greeting is the label — a visitor recognises their own. `open` is
// the door screen's one line, cycled through every language before any is chosen.
export const LANGS = [
  { code: 'vi', hello: 'Xin chào', name: 'Tiếng Việt', display: 'vi', open: 'Chạm để mở cửa' },
  { code: 'en', hello: 'Hello', name: 'English', display: 'en', open: 'Tap to open the door' },
  { code: 'ko', hello: '안녕하세요', name: '한국어', open: '문을 열려면 탭하세요' },
  { code: 'zh', hello: '你好', name: '中文', open: '点击开门' },
  { code: 'ja', hello: 'こんにちは', name: '日本語', open: 'タップして扉を開く' },
  { code: 'th', hello: 'สวัสดี', name: 'ไทย', open: 'แตะเพื่อเปิดประตู' },
  { code: 'fr', hello: 'Bonjour', name: 'Français', open: 'Touchez pour ouvrir la porte' },
  { code: 'de', hello: 'Hallo', name: 'Deutsch', open: 'Tippen, um die Tür zu öffnen' }
];

/** Display locale a language choice maps to: vi stays vi, everything else is en. */
export const displayFor = (l) => l.display ?? 'en';
