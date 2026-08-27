// Every word in the app in Vietnamese, laid out to read and hand to a translator.
//
//   node scripts/export-full-text.mjs   ->  content/full-text.md
//
// Vietnamese only, on purpose: the other languages are translated FROM this, so an
// English column beside it is just noise (and a second thing to keep in step).
// content/i18n.csv (scripts/i18n-export.mjs) is the machine-readable twin — one row
// per string, one column per language — and the file a finished translation comes
// back in. This one is the source text, grouped the way a person reads it: per site,
// per tour, per screen, with each question's correct answer marked.
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = new URL('../src/lib/data/', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(f, DATA), 'utf8'));
const dests = load('destinations.json');
const tours = load('tours.json');
const rewards = load('rewards.json');
const cats = load('categories.json');
const tickets = load('ticket-points.json');

const out = [];
const w = (s = '') => out.push(s);
let n = 0;
/** one field, Vietnamese only */
const pair = (label, f, indent = '') => {
  if (!f?.vi) return;
  n++;
  w(`${indent}- **${label}:** ${f.vi}`);
};

w('# Tuần lễ Sáng tạo Hội An 2026 — toàn bộ văn bản');
w('');
w('Sinh bởi `node scripts/export-full-text.mjs`. Chỉ tiếng Việt — bản gốc để dịch sang các thứ tiếng khác.');
w('Điền bản dịch về `content/i18n.csv` (một dòng một chuỗi, một cột một ngôn ngữ).');
w('');
w('Chuỗi có `{n}` `{name}` `{i}`… là chỗ ứng dụng chèn số/tên vào — dịch xung quanh, giữ nguyên trong ngoặc.');
w('');

// ---- destinations ----
const open = dests.filter((d) => !d.closed);
w(`## 1. Điểm đến — ${open.length} điểm đang mở (${dests.length - open.length} điểm đóng ở cuối mục)`);
for (const d of [...open, ...dests.filter((x) => x.closed)]) {
  w('');
  w(`### ${d.code ?? '?'} ${d.name.vi}${d.closed ? ' — ĐANG ĐÓNG' : ''}`);
  pair('Tên', d.name);
  pair('Địa chỉ', d.address);
  pair('Giờ mở cửa', d.hours);
  pair('Giới thiệu ngắn', d.short);
  pair('Giới thiệu dài', d.description);
  if (d.highlights?.length) {
    w('- **Đừng bỏ lỡ**');
    d.highlights.forEach((h, i) => pair(`${i + 1}`, h, '  '));
  }
  d.quizBank?.forEach((q, i) => {
    w(`- **Câu hỏi ${i + 1}**`);
    pair('Câu hỏi', q.question, '  ');
    q.options.forEach((o, j) => pair(j === q.answer ? 'ĐÁP ÁN ĐÚNG' : 'Đáp án', o, '  '));
    if (q.explain) pair('Giải thích', q.explain, '  ');
  });
}

// ---- tours ----
w('');
w(`## 2. Tuyến — ${tours.length}`);
for (const t of tours) {
  w('');
  w(`### ${t.title.vi}`);
  pair('Tên', t.title);
  pair('Giới thiệu ngắn', t.short);
  pair('Giới thiệu dài', t.description);
  pair('Quà', t.voucher);
  w(`- **Chặng:** ${t.stops.map((id) => dests.find((d) => d.id === id)?.name.vi ?? id).join(' → ')}`);
}

// ---- rewards, categories, ticket points ----
w('');
w(`## 3. Bậc quà — ${rewards.length}`);
for (const r of rewards) {
  w('');
  w(`### ${r.points} điểm — ${r.title.vi}`);
  pair('Tiêu đề', r.title);
  pair('Phần quà', r.reward);
}
w('');
w(`## 4. Nhóm điểm đến — ${cats.length}`);
for (const c of cats) pair(c.id, c.label);
w('');
w(`## 5. Điểm bán vé — ${tickets.length}`);
for (const t of tickets) pair(t.id, t.where);

// ---- UI strings ----
const src = readFileSync(new URL('../src/lib/strings.js', import.meta.url), 'utf8');
const block = (lang) => {
  const start = src.indexOf(`\n  ${lang}:`);
  return src.slice(start, src.indexOf('\n  }', start));
};
const plain = (b) => Object.fromEntries(
  [...b.matchAll(/^ {4}([a-zA-Z_]+)\s*:\s*(['"`])((?:\\.|(?!\2).)*)\2\s*,?\s*$/gm)]
    .map((m) => [m[1], m[3].replace(/\\(['"`\\])/g, '$1')])
);
const fns = (b) => Object.fromEntries(
  [...b.matchAll(/^ {4}([a-zA-Z_]+)\s*:\s*\(([^)]*)\)\s*=>\s*`([^`]*)`/gm)]
    .map((m) => [`${m[1]}()`, m[3].replace(/\$\{([^}]+)\}/g, (_, s) => `{${s.trim()}}`)])
);
const vi = { ...plain(block('vi')), ...fns(block('vi')) };
const en = { ...plain(block('en')), ...fns(block('en')) };
w('');
w(`## 6. Chữ trong ứng dụng — ${Object.keys(vi).length}`);
w('');
for (const k of Object.keys(vi)) pair(k, { vi: vi[k], en: en[k] });

// ---- the language picker's own greetings ----
const langs = readFileSync(new URL('../src/lib/languages.js', import.meta.url), 'utf8');
w('');
w('## 7. Lời chào ở màn chọn ngôn ngữ');
w('');
w('Đã viết bằng chính ngôn ngữ đó — chỉ soát lại, không dịch.');
for (const m of langs.matchAll(/\{ code: '(\w+)',[^}]*hello: '([^']*)'[^}]*name: '([^']*)'[^}]*open: '([^']*)'/g)) {
  w(`- **${m[1]}** ${m[3]} — “${m[2]}” · “${m[4]}”`);
}

writeFileSync(new URL('../content/full-text.md', import.meta.url), `${out.join('\n')}\n`);
console.log(`content/full-text.md — ${n} strings`);
