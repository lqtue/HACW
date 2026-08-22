// Extract UI chrome strings from src/lib/strings.js into one editable file,
// keyed by string key -> { vi, en }. Function strings (interpolated) are
// rendered with {0},{1},… placeholders so translators can move them around.
// ponytail: read-only extract; apply-back skipped — rewriting JS w/ functions
// is a parser job, add when translators want round-trip instead of hand-paste.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/strings.js');
const text = readFileSync(src, 'utf8');

// slice the UI object literal (no i18n refs inside it) and eval it directly —
// importing the module would pull in $state runes that plain node can't run.
const start = text.indexOf('{', text.indexOf('const UI ='));
const end = text.indexOf('\n};', start);
const UI = eval('(' + text.slice(start, end + 2) + ')'); // trusted local source

const render = (v) =>
  typeof v === 'function'
    ? v(...Array.from({ length: v.length }, (_, i) => `{${i}}`))
    : v;

const out = {};
for (const key of Object.keys(UI.vi)) {
  out[key] = { vi: render(UI.vi[key]), en: render(UI.en?.[key]) };
}

const dest = process.argv[2] || 'ui-text.json';
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
const fns = Object.keys(UI.vi).filter((k) => typeof UI.vi[k] === 'function').length;
console.log(`extracted ${Object.keys(out).length} UI keys (${fns} interpolated) -> ${dest}`);
