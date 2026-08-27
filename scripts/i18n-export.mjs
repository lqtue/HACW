// Flatten every translatable string in the app into one CSV for the writer/
// translation team to see + audit in Sheets. Content JSON round-trips (a future
// i18n-import.mjs writes edits back by `path`); strings.js is export-only (its 28
// interpolation-function keys can't be a CSV cell — listed at the end of run).
//
//   node scripts/i18n-export.mjs   ->  content/i18n.csv + content/content-todo.csv
//
// Columns: file, path, skip, status, <langs…>. `skip=1` marks fields not worth
// translating (street names, clock hours); `status` says what a row needs:
// `ok` · `en-missing` · `en=vi` (still Vietnamese) · `no-vi` (Vietnamese missing).
// Lang columns are every language in TARGET plus any found in the JSON, so a
// translator gets an empty column per language to fill in.
//
// strings.js interpolation keys (`(n) => \`+${n} điểm\``) are exported too, with
// their slots as {n} — translate around the braces and keep them.
//
// content-todo.csv is the other half of the answer: content that does not exist
// yet at all, so it has no row to translate — sites with no short intro / no
// "don't miss" lines / a thin quiz bank, quiz questions with no explanation,
// tours still on a draft narrative or a placeholder voucher name.
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = new URL('../src/lib/data/', import.meta.url);
const CONTENT = ['destinations.json','tours.json','rewards.json','categories.json','ticket-points.json'];
const SKIP = /\.(address|hours)$/; // VN street names + "7:00-22:00" — not translatable

const rows = [];       // { file, path, skip, vals: {vi, en, …} }
const langs = new Set(['vi', 'en']);

// A "bilingual node" is any object with a `vi` key whose value is a string.
const isLeaf = (o) => o && typeof o === 'object' && !Array.isArray(o) && typeof o.vi === 'string';

function walk(node, path, file) {
  if (isLeaf(node)) {
    for (const k of Object.keys(node)) if (typeof node[k] === 'string') langs.add(k);
    rows.push({ file, path, skip: SKIP.test(path) ? '1' : '', vals: node });
    return;
  }
  if (Array.isArray(node)) node.forEach((n, i) => walk(n, `${path}[${i}]`, file));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, file);
}

for (const f of CONTENT) walk(JSON.parse(readFileSync(new URL(f, DATA), 'utf8')), '', f);

// strings.js — plain-string UI keys only (functions can't round-trip through a cell).
const src = readFileSync(new URL('../src/lib/strings.js', import.meta.url), 'utf8');
const block = (lang) => {
  const start = src.indexOf(`\n  ${lang}:`);
  const end = src.indexOf('\n  }', start);
  return src.slice(start, end);
};
const parsePlain = (b) => {
  const out = {};
  for (const m of b.matchAll(/^ {4}([a-zA-Z_]+)\s*:\s*(['"`])((?:\\.|(?!\2).)*)\2\s*,?\s*$/gm)) {
    out[m[1]] = m[3].replace(/\\(['"`\\])/g, '$1');
  }
  return out;
};
const viUI = parsePlain(block('vi'));
const enUI = parsePlain(block('en'));
// interpolation keys — `question_of: (i, n) => \`Câu ${i}/${n}\`` exports as "Câu {i}/{n}"
const parseFns = (b) => {
  const out = {};
  for (const m of b.matchAll(/^ {4}([a-zA-Z_]+)\s*:\s*\(([^)]*)\)\s*=>\s*`([^`]*)`/gm)) {
    out[m[1]] = m[3].replace(/\$\{([^}]+)\}/g, (_, slot) => `{${slot.trim()}}`);
  }
  return out;
};
const viFn = parseFns(block('vi'));
const enFn = parseFns(block('en'));
for (const k of Object.keys(viUI)) rows.push({ file: 'strings.js', path: k, skip: '', vals: { vi: viUI[k], en: enUI[k] ?? '' } });
for (const k of Object.keys(viFn)) rows.push({ file: 'strings.js', path: `${k}()`, skip: '', vals: { vi: viFn[k], en: enFn[k] ?? '' } });

// the language picker's own greetings (languages.js) — each is already in its own
// language, so they are listed for review, not translation
const langsSrc = readFileSync(new URL('../src/lib/languages.js', import.meta.url), 'utf8');
for (const m of langsSrc.matchAll(/\{ code: '(\w+)',[^}]*hello: '([^']*)'[^}]*name: '([^']*)'[^}]*open: '([^']*)'/g)) {
  rows.push({ file: 'languages.js', path: `${m[1]}.hello`, skip: '1', vals: { vi: m[2], en: m[2] } });
  rows.push({ file: 'languages.js', path: `${m[1]}.open`, skip: '1', vals: { vi: m[4], en: m[4] } });
}

// ---- status per row: what this string still needs ----
for (const r of rows) {
  const vi = String(r.vals?.vi ?? '').trim();
  const en = String(r.vals?.en ?? '').trim();
  r.status = !vi ? 'no-vi' : r.skip ? 'ok' : !en ? 'en-missing' : en === vi ? 'en=vi' : 'ok';
}

// ---- emit CSV ----
// the languages the app offers (languages.js): vi/en are built, the rest ride the
// browser's translate today — an empty column each is where a real translation lands
const TARGET = ['vi', 'en', 'ko', 'zh', 'ja', 'th', 'fr', 'de'];
for (const l of TARGET) langs.add(l);
const cols = ['file', 'path', 'skip', 'status', ...TARGET, ...[...langs].filter((l) => !TARGET.includes(l))];
const esc = (v) => /[",\n]/.test(v ?? '') ? `"${String(v ?? '').replace(/"/g, '""')}"` : (v ?? '');
const csv = [cols.join(',')];
for (const r of rows) csv.push(cols.map((c) => esc(c in r ? r[c] : r.vals[c])).join(','));
writeFileSync(new URL('../content/i18n.csv', import.meta.url), csv.join('\n') + '\n');

// ---- content that isn't written yet (nothing to translate — it has to be authored) ----
const QUIZ_TARGET = 10;
const dests = JSON.parse(readFileSync(new URL('destinations.json', DATA), 'utf8'));
const tours = JSON.parse(readFileSync(new URL('tours.json', DATA), 'utf8'));
const todo = [];
const add = (where, what, note) => todo.push({ where, what, note });
for (const d of dests) {
  if (d.closed) continue; // not shown to visitors
  const at = `${d.code ?? '?'} ${d.name?.vi ?? d.id}`;
  if (!d.short?.vi) add(at, 'short intro (S)', 'one line, shown on the map label');
  const hl = d.highlights?.length ?? 0;
  if (hl < 3) add(at, "don't miss (D)", `${hl}/3 lines`);
  const bank = d.quizBank ?? [];
  if (bank.length < QUIZ_TARGET) add(at, 'quiz questions (Q/A)', `${bank.length}/${QUIZ_TARGET} — every one in the bank gets asked`);
  const noExplain = bank.filter((q) => !q.explain?.vi).length;
  if (noExplain) add(at, 'quiz explanation (E)', `${noExplain} of ${bank.length} questions have none`);
  if (!/\d/.test(d.hours?.vi ?? '')) add(at, 'opening hours', `now "${d.hours?.vi ?? ''}" — no open/closed badge without real hours`);
  if (d.needsSurvey) add(at, 'coordinates', 'lat/lng from a Maps link, needs an on-site check');
  if (d.description?.vi && d.description.vi === d.description.en) add(at, 'long intro (L)', 'vi and en are the same text');
}
for (const t of tours) {
  const at = t.title?.vi ?? t.id;
  if (!t.short?.vi) add(at, 'tour short intro', 'one line, shown on the collapsed tour card');
  if (t.draft) add(at, 'tour narrative (long intro)', 'placeholder written by us, needs the organiser\'s own copy');
  if (/chốt tên sau|TBD/i.test(t.voucher?.vi ?? '') || /TBD/i.test(t.voucher?.en ?? '')) add(at, 'voucher name', `now "${t.voucher?.vi ?? ''}"`);
}
const todoCsv = ['where,what,note'];
for (const t of todo) todoCsv.push([t.where, t.what, t.note].map(esc).join(','));
writeFileSync(new URL('../content/content-todo.csv', import.meta.url), todoCsv.join('\n') + '\n');

console.log(`content/i18n.csv  —  ${rows.length} strings, langs: ${[...langs].join(' ')}`);
const needed = rows.filter((r) => !r.skip).length; // skip=1 rows are names/hours, not translatable
for (const l of langs) {
  const done = rows.filter((r) => !r.skip && String(r.vals?.[l] ?? '').trim()).length;
  console.log(`  ${l}: ${done}/${needed} translated${done < needed ? `  (${needed - done} to go)` : ''}`);
}
for (const st of ['no-vi', 'en-missing', 'en=vi']) {
  const n = rows.filter((r) => r.status === st).length;
  if (n) console.log(`  ${st}: ${n} rows`);
}
console.log(`  (${Object.keys(viFn).length} of those are interpolation keys, slots exported as {n})`);
console.log(`content/content-todo.csv  —  ${todo.length} pieces of content not written yet`);

// ---- per-language worksheet: `node scripts/i18n-export.mjs ko` ----
// path + Vietnamese, tab separated. A translator sends back the same two columns
// with the text replaced, which drops into the CSV by `path` — no matching on the
// Vietnamese string, no structure to break.
const lang = process.argv[2];
if (lang) {
  if (!langs.has(lang)) { console.error(`unknown language "${lang}" — one of ${[...langs].join(' ')}`); process.exit(1); }
  const todoRows = rows.filter((r) => !r.skip && !String(r.vals?.[lang] ?? '').trim());
  const tsv = ['path\tvi', ...todoRows.map((r) => `${r.file}::${r.path}\t${r.vals.vi.replace(/\s+/g, ' ')}`)];
  writeFileSync(new URL(`../content/translate-${lang}.tsv`, import.meta.url), tsv.join('\n') + '\n');
  console.log(`content/translate-${lang}.tsv  —  ${todoRows.length} rows still to translate`);
}
