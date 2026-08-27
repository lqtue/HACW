// Every word in the app, laid out to read and hand to a translator.
//
//   node scripts/export-full-text.mjs   ->  content/full-text.md
//
// content/i18n.csv (scripts/i18n-export.mjs) is the machine-readable twin: one row
// per string with a column per language. This file is the same content grouped the
// way a person reads it — per site, per tour, per screen — with the Vietnamese and
// the English side by side, so a translator has the context the CSV can't show.
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
/** one bilingual field: Vietnamese first, English under it */
const pair = (label, f, indent = '') => {
  if (!f?.vi) return;
  n++;
  w(`${indent}- **${label}** · VI: ${f.vi}`);
  w(`${indent}  · EN: ${f.en || '⚠️ chưa có / missing'}`);
};

w('# Tuần lễ Sáng tạo Hội An 2026 — toàn bộ văn bản');
w('');
w('Sinh bởi `node scripts/export-full-text.mjs`. Tiếng Việt là bản gốc, tiếng Anh là bản đã dịch.');
w('Bản máy đọc được (một dòng một chuỗi, một cột một ngôn ngữ): `content/i18n.csv`.');
w('');
w('Chuỗi có `{n}` `{name}` `{i}`… là chỗ ứng dụng chèn số/tên vào — dịch xung quanh, giữ nguyên trong ngoặc.');
w('');

// ---- destinations ----
const open = dests.filter((d) => !d.closed);
w(`## 1. Điểm đến — ${open.length} điểm đang mở (${dests.length - open.length} điểm đóng ở cuối mục)`);
for (const d of [...open, ...dests.filter((x) => x.closed)]) {
  w('');
  w(`### ${d.code ?? '?'} ${d.name.vi}${d.closed ? ' — ĐANG ĐÓNG / CLOSED' : ''}`);
  pair('Tên / Name', d.name);
  pair('Địa chỉ / Address', d.address);
  pair('Giờ mở cửa / Hours', d.hours);
  pair('Giới thiệu ngắn / Short intro', d.short);
  pair('Giới thiệu dài / Long intro', d.description);
  if (d.highlights?.length) {
    w('- **Đừng bỏ lỡ / Don\'t miss**');
    d.highlights.forEach((h, i) => pair(`${i + 1}`, h, '  '));
  }
  d.quizBank?.forEach((q, i) => {
    w(`- **Câu hỏi ${i + 1} / Question ${i + 1}**`);
    pair('Câu hỏi / Question', q.question, '  ');
    q.options.forEach((o, j) => pair(j === q.answer ? 'ĐÁP ÁN ĐÚNG / CORRECT' : 'Đáp án / Option', o, '  '));
    if (q.explain) pair('Giải thích / Explanation', q.explain, '  ');
  });
}

// ---- tours ----
w('');
w(`## 2. Tuyến / Tours — ${tours.length}`);
for (const t of tours) {
  w('');
  w(`### ${t.title.vi}`);
  pair('Tên / Title', t.title);
  pair('Giới thiệu ngắn / Short intro', t.short);
  pair('Giới thiệu dài / Long intro', t.description);
  pair('Quà / Voucher', t.voucher);
  w(`- Chặng / Stops: ${t.stops.map((id) => dests.find((d) => d.id === id)?.name.vi ?? id).join(' → ')}`);
}

// ---- rewards, categories, ticket points ----
w('');
w(`## 3. Bậc quà / Reward tiers — ${rewards.length}`);
for (const r of rewards) {
  w('');
  w(`### ${r.points} điểm — ${r.title.vi}`);
  pair('Tiêu đề / Title', r.title);
  pair('Phần quà / Reward', r.reward);
}
w('');
w(`## 4. Nhóm điểm đến / Categories — ${cats.length}`);
for (const c of cats) pair(c.id, c.label);
w('');
w(`## 5. Điểm bán vé / Ticket counters — ${tickets.length}`);
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
w(`## 6. Chữ trong ứng dụng / UI strings — ${Object.keys(vi).length}`);
w('');
for (const k of Object.keys(vi)) pair(k, { vi: vi[k], en: en[k] });

// ---- the language picker's own greetings ----
const langs = readFileSync(new URL('../src/lib/languages.js', import.meta.url), 'utf8');
w('');
w('## 7. Lời chào ở màn chọn ngôn ngữ / Language picker greetings');
w('');
w('Đã viết bằng chính ngôn ngữ đó — chỉ soát lại, không dịch.');
for (const m of langs.matchAll(/\{ code: '(\w+)',[^}]*hello: '([^']*)'[^}]*name: '([^']*)'[^}]*open: '([^']*)'/g)) {
  w(`- **${m[1]}** ${m[3]} — “${m[2]}” · “${m[4]}”`);
}

writeFileSync(new URL('../content/full-text.md', import.meta.url), `${out.join('\n')}\n`);
console.log(`content/full-text.md — ${n} strings`);
