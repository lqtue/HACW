// Extract every { vi, en } translatable field from src/lib/data/*.json
// into one flat file keyed by JSON path, for editing/translation.
// Round-trip: edit values, then `node scripts/extract-text.mjs --apply <file>`.
// ponytail: walks {vi,en} only; if a 3rd lang is added, widen the leaf test.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/data');
const files = readdirSync(DATA).filter((f) => f.endsWith('.json'));

const isLeaf = (v) => v && typeof v === 'object' && 'vi' in v && 'en' in v
  && typeof v.vi !== 'object' && typeof v.en !== 'object';

function walk(node, path, out) {
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  else if (node && typeof node === 'object') {
    if (isLeaf(node)) { out[path] = { vi: node.vi, en: node.en }; return; }
    for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k, out);
  }
}

function setAt(root, path, value) {
  // path tokens: keys and [index]
  const toks = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '').split('.');
  let cur = root;
  for (let i = 0; i < toks.length - 1; i++) cur = cur[toks[i]];
  cur[toks[toks.length - 1]] = value;
}

const applyIdx = process.argv.indexOf('--apply');
if (applyIdx !== -1) {
  const edited = JSON.parse(readFileSync(process.argv[applyIdx + 1], 'utf8'));
  const byFile = {};
  for (const key of Object.keys(edited)) {
    const [file, ...rest] = key.split('::');
    (byFile[file] ??= {})[rest.join('::')] = edited[key];
  }
  for (const file of Object.keys(byFile)) {
    const root = JSON.parse(readFileSync(join(DATA, file), 'utf8'));
    for (const path of Object.keys(byFile[file])) setAt(root, path, byFile[file][path]);
    writeFileSync(join(DATA, file), JSON.stringify(root, null, 2) + '\n');
    console.log(`applied ${Object.keys(byFile[file]).length} -> ${file}`);
  }
} else {
  const out = {};
  let n = 0;
  for (const file of files) {
    const root = JSON.parse(readFileSync(join(DATA, file), 'utf8'));
    const sub = {};
    walk(root, '', sub);
    for (const p of Object.keys(sub)) { out[`${file}::${p}`] = sub[p]; n++; }
  }
  const dest = process.argv[2] || 'text-extract.json';
  writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
  console.log(`extracted ${n} {vi,en} fields from ${files.length} files -> ${dest}`);
}
