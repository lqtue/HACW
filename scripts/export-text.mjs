// Export every human-editable content string to one CSV for a translator/editor
// to audit and edit. Quiz banks are intentionally excluded — this is the "main
// components" text only. Columns: component,id,field,vi,en. One-language fields
// (proper noun / year / date / time) put their value in `vi` with `en` blank.
//
// Round-trip friendly: component+id+field is a stable key, so an import script
// can map an edited CSV back onto the JSON later. Run: node scripts/export-text.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/lib/data');
const load = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const rows = [['component', 'id', 'field', 'vi', 'en']];
const bi = (comp, id, field, v) => rows.push([comp, id, field, v?.vi ?? '', v?.en ?? '']);
const plain = (comp, id, field, v) => rows.push([comp, id, field, v ?? '', '']);

// destinations — name / address / hours / description (skip quizBank, coords, etc.)
for (const d of load('destinations.json')) {
  for (const f of ['name', 'address', 'hours', 'description']) bi('destination', d.id, f, d[f]);
}

// tours — title / theme / description / voucher
for (const tr of load('tours.json')) {
  for (const f of ['title', 'theme', 'description', 'voucher']) bi('tour', tr.id, f, tr[f]);
}

// rewards — title / reward
for (const r of load('rewards.json')) {
  for (const f of ['title', 'reward']) bi('reward', r.id, f, r[f]);
}

// categories — label
for (const c of load('categories.json')) bi('category', c.id, 'label', c.label);

// ticket counters — where
for (const p of load('ticket-points.json')) bi('ticket-point', p.id, 'where', p.where);


// RFC-4180 CSV: quote every field, double internal quotes. BOM so Excel reads UTF-8.
const csv =
  '﻿' +
  rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n') +
  '\r\n';

mkdirSync(join(ROOT, 'content'), { recursive: true });
const out = join(ROOT, 'content/text-audit.csv');
writeFileSync(out, csv);
console.log(`wrote ${out} — ${rows.length - 1} strings`);
