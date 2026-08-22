// Apply a board-edits.json (downloaded from /screens.html "Save") into the
// content JSON. Someone edits text on the board, downloads the file, sends it
// to you; you run:
//   node scripts/apply-edits.mjs board-edits.json
// then commit the changed src/lib/data/*.json.
// An edit applies only if its `original` matches exactly ONE { vi, en } value in
// that record — ambiguous / not-found edits are reported and skipped, never guessed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/data');
const FILES = { destinations: 'destinations.json', tours: 'tours.json' };

const isLeaf = (v) => v && typeof v === 'object' && typeof v.vi === 'string' && typeof v.en === 'string';
const leaves = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((v) => leaves(v, out));
  else if (node && typeof node === 'object') {
    if (isLeaf(node)) out.push(node);
    else for (const k of Object.keys(node)) leaves(node[k], out);
  }
  return out;
};

const edits = JSON.parse(readFileSync(process.argv[2], 'utf8')).edits ?? [];
const cache = {};
const load = (f) => (cache[f] ??= JSON.parse(readFileSync(join(dir, FILES[f]), 'utf8')));
const applied = [], skipped = [];
const dirty = new Set();

for (const e of edits) {
  if (!FILES[e.file]) { skipped.push(`${e.file}/${e.id}: file not writable`); continue; }
  const rec = load(e.file).find((r) => r.id === e.id);
  if (!rec) { skipped.push(`${e.file}/${e.id}: no such record`); continue; }
  const hits = [];
  for (const leaf of leaves(rec))
    for (const lang of ['vi', 'en'])
      if (leaf[lang] === e.original) hits.push([leaf, lang]);
  if (hits.length !== 1) {
    skipped.push(`${e.file}/${e.id}: ${hits.length ? 'ambiguous' : 'no match'} for "${e.original.slice(0, 40)}"`);
    continue;
  }
  hits[0][0][hits[0][1]] = e.edited;
  dirty.add(e.file);
  applied.push(`${e.file}/${e.id}.${hits[0][1]}`);
}

for (const f of dirty) writeFileSync(join(dir, FILES[f]), JSON.stringify(cache[f], null, 2) + '\n');
console.log(`applied ${applied.length}: ${applied.join(', ') || '(none)'}`);
if (skipped.length) console.log(`\nSKIPPED ${skipped.length}:\n  ${skipped.join('\n  ')}`);
