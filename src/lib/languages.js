// The language options, shared by the onboarding picker and the passport switcher.
// All eight are built: vi/en are written by hand, the other six come from
// content/translate-<lang>.tsv via scripts/i18n-import.mjs. Ordered by Hội An
// arrival volume. The greeting is the label — a visitor recognises their own. `open` is
// the door screen's one line, cycled through every language before any is chosen.
// `name` is the language in its own language, `enName` the same in English: a visitor
// who reads neither Vietnamese nor their own script still finds the row.
export const LANGS = [
  { code: 'vi', hello: 'Xin chào', name: 'Tiếng Việt', enName: 'Vietnamese', open: 'Chạm để mở cửa' },
  { code: 'en', hello: 'Hello', name: 'English', enName: 'English', open: 'Tap to open the door' },
  { code: 'ko', hello: '안녕하세요', name: '한국어', enName: 'Korean', open: '문을 열려면 탭하세요' },
  { code: 'zh', hello: '你好', name: '中文', enName: 'Chinese', open: '点击开门' },
  { code: 'ja', hello: 'こんにちは', name: '日本語', enName: 'Japanese', open: 'タップして扉を開く' },
  { code: 'th', hello: 'สวัสดี', name: 'ไทย', enName: 'Thai', open: 'แตะเพื่อเปิดประตู' },
  { code: 'fr', hello: 'Bonjour', name: 'Français', enName: 'French', open: 'Touchez pour ouvrir la porte' },
  { code: 'de', hello: 'Hallo', name: 'Deutsch', enName: 'German', open: 'Tippen, um die Tür zu öffnen' }
];

/** The locale a language choice maps to — every option has its own now. */
export const displayFor = (l) => l.code;
