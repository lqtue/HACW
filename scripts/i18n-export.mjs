// Flatten every translatable string in the app into one CSV for the writer/
// translation team to see + audit in Sheets. Content JSON round-trips (a future
// i18n-import.mjs writes edits back by `path`); strings.js is export-only (its 28
// interpolation-function keys can't be a CSV cell — listed at the end of run).
//
//   node scripts/i18n-export.mjs   ->  content/i18n.csv
//
// Columns: file, path, skip, <langs…>. `skip=1` marks fields not worth
// translating (street names, clock hours). Lang columns are the union of keys
// found, so ko/zh/… appear automatically once added to any JSON node.
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
const fnKeys = [...block('vi').matchAll(/^ {4}([a-zA-Z_]+)\s*:\s*[(`].*=>/gm)].map((m) => m[1]);
for (const k of Object.keys(viUI)) rows.push({ file: 'strings.js', path: k, skip: '', vals: { vi: viUI[k], en: enUI[k] ?? '' } });

// ---- emit CSV ----
const cols = ['file', 'path', 'skip', ...[...langs]];
const esc = (v) => /[",\n]/.test(v ?? '') ? `"${String(v ?? '').replace(/"/g, '""')}"` : (v ?? '');
const csv = [cols.join(',')];
for (const r of rows) csv.push(cols.map((c) => esc(c in r ? r[c] : r.vals[c])).join(','));
writeFileSync(new URL('../content/i18n.csv', import.meta.url), csv.join('\n') + '\n');

console.log(`content/i18n.csv  —  ${rows.length} strings, langs: ${[...langs].join(' ')}`);
for (const l of langs) {
  const blank = rows.filter((r) => !r.skip && !String(r.vals?.[l] ?? '').trim()).length;
  console.log(`  ${l}: ${rows.length - blank}/${rows.length} filled${blank ? `  (${blank} blank)` : ''}`);
}
console.log(`  strings.js function keys (code-only, not in CSV): ${fnKeys.length} — ${fnKeys.join(', ')}`);
