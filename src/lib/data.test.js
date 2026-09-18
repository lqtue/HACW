// Run: node src/lib/data.test.js
// Guards the content model: every destination has a usable discovery challenge,
// and every tour stop points at a real destination.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const dests = load('./data/destinations.json');
const tours = load('./data/tours.json');
const cats = new Set(load('./data/categories.json').map((c) => c.id));

const ids = new Set();
const bilingual = (o) => o && typeof o.vi === 'string' && typeof o.en === 'string';

for (const d of dests) {
  assert.ok(d.id && !ids.has(d.id), `unique id: ${d.id}`);
  ids.add(d.id);
  assert.ok(cats.has(d.category), `${d.id}: known category ${d.category}`);
  assert.ok(bilingual(d.name) && bilingual(d.description), `${d.id}: bilingual name/desc`);
  assert.ok(Number.isFinite(d.lat) && Number.isFinite(d.lng), `${d.id}: coords`);

  const x = d.discovery;
  assert.ok(x, `${d.id}: has discovery`);
  assert.ok(bilingual(x.clue) && bilingual(x.prompt), `${d.id}: bilingual clue/prompt`);
  assert.ok(Array.isArray(x.options) && x.options.length >= 2, `${d.id}: >=2 options`);
  assert.ok(x.options.every(bilingual), `${d.id}: bilingual options`);
  assert.ok(Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length,
    `${d.id}: answer in range`);
}

for (const t of tours) {
  assert.ok(t.stops.length > 0, `${t.id}: has stops`);
  for (const s of t.stops) assert.ok(ids.has(s), `${t.id}: stop "${s}" exists`);
}

console.log(`data.test.js OK — ${dests.length} destinations, ${tours.length} tours`);
